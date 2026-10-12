-- =====================================================================
-- COUTURE GESTION — 0003 : fonctions métier (RPC)
-- Préfixe srv_ : réservées au serveur Node (service_role), jamais exposées
--                aux utilisateurs connectés.
-- Autres      : appelables par un utilisateur connecté, avec contrôle interne
--                (membre actif + abonnement actif + permission).
-- Erreurs métier : messages en MAJUSCULES (ex. DEJA_PRIS) traduits par le frontend.
-- =====================================================================

-- ---------- Contexte de l'utilisateur connecté ----------
create or replace function public.mon_contexte() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_m record; v_ab record;
  v_perms jsonb; v_roles jsonb; v_actif boolean; v_statut text; v_chg boolean;
begin
  if v_uid is null then return jsonb_build_object('type', 'anonyme'); end if;
  if exists (select 1 from public.super_admins where user_id = v_uid) then
    return jsonb_build_object('type', 'super_admin');
  end if;

  select m.atelier_id, m.est_proprietaire, m.statut, m.identifiant_interne,
         a.nom as atelier_nom, a.code_atelier, a.logo_path, a.visible_public,
         a.statut as atelier_statut, a.capacite_jour, a.delai_min_jours, a.jours_travail
    into v_m
    from public.membres_atelier m join public.ateliers a on a.id = m.atelier_id
   where m.user_id = v_uid;
  if not found then return jsonb_build_object('type', 'sans_atelier'); end if;

  select a.statut, a.debut_at, a.fin_at into v_ab
    from public.abonnements a where a.atelier_id = v_m.atelier_id
   order by (a.statut = 'actif') desc, a.fin_at desc nulls last limit 1;

  v_actif := v_m.statut = 'actif' and private.abonnement_actif(v_m.atelier_id);
  v_statut := case
    when v_ab.statut is null then 'aucun'
    when v_ab.statut = 'actif' and v_ab.fin_at <= now() then 'expire'
    when v_ab.statut = 'actif' and v_ab.debut_at > now() then 'a_venir'
    else v_ab.statut end;

  if v_m.statut <> 'actif' then
    v_perms := '[]'::jsonb;
  elsif v_m.est_proprietaire then
    select coalesce(jsonb_agg(code order by code), '[]') into v_perms from public.permissions;
  else
    select coalesce(jsonb_agg(distinct pp.permission_code), '[]') into v_perms
      from public.membre_profils_acces mp
      join public.profil_acces_permissions pp on pp.profil_acces_id = mp.profil_acces_id
     where mp.user_id = v_uid;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nom', r.nom)), '[]') into v_roles
    from public.membre_roles_production mr
    join public.roles_production r on r.id = mr.role_id
   where mr.user_id = v_uid and r.actif;

  select p.doit_changer_mdp into v_chg from public.profils p where p.id = v_uid;

  return jsonb_build_object(
    'type', 'membre',
    'est_proprietaire', v_m.est_proprietaire,
    'statut_membre', v_m.statut,
    'identifiant', v_m.identifiant_interne,
    'doit_changer_mdp', coalesce(v_chg, false),
    'permissions', v_perms,
    'roles', v_roles,
    'atelier', jsonb_build_object(
      'id', v_m.atelier_id, 'nom', v_m.atelier_nom, 'code', v_m.code_atelier,
      'logo_path', v_m.logo_path, 'visible_public', v_m.visible_public,
      'statut', v_m.atelier_statut, 'capacite_jour', v_m.capacite_jour,
      'delai_min_jours', v_m.delai_min_jours, 'jours_travail', v_m.jours_travail),
    'abonnement', jsonb_build_object('actif', v_actif, 'statut', v_statut, 'fin_at', v_ab.fin_at)
  );
end $$;

-- ---------- Configuration initiale d'un atelier (serveur uniquement) ----------
-- Valeurs par défaut MODIFIABLES : rôles, profils d'accès, mesures, types, emplacements, circuits.
create or replace function public.srv_initialiser_atelier(p_atelier uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_prod uuid; v_sec uuid; v_c1 uuid; v_c2 uuid;
begin
  insert into public.roles_production (atelier_id, nom) values
    (p_atelier,'Coupeur'),(p_atelier,'Faufileur'),(p_atelier,'Brodeur'),
    (p_atelier,'Monteur'),(p_atelier,'Finisseur'),(p_atelier,'Repasseur');

  insert into public.profils_acces (atelier_id, nom, description)
    values (p_atelier, 'Production', 'Voir les habits, prendre et terminer ses étapes')
    returning id into v_prod;
  insert into public.profil_acces_permissions (profil_acces_id, atelier_id, permission_code)
    select v_prod, p_atelier, unnest(array['habits.voir','habits.voir_circuit','production.prendre','production.terminer_etape']);

  insert into public.profils_acces (atelier_id, nom, description)
    values (p_atelier, 'Secrétaire', 'Clients, commandes, paiements, factures et validation finale')
    returning id into v_sec;
  insert into public.profil_acces_permissions (profil_acces_id, atelier_id, permission_code)
    select v_sec, p_atelier, unnest(array[
      'clients.voir','clients.creer','clients.modifier','mesures.voir','mesures.modifier',
      'commandes.voir','commandes.creer','commandes.modifier','habits.voir','habits.voir_circuit',
      'habits.confirmer_termine','emplacements.gerer','rendez_vous.voir','rendez_vous.gerer',
      'paiements.voir','paiements.enregistrer','factures.voir','factures.generer','factures.partager']);

  insert into public.mesure_champs (atelier_id, categorie, libelle, ordre)
  select p_atelier, c.categorie, f.libelle, f.ordre
    from (values ('homme'),('garcon')) as c(categorie)
    cross join (values ('Tour de cou',1),('Épaules',2),('Poitrine',3),('Taille',4),('Hanches',5),
      ('Longueur manche',6),('Tour de bras',7),('Longueur haut',8),('Longueur pantalon',9),
      ('Tour de cuisse',10),('Longueur totale',11)) as f(libelle, ordre);
  insert into public.mesure_champs (atelier_id, categorie, libelle, ordre)
  select p_atelier, c.categorie, f.libelle, f.ordre
    from (values ('femme'),('jeune_fille')) as c(categorie)
    cross join (values ('Tour de cou',1),('Épaules',2),('Poitrine',3),('Hauteur poitrine',4),
      ('Taille',5),('Hanches',6),('Longueur manche',7),('Tour de bras',8),('Longueur haut',9),
      ('Longueur jupe',10),('Longueur robe',11),('Longueur pantalon',12)) as f(libelle, ordre);

  insert into public.types_vetements (atelier_id, nom) values
    (p_atelier,'Bazin'),(p_atelier,'Tissu'),(p_atelier,'Wax'),(p_atelier,'Brodé');

  insert into public.emplacements (atelier_id, nom) values
    (p_atelier,'Étagère A'),(p_atelier,'Étagère B'),(p_atelier,'Étagère C'),
    (p_atelier,'Étagère 1'),(p_atelier,'Étagère 2'),(p_atelier,'Étagère 3');

  insert into public.modeles_circuits (atelier_id, nom) values (p_atelier, 'Boubou brodé') returning id into v_c1;
  insert into public.modeles_circuits_etapes (modele_circuit_id, atelier_id, ordre, nom, mode, role_id)
    select v_c1, p_atelier, e.ordre, e.nom, 'role',
           (select id from public.roles_production where atelier_id = p_atelier and nom = e.role)
      from (values (1,'Coupe','Coupeur'),(2,'Broderie','Brodeur'),(3,'Montage','Monteur'),
                   (4,'Finition','Finisseur'),(5,'Repassage','Repasseur')) as e(ordre, nom, role);

  insert into public.modeles_circuits (atelier_id, nom) values (p_atelier, 'Simple') returning id into v_c2;
  insert into public.modeles_circuits_etapes (modele_circuit_id, atelier_id, ordre, nom, mode, role_id)
    select v_c2, p_atelier, e.ordre, e.nom, 'role',
           (select id from public.roles_production where atelier_id = p_atelier and nom = e.role)
      from (values (1,'Coupe','Coupeur'),(2,'Montage','Monteur'),(3,'Repassage','Repasseur')) as e(ordre, nom, role);

  insert into public.journal_audit (atelier_id, acteur_id, action, ressource, ressource_id)
    values (p_atelier, null, 'atelier.initialise', 'ateliers', p_atelier::text);
end $$;

-- ---------- Abonnement : activation atomique d'un code (serveur uniquement) ----------
-- Le jour d'activation compte pour le jour 1 ; l'abonnement se termine à la fin du dernier jour,
-- heure de Bamako (ex. 30 jours activés le 5 octobre -> fin le 3 novembre à 23:59:59).
-- Si un abonnement est déjà actif, le nouveau s'enchaîne à la suite.
create or replace function public.srv_activer_abonnement(p_atelier uuid, p_user uuid, p_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_code record; v_ab record; v_debut timestamptz; v_fin timestamptz; v_encours timestamptz;
begin
  select * into v_code from public.codes_abonnement where code_hash = p_hash for update;
  if not found or v_code.atelier_id <> p_atelier then
    return jsonb_build_object('ok', false, 'raison', 'invalide');
  end if;
  if v_code.statut = 'utilise' then return jsonb_build_object('ok', false, 'raison', 'utilise'); end if;
  if v_code.statut <> 'non_utilise' then return jsonb_build_object('ok', false, 'raison', 'desactive'); end if;
  if now() > v_code.valide_jusqu_a then return jsonb_build_object('ok', false, 'raison', 'expire'); end if;

  select * into v_ab from public.abonnements where id = v_code.abonnement_id for update;
  if v_ab.statut <> 'en_attente' then return jsonb_build_object('ok', false, 'raison', 'desactive'); end if;

  select max(fin_at) into v_encours from public.abonnements
   where atelier_id = p_atelier and statut = 'actif' and fin_at > now();
  v_debut := greatest(now(), coalesce(v_encours, now()));
  v_fin := (date_trunc('day', v_debut at time zone 'Africa/Bamako') + v_ab.duree_jours * interval '1 day')
           at time zone 'Africa/Bamako';

  update public.abonnements set statut = 'actif', debut_at = v_debut, fin_at = v_fin where id = v_ab.id;
  update public.codes_abonnement set statut = 'utilise', utilise_at = now(), utilise_par = p_user where id = v_code.id;
  insert into public.abonnements_historique (atelier_id, abonnement_id, action, acteur_id, details)
    values (p_atelier, v_ab.id, 'code_active', p_user,
            jsonb_build_object('debut_at', v_debut, 'fin_at', v_fin, 'duree_jours', v_ab.duree_jours));
  return jsonb_build_object('ok', true, 'debut_at', v_debut, 'fin_at', v_fin);
end $$;

create or replace function public.srv_prolonger_abonnement(p_id uuid, p_jours int, p_acteur uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_a record; v_fin timestamptz;
begin
  if p_jours is null or p_jours < 1 or p_jours > 3660 then raise exception 'DUREE_INVALIDE'; end if;
  select * into v_a from public.abonnements where id = p_id for update;
  if not found then raise exception 'INTROUVABLE'; end if;
  if v_a.debut_at is null then raise exception 'NON_ACTIVE'; end if;
  if v_a.fin_at > now() then
    v_fin := v_a.fin_at + p_jours * interval '1 day';
  else
    v_fin := (date_trunc('day', now() at time zone 'Africa/Bamako') + p_jours * interval '1 day')
             at time zone 'Africa/Bamako';
  end if;
  update public.abonnements set fin_at = v_fin where id = p_id;
  insert into public.abonnements_historique (atelier_id, abonnement_id, action, acteur_id, details)
    values (v_a.atelier_id, p_id, 'prolonge', p_acteur,
            jsonb_build_object('jours', p_jours, 'ancienne_fin', v_a.fin_at, 'nouvelle_fin', v_fin));
  return jsonb_build_object('fin_at', v_fin);
end $$;

-- ---------- Commande + habits + circuits copiés ----------
-- p_habits : [{type_vetement_id, type_libelle, modele_id, modele_libelle, photo_habit_path,
--              photo_modele_path, mesures:[{champ_id,libelle,unite,valeur}],
--              circuit_modele_id | etapes:[{nom,mode,role_id,user_id}]}]
-- Le circuit est COPIÉ dans l'habit : modifier ensuite le modèle ne change jamais un habit existant.
create or replace function public.creer_commande(
  p_client uuid, p_date_rdv date, p_total bigint, p_avance bigint, p_note text,
  p_habits jsonb, p_proposition jsonb default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_at uuid := private.mon_atelier_id();
  v_cmd uuid; v_hid uuid; v_h jsonb; v_e jsonb; v_i int; v_modele uuid;
begin
  if v_at is null or not private.acces('commandes.creer') then raise exception 'ACCES_REFUSE'; end if;
  if p_total is null or p_total < 0 or coalesce(p_avance, 0) < 0 or coalesce(p_avance, 0) > p_total then
    raise exception 'MONTANT_INVALIDE';
  end if;
  if coalesce(p_avance, 0) > 0 and not private.acces('paiements.enregistrer') then raise exception 'ACCES_REFUSE'; end if;
  if p_habits is null or jsonb_typeof(p_habits) <> 'array' or jsonb_array_length(p_habits) = 0 then
    raise exception 'HABITS_REQUIS';
  end if;
  if not exists (select 1 from public.clients where id = p_client and atelier_id = v_at and archived_at is null) then
    raise exception 'CLIENT_INTROUVABLE';
  end if;

  insert into public.commandes (atelier_id, code, client_id, date_rdv, total_fcfa, note, created_by)
    values (v_at, private.prochain_code(v_at, 'commande', 'CMD-'), p_client, p_date_rdv, p_total, nullif(p_note, ''), auth.uid())
    returning id into v_cmd;

  for v_h in select value from jsonb_array_elements(p_habits) loop
    insert into public.habits (atelier_id, commande_id, code, type_vetement_id, type_libelle, modele_id,
                               modele_libelle, photo_habit_path, photo_modele_path, mesures_utilisees)
    values (v_at, v_cmd, private.prochain_code(v_at, 'habit', 'HAB-'),
            nullif(v_h->>'type_vetement_id', '')::uuid,
            coalesce(nullif(v_h->>'type_libelle', ''), 'Habit'),
            nullif(v_h->>'modele_id', '')::uuid, nullif(v_h->>'modele_libelle', ''),
            nullif(v_h->>'photo_habit_path', ''), nullif(v_h->>'photo_modele_path', ''),
            coalesce(v_h->'mesures', '[]'::jsonb))
    returning id into v_hid;

    v_modele := nullif(v_h->>'circuit_modele_id', '')::uuid;
    if v_modele is not null then
      insert into public.habit_etapes (atelier_id, habit_id, ordre, nom, mode, role_id, user_id, statut)
      select v_at, v_hid, s.ordre, s.nom, s.mode, s.role_id, s.user_id,
             case when s.ordre = (select min(ordre) from public.modeles_circuits_etapes
                                   where modele_circuit_id = v_modele and atelier_id = v_at)
                  then 'disponible' else 'en_attente' end
        from public.modeles_circuits_etapes s
       where s.modele_circuit_id = v_modele and s.atelier_id = v_at;
    elsif jsonb_typeof(v_h->'etapes') = 'array' and jsonb_array_length(v_h->'etapes') > 0 then
      v_i := 0;
      for v_e in select value from jsonb_array_elements(v_h->'etapes') loop
        v_i := v_i + 1;
        insert into public.habit_etapes (atelier_id, habit_id, ordre, nom, mode, role_id, user_id, statut)
        values (v_at, v_hid, v_i, v_e->>'nom', v_e->>'mode',
                nullif(v_e->>'role_id', '')::uuid, nullif(v_e->>'user_id', '')::uuid,
                case when v_i = 1 then 'disponible' else 'en_attente' end);
      end loop;
    else
      raise exception 'CIRCUIT_REQUIS';
    end if;
    if not exists (select 1 from public.habit_etapes where habit_id = v_hid) then
      raise exception 'CIRCUIT_REQUIS';
    end if;
  end loop;

  if coalesce(p_avance, 0) > 0 then
    insert into public.paiements (atelier_id, commande_id, montant_fcfa, mode, note, enregistre_par)
    values (v_at, v_cmd, p_avance, 'especes', 'Avance à la commande', auth.uid());
  end if;

  if p_proposition is not null and p_proposition ? 'date_proposee' then
    insert into public.propositions_rdv (atelier_id, commande_id, date_proposee, statut, motif, decide_par)
    values (v_at, v_cmd, (p_proposition->>'date_proposee')::date,
            case when p_proposition->>'statut' in ('proposee','acceptee','modifiee','refusee')
                 then p_proposition->>'statut' else 'proposee' end,
            nullif(p_proposition->>'motif', ''), auth.uid());
  end if;

  perform private.journaliser(v_at, 'commande.creee', 'commandes', v_cmd::text,
          jsonb_build_object('total', p_total, 'avance', coalesce(p_avance, 0)));
  return v_cmd;
end $$;

-- ---------- Production : prise d'une étape (atomique) ----------
create or replace function public.prendre_etape(p_etape uuid, p_role uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_at uuid := private.mon_atelier_id(); v_e record; v_n int; v_role uuid;
begin
  if v_at is null or not private.acces('production.prendre') then raise exception 'ACCES_REFUSE'; end if;
  select * into v_e from public.habit_etapes where id = p_etape and atelier_id = v_at;
  if not found then raise exception 'INTROUVABLE'; end if;
  if exists (select 1 from public.habits where id = v_e.habit_id and statut = 'annule') then
    raise exception 'HABIT_ANNULE';
  end if;

  if v_e.mode = 'personne' then
    if v_e.user_id is distinct from auth.uid() then raise exception 'NON_ELIGIBLE'; end if;
    v_role := null;
    if p_role is not null and exists (
         select 1 from public.membre_roles_production where user_id = auth.uid() and role_id = p_role) then
      v_role := p_role;
    end if;
  else
    v_role := coalesce(p_role, v_e.role_id);
    if v_role <> v_e.role_id or not exists (
         select 1 from public.membre_roles_production mr
           join public.roles_production r on r.id = mr.role_id
          where mr.user_id = auth.uid() and mr.role_id = v_role and r.actif) then
      raise exception 'NON_ELIGIBLE';
    end if;
  end if;

  -- Un seul gagnant : la condition statut = 'disponible' est réévaluée après verrouillage de la ligne.
  update public.habit_etapes
     set statut = 'en_cours', pris_par = auth.uid(), role_utilise_id = v_role, pris_a = now()
   where id = p_etape and statut = 'disponible'
  returning 1 into v_n;
  if v_n is null then raise exception 'DEJA_PRIS'; end if;

  update public.habits set statut = 'en_cours' where id = v_e.habit_id and statut = 'en_attente';
  perform private.journaliser(v_at, 'production.etape_prise', 'habit_etapes', p_etape::text,
          jsonb_build_object('habit_id', v_e.habit_id, 'etape', v_e.nom, 'role_utilise_id', v_role));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.terminer_etape(p_etape uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_at uuid := private.mon_atelier_id(); v_e record; v_next int;
begin
  if v_at is null or not private.acces('production.terminer_etape') then raise exception 'ACCES_REFUSE'; end if;
  update public.habit_etapes
     set statut = 'terminee', termine_a = now(),
         duree_secondes = greatest(0, extract(epoch from (now() - pris_a))::int)
   where id = p_etape and atelier_id = v_at and statut = 'en_cours' and pris_par = auth.uid()
  returning habit_id, ordre, nom into v_e;
  if not found then raise exception 'NON_AUTORISE_OU_DEJA_TERMINE'; end if;

  select min(ordre) into v_next from public.habit_etapes where habit_id = v_e.habit_id and ordre > v_e.ordre;
  if v_next is null then
    update public.habits set statut = 'a_valider' where id = v_e.habit_id and statut <> 'annule';
  else
    update public.habit_etapes set statut = 'disponible'
     where habit_id = v_e.habit_id and ordre = v_next and statut = 'en_attente';
  end if;
  perform private.journaliser(v_at, 'production.etape_terminee', 'habit_etapes', p_etape::text,
          jsonb_build_object('habit_id', v_e.habit_id, 'etape', v_e.nom));
  return jsonb_build_object('ok', true, 'derniere_etape', v_next is null);
end $$;

-- ---------- Validation finale + emplacement ----------
create or replace function public.confirmer_habit_termine(p_habit uuid, p_emplacement uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_at uuid := private.mon_atelier_id(); v_h record;
begin
  if v_at is null or not private.acces('habits.confirmer_termine') then raise exception 'ACCES_REFUSE'; end if;
  select * into v_h from public.habits where id = p_habit and atelier_id = v_at for update;
  if not found then raise exception 'INTROUVABLE'; end if;
  if v_h.statut <> 'a_valider' then raise exception 'ETAPES_NON_TERMINEES'; end if;
  if not exists (select 1 from public.emplacements where id = p_emplacement and atelier_id = v_at and actif) then
    raise exception 'EMPLACEMENT_INVALIDE';
  end if;
  update public.habits
     set statut = 'termine', emplacement_id = p_emplacement, valide_par = auth.uid(), valide_at = now()
   where id = p_habit;
  if not exists (select 1 from public.habits
                  where commande_id = v_h.commande_id and statut not in ('termine','annule')) then
    update public.commandes set statut = 'terminee' where id = v_h.commande_id and statut = 'en_cours';
  end if;
  perform private.journaliser(v_at, 'habit.confirme_termine', 'habits', p_habit::text,
          jsonb_build_object('emplacement_id', p_emplacement));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- Annulation de commande ----------
create or replace function public.annuler_commande(p_commande uuid, p_motif text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_at uuid := private.mon_atelier_id();
begin
  if v_at is null or not private.acces('commandes.annuler') then raise exception 'ACCES_REFUSE'; end if;
  if p_motif is null or char_length(trim(p_motif)) < 3 then raise exception 'MOTIF_REQUIS'; end if;
  update public.commandes set statut = 'annulee', motif_annulation = trim(p_motif)
   where id = p_commande and atelier_id = v_at and statut = 'en_cours';
  if not found then raise exception 'INTROUVABLE_OU_DEJA_CLOTUREE'; end if;
  update public.habits set statut = 'annule' where commande_id = p_commande and statut <> 'termine';
  perform private.journaliser(v_at, 'commande.annulee', 'commandes', p_commande::text,
          jsonb_build_object('motif', trim(p_motif)));
end $$;

-- ---------- Paiements ----------
create or replace function public.enregistrer_paiement(p_commande uuid, p_montant bigint, p_mode text, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_at uuid := private.mon_atelier_id(); v_c record; v_paye bigint; v_id uuid;
begin
  if v_at is null or not private.acces('paiements.enregistrer') then raise exception 'ACCES_REFUSE'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'MONTANT_INVALIDE'; end if;
  select * into v_c from public.commandes where id = p_commande and atelier_id = v_at for update;
  if not found then raise exception 'INTROUVABLE'; end if;
  if v_c.statut = 'annulee' then raise exception 'COMMANDE_ANNULEE'; end if;
  select coalesce(sum(montant_fcfa), 0) into v_paye from public.paiements where commande_id = p_commande and annule_at is null;
  if p_montant > v_c.total_fcfa - v_paye then raise exception 'DEPASSE_LE_RESTE'; end if;
  insert into public.paiements (atelier_id, commande_id, montant_fcfa, mode, note, enregistre_par)
    values (v_at, p_commande, p_montant, coalesce(nullif(p_mode, ''), 'especes'), nullif(p_note, ''), auth.uid())
    returning id into v_id;
  perform private.journaliser(v_at, 'paiement.enregistre', 'paiements', v_id::text,
          jsonb_build_object('commande_id', p_commande, 'montant', p_montant));
  return jsonb_build_object('id', v_id, 'reste', v_c.total_fcfa - v_paye - p_montant);
end $$;

create or replace function public.annuler_paiement(p_paiement uuid, p_motif text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_at uuid := private.mon_atelier_id();
begin
  if v_at is null or not private.acces('paiements.modifier') then raise exception 'ACCES_REFUSE'; end if;
  if p_motif is null or char_length(trim(p_motif)) < 3 then raise exception 'MOTIF_REQUIS'; end if;
  update public.paiements set annule_at = now(), motif_annulation = trim(p_motif)
   where id = p_paiement and atelier_id = v_at and annule_at is null;
  if not found then raise exception 'INTROUVABLE'; end if;
  perform private.journaliser(v_at, 'paiement.annule', 'paiements', p_paiement::text,
          jsonb_build_object('motif', trim(p_motif)));
end $$;

-- ---------- Facture : numéro + montants calculés en base ----------
-- Chaque appel crée un NOUVEAU justificatif avec les montants du moment.
create or replace function public.generer_facture(p_commande uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_at uuid := private.mon_atelier_id();
  v_c record; v_cl record; v_a record; v_paye bigint; v_num text; v_f uuid;
  v_habits jsonb; v_paiements jsonb;
begin
  if v_at is null or not private.acces('factures.generer') then raise exception 'ACCES_REFUSE'; end if;
  select * into v_c from public.commandes where id = p_commande and atelier_id = v_at;
  if not found then raise exception 'INTROUVABLE'; end if;
  select nom, prenom, telephone_e164, whatsapp_e164 into v_cl
    from public.clients where id = v_c.client_id and atelier_id = v_at;
  select nom, telephone, adresse, logo_path into v_a from public.ateliers where id = v_at;
  select coalesce(sum(montant_fcfa), 0) into v_paye
    from public.paiements where commande_id = p_commande and annule_at is null;
  v_num := private.prochain_code(v_at, 'facture', 'FAC-');
  insert into public.factures (atelier_id, commande_id, numero, total_fcfa, avance_fcfa, reste_fcfa, created_by)
    values (v_at, p_commande, v_num, v_c.total_fcfa, v_paye, v_c.total_fcfa - v_paye, auth.uid())
    returning id into v_f;
  select coalesce(jsonb_agg(jsonb_build_object('code', h.code, 'type', h.type_libelle, 'modele', h.modele_libelle)
                            order by h.code), '[]') into v_habits
    from public.habits h where h.commande_id = p_commande and h.statut <> 'annule';
  select coalesce(jsonb_agg(jsonb_build_object('date', p.paye_le, 'montant', p.montant_fcfa, 'mode', p.mode)
                            order by p.paye_le), '[]') into v_paiements
    from public.paiements p where p.commande_id = p_commande and p.annule_at is null;
  perform private.journaliser(v_at, 'facture.generee', 'factures', v_f::text, jsonb_build_object('numero', v_num));
  return jsonb_build_object(
    'facture', jsonb_build_object('id', v_f, 'numero', v_num, 'total', v_c.total_fcfa, 'avance', v_paye,
                                  'reste', v_c.total_fcfa - v_paye, 'date', now()),
    'atelier', to_jsonb(v_a), 'client', to_jsonb(v_cl),
    'commande', jsonb_build_object('id', v_c.id, 'code', v_c.code, 'date_rdv', v_c.date_rdv, 'created_at', v_c.created_at),
    'habits', v_habits, 'paiements', v_paiements);
end $$;

-- ---------- Rendez-vous : proposition de date selon la capacité ----------
-- Algorithme volontairement simple et documenté :
--  date >= max(aujourd'hui + délai minimum, p_apres), jour travaillé,
--  nombre d'habits déjà promis ce jour-là + p_nb <= capacité par jour.
create or replace function public.proposer_date_rdv(p_nb int, p_apres date default null) returns date
language plpgsql stable security definer set search_path = '' as $$
declare
  v_at uuid := private.mon_atelier_id(); v_a record; v_d date; v_charge int; v_i int := 0;
begin
  if v_at is null or not private.acces_un_de(array['rendez_vous.voir','rendez_vous.gerer','commandes.creer']) then
    raise exception 'ACCES_REFUSE';
  end if;
  if p_nb is null or p_nb < 1 then raise exception 'NB_HABITS_INVALIDE'; end if;
  select capacite_jour, delai_min_jours, jours_travail into v_a from public.ateliers where id = v_at;
  v_d := greatest(coalesce(p_apres, date '0001-01-01'),
                  ((now() at time zone 'Africa/Bamako')::date + v_a.delai_min_jours));
  loop
    v_i := v_i + 1;
    if v_i > 400 then raise exception 'AUCUNE_DATE_DISPONIBLE'; end if;
    if extract(isodow from v_d)::int = any (v_a.jours_travail) then
      select count(*) into v_charge
        from public.habits h join public.commandes c on c.id = h.commande_id
       where h.atelier_id = v_at and c.date_rdv = v_d and h.statut <> 'annule' and c.statut <> 'annulee';
      if v_charge + p_nb <= v_a.capacite_jour then return v_d; end if;
    end if;
    v_d := v_d + 1;
  end loop;
end $$;

-- ---------- Création atomique d'un atelier avec son propriétaire (serveur uniquement) ----------
create or replace function public.srv_creer_atelier(
  p_user uuid, p_nom_atelier text, p_code text, p_telephone text,
  p_nom text, p_prenom text, p_email text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  insert into public.ateliers (nom, code_atelier, telephone) values (p_nom_atelier, p_code, p_telephone)
    returning id into v;
  insert into public.profils (id, nom, prenom, telephone, email) values (p_user, p_nom, p_prenom, p_telephone, p_email);
  insert into public.membres_atelier (user_id, atelier_id, est_proprietaire) values (p_user, v, true);
  perform public.srv_initialiser_atelier(v);
  return v;
end $$;

-- ---------- Identifiant interne d'employé (EMP-001, EMP-002…) unique par atelier ----------
create or replace function public.srv_prochain_identifiant(p_atelier uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v bigint;
begin
  insert into public.compteurs (atelier_id, cle, valeur) values (p_atelier, 'employe', 1)
  on conflict (atelier_id, cle) do update set valeur = public.compteurs.valeur + 1
  returning valeur into v;
  return 'EMP-' || lpad(v::text, 3, '0');
end $$;
