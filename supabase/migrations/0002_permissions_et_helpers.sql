-- =====================================================================
-- COUTURE GESTION — 0002 : permissions, fonctions d'accès, audit, anti-escalade
-- =====================================================================

-- ---------- Catalogue des permissions ----------
-- Une permission n'existe que si une fonctionnalité réelle la protège.
insert into public.permissions (code, libelle, groupe) values
  ('clients.voir',               'Voir les clients',                       'Clients'),
  ('clients.creer',              'Créer un client',                        'Clients'),
  ('clients.modifier',           'Modifier ou archiver un client',         'Clients'),
  ('mesures.voir',               'Voir les mesures',                       'Clients'),
  ('mesures.modifier',           'Créer ou modifier les mesures',          'Clients'),
  ('commandes.voir',             'Voir les commandes',                     'Commandes'),
  ('commandes.creer',            'Créer une commande',                     'Commandes'),
  ('commandes.modifier',         'Modifier une commande',                  'Commandes'),
  ('commandes.annuler',          'Annuler une commande',                   'Commandes'),
  ('habits.voir',                'Voir les habits',                        'Habits'),
  ('habits.voir_circuit',        'Voir le circuit de fabrication',         'Habits'),
  ('habits.confirmer_termine',   'Confirmer qu''un habit est terminé',     'Habits'),
  ('production.prendre',         'Prendre un habit (étape de fabrication)','Production'),
  ('production.terminer_etape',  'Terminer une étape',                     'Production'),
  ('emplacements.gerer',         'Gérer les emplacements',                 'Habits'),
  ('circuits.gerer',             'Gérer les modèles de circuits',          'Production'),
  ('modeles.gerer',              'Gérer les modèles de vêtements',         'Commandes'),
  ('rendez_vous.voir',           'Voir le planning des rendez-vous',       'Rendez-vous'),
  ('rendez_vous.gerer',          'Gérer les rendez-vous et la capacité',   'Rendez-vous'),
  ('paiements.voir',             'Voir les paiements',                     'Paiements'),
  ('paiements.enregistrer',      'Enregistrer un paiement',                'Paiements'),
  ('paiements.modifier',         'Annuler ou corriger un paiement',        'Paiements'),
  ('factures.voir',              'Voir les factures',                      'Factures'),
  ('factures.generer',           'Générer une facture',                    'Factures'),
  ('factures.partager',          'Partager une facture',                   'Factures'),
  ('depenses.voir',              'Voir les dépenses',                      'Dépenses'),
  ('depenses.creer',             'Créer une dépense',                      'Dépenses'),
  ('depenses.modifier',          'Modifier ou archiver une dépense',       'Dépenses'),
  ('employes.voir',              'Voir les employés',                      'Employés'),
  ('employes.creer',             'Créer un employé',                       'Employés'),
  ('employes.modifier',          'Modifier un employé',                    'Employés'),
  ('employes.desactiver',        'Désactiver ou réactiver un employé',     'Employés'),
  ('roles.voir',                 'Voir les rôles et profils d''accès',     'Rôles'),
  ('roles.creer',                'Créer un rôle ou un profil d''accès',    'Rôles'),
  ('roles.modifier',             'Modifier un rôle ou un profil d''accès', 'Rôles'),
  ('roles.attribuer',            'Attribuer rôles et profils d''accès',    'Rôles'),
  ('parametres.modifier',        'Modifier les paramètres de l''atelier',  'Paramètres'),
  ('audit.voir',                 'Consulter le journal d''audit',          'Paramètres');

-- ---------- Fonctions d'accès (SECURITY DEFINER, search_path figé) ----------
create or replace function private.mon_atelier_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.atelier_id from public.membres_atelier m
  where m.user_id = auth.uid() and m.statut = 'actif'
$$;

create or replace function private.est_proprietaire() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membres_atelier m
                 where m.user_id = auth.uid() and m.statut = 'actif' and m.est_proprietaire)
$$;

-- Un abonnement est actif si : statut 'actif', maintenant dans [debut, fin[, atelier non désactivé.
-- L'expiration est donc calculée par l'heure : aucun traitement planifié n'est nécessaire.
create or replace function private.abonnement_actif(p_atelier uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.abonnements a
    join public.ateliers t on t.id = a.atelier_id
    where a.atelier_id = p_atelier and a.statut = 'actif'
      and now() >= a.debut_at and now() < a.fin_at and t.statut = 'actif')
$$;

create or replace function private.a_permission(p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.membres_atelier m
                 where m.user_id = auth.uid() and m.statut = 'actif' and m.est_proprietaire)
      or exists (select 1 from public.membres_atelier m
                 join public.membre_profils_acces mp on mp.user_id = m.user_id
                 join public.profil_acces_permissions pp on pp.profil_acces_id = mp.profil_acces_id
                 where m.user_id = auth.uid() and m.statut = 'actif' and pp.permission_code = p_code)
$$;

-- accès = membre actif + abonnement actif + permission
create or replace function private.acces(p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.mon_atelier_id() is not null
     and private.abonnement_actif(private.mon_atelier_id())
     and private.a_permission(p_code)
$$;

create or replace function private.acces_un_de(p_codes text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.mon_atelier_id() is not null
     and private.abonnement_actif(private.mon_atelier_id())
     and exists (select 1 from unnest(p_codes) c where private.a_permission(c))
$$;

create or replace function private.membre_abonne() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.mon_atelier_id() is not null
     and private.abonnement_actif(private.mon_atelier_id())
$$;

-- ---------- Compteurs d'identifiants lisibles (par atelier) ----------
create or replace function private.prochain_code(p_atelier uuid, p_cle text, p_prefixe text) returns text
language plpgsql security definer set search_path = '' as $$
declare v bigint;
begin
  insert into public.compteurs (atelier_id, cle, valeur) values (p_atelier, p_cle, 1)
  on conflict (atelier_id, cle) do update set valeur = public.compteurs.valeur + 1
  returning valeur into v;
  return p_prefixe || lpad(v::text, 6, '0');
end $$;

-- ---------- Journal d'audit ----------
create or replace function private.journaliser(
  p_atelier uuid, p_action text, p_ressource text, p_id text, p_details jsonb default '{}'
) returns void language sql security definer set search_path = '' as $$
  insert into public.journal_audit (atelier_id, acteur_id, action, ressource, ressource_id, details)
  values (p_atelier, auth.uid(), p_action, p_ressource, p_id, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function private.trg_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_row jsonb;
begin
  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  insert into public.journal_audit (atelier_id, acteur_id, action, ressource, ressource_id, details)
  values ((v_row->>'atelier_id')::uuid, auth.uid(),
          tg_table_name || '.' || lower(tg_op), tg_table_name,
          coalesce(v_row->>'id', v_row->>'user_id'), v_row);
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

create trigger audit_roles_production        after insert or update or delete on public.roles_production        for each row execute function private.trg_audit();
create trigger audit_membre_roles_production after insert or delete          on public.membre_roles_production for each row execute function private.trg_audit();
create trigger audit_profils_acces           after insert or update or delete on public.profils_acces           for each row execute function private.trg_audit();
create trigger audit_profil_acces_permissions after insert or delete         on public.profil_acces_permissions for each row execute function private.trg_audit();
create trigger audit_membre_profils_acces    after insert or delete          on public.membre_profils_acces    for each row execute function private.trg_audit();

-- ---------- Protection contre l'élévation de privilèges ----------
-- Le propriétaire gère librement son atelier. Un autre membre ne peut :
--  - ni s'attribuer un profil d'accès,
--  - ni modifier un profil d'accès qu'il possède lui-même,
--  - ni donner / retirer une permission qu'il ne détient pas,
--  - ni attribuer un profil contenant des permissions qu'il ne détient pas.
-- auth.uid() est nul pour le serveur (service_role) et les migrations : ils passent.
create or replace function private.trg_anti_escalade() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_profil uuid; v_user uuid; v_perm text; v_ligne record;
begin
  -- NEW n'existe pas pour un DELETE : on lit la bonne ligne explicitement.
  if tg_op = 'DELETE' then v_ligne := old; else v_ligne := new; end if;

  if auth.uid() is null or private.est_proprietaire() then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_table_name = 'profil_acces_permissions' then
    v_profil := v_ligne.profil_acces_id;
    v_perm   := v_ligne.permission_code;
    if exists (select 1 from public.membre_profils_acces mp
               where mp.user_id = auth.uid() and mp.profil_acces_id = v_profil) then
      raise exception 'ESCALADE_INTERDITE: modification d''un de vos propres profils';
    end if;
    if not private.a_permission(v_perm) then
      raise exception 'ESCALADE_INTERDITE: permission non détenue (%)', v_perm;
    end if;
  else  -- membre_profils_acces
    v_user   := v_ligne.user_id;
    v_profil := v_ligne.profil_acces_id;
    if v_user = auth.uid() then
      raise exception 'ESCALADE_INTERDITE: auto-attribution';
    end if;
    if exists (select 1 from public.profil_acces_permissions pp
               where pp.profil_acces_id = v_profil and not private.a_permission(pp.permission_code)) then
      raise exception 'ESCALADE_INTERDITE: profil contenant des permissions non détenues';
    end if;
    -- le propriétaire ne reçoit jamais de profil (il a déjà tous les droits)
    if exists (select 1 from public.membres_atelier m where m.user_id = v_user and m.est_proprietaire) then
      raise exception 'ESCALADE_INTERDITE: le propriétaire ne peut pas être modifié';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

create trigger anti_escalade_pap before insert or update or delete on public.profil_acces_permissions
  for each row execute function private.trg_anti_escalade();
create trigger anti_escalade_mpa before insert or update or delete on public.membre_profils_acces
  for each row execute function private.trg_anti_escalade();

-- ---------- Commandes : contrôle des modifications directes ----------
create or replace function private.trg_commande_maj() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_paye bigint;
begin
  if auth.uid() is null then return new; end if;
  if (new.total_fcfa is distinct from old.total_fcfa or new.note is distinct from old.note)
     and not private.acces('commandes.modifier') then
    raise exception 'ACCES_REFUSE';
  end if;
  if new.date_rdv is distinct from old.date_rdv
     and not private.acces_un_de(array['commandes.modifier','rendez_vous.gerer']) then
    raise exception 'ACCES_REFUSE';
  end if;
  if new.total_fcfa <> old.total_fcfa then
    select coalesce(sum(montant_fcfa), 0) into v_paye
    from public.paiements where commande_id = new.id and annule_at is null;
    if new.total_fcfa < v_paye then raise exception 'TOTAL_INFERIEUR_AUX_PAIEMENTS'; end if;
  end if;
  return new;
end $$;

create trigger commande_maj before update on public.commandes
  for each row execute function private.trg_commande_maj();
