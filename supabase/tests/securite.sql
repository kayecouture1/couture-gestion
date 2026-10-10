-- =====================================================================
-- COUTURE GESTION — tests de sécurité SQL (isolation, expiration, escalade, concurrence logique)
-- À exécuter dans l'éditeur SQL Supabase (rôle postgres) APRÈS les migrations, sur un projet de TEST.
-- Tout est annulé à la fin (ROLLBACK). Une erreur « ECHEC » signale un test raté.
-- ⚠️ Ce fichier n'a pas été exécuté lors de sa rédaction : à lancer et corriger si besoin.
-- =====================================================================
begin;

create or replace function pg_temp.en_tant_que(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.en_tant_qu_admin() returns void language plpgsql as $$
begin
  perform set_config('role', session_user, true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

do $$
declare
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ue uuid := gen_random_uuid();
  aa uuid := gen_random_uuid(); ab uuid := gen_random_uuid();
  ca uuid; cb uuid; n int; v_ok boolean; v_res jsonb; v_prof uuid; v_hab uuid;
  v_cmd uuid; v_et uuid; v_role uuid; v_code_hash text := 'hash-test-1'; v_ok_ts timestamptz;
begin
  -- ---------- Jeu de test : deux ateliers isolés ----------
  insert into auth.users (id, email) values (ua, 'a@test.local'), (ub, 'b@test.local'), (ue, 'e@test.local');
  insert into public.ateliers (id, nom, code_atelier) values (aa, 'Atelier A', 'testaa'), (ab, 'Atelier B', 'testbb');
  insert into public.profils (id, nom, prenom) values (ua,'A','Prop'), (ub,'B','Prop'), (ue,'E','Emp');
  insert into public.membres_atelier (user_id, atelier_id, est_proprietaire) values (ua, aa, true), (ub, ab, true);
  insert into public.membres_atelier (user_id, atelier_id, identifiant_interne) values (ue, aa, 'EMP-001');
  perform public.srv_initialiser_atelier(aa);
  perform public.srv_initialiser_atelier(ab);
  insert into public.abonnements (atelier_id, duree_jours, statut, debut_at, fin_at)
    values (aa, 30, 'actif', now() - interval '1 day', now() + interval '10 days'),
           (ab, 30, 'actif', now() - interval '1 day', now() + interval '10 days');
  insert into public.clients (atelier_id, nom, prenom) values (aa, 'ClientA', 'x') returning id into ca;
  insert into public.clients (atelier_id, nom, prenom) values (ab, 'ClientB', 'y') returning id into cb;

  -- ---------- 1. Isolation : A ne voit jamais B ----------
  perform pg_temp.en_tant_que(ua);
  select count(*) into n from public.clients;
  if n <> 1 then raise exception 'ECHEC isolation: A voit % clients (attendu 1)', n; end if;
  select count(*) into n from public.clients where id = cb;
  if n <> 0 then raise exception 'ECHEC isolation: A voit le client de B par son ID'; end if;
  begin
    insert into public.clients (atelier_id, nom, prenom) values (ab, 'Intrus', 'z');
    raise exception 'ECHEC isolation: A a pu créer un client chez B';
  exception when insufficient_privilege or check_violation then null;
  end;
  update public.clients set nom = 'Hack' where id = cb;
  perform pg_temp.en_tant_qu_admin();
  select count(*) into n from public.clients where id = cb and nom = 'Hack';
  if n <> 0 then raise exception 'ECHEC isolation: A a modifié le client de B'; end if;

  -- ---------- 2. Liaison inter-ateliers refusée par la base (clé composite) ----------
  begin
    insert into public.commandes (atelier_id, code, client_id, total_fcfa) values (aa, 'CMD-X', cb, 1000);
    raise exception 'ECHEC clé composite: commande A liée à un client B';
  exception when foreign_key_violation then null;
  end;

  -- ---------- 3. Expiration : plus aucun accès métier ----------
  update public.abonnements set fin_at = now() - interval '1 second', debut_at = now() - interval '2 days' where atelier_id = aa;
  perform pg_temp.en_tant_que(ua);
  select count(*) into n from public.clients;
  if n <> 0 then raise exception 'ECHEC expiration: % clients visibles avec un abonnement expiré', n; end if;
  perform pg_temp.en_tant_qu_admin();
  update public.abonnements set fin_at = now() + interval '10 days' where atelier_id = aa;

  -- ---------- 4. Employé sans permission ----------
  perform pg_temp.en_tant_que(ue);
  select count(*) into n from public.clients;
  if n <> 0 then raise exception 'ECHEC permissions: employé sans clients.voir voit % clients', n; end if;
  perform pg_temp.en_tant_qu_admin();

  -- ---------- 5. Anti-escalade : un secrétaire ne peut ni s'attribuer un profil, ni modifier le sien ----------
  select id into v_prof from public.profils_acces where atelier_id = aa and nom = 'Secrétaire';
  insert into public.membre_profils_acces (user_id, profil_acces_id, atelier_id) values (ue, v_prof, aa);
  insert into public.profil_acces_permissions (profil_acces_id, atelier_id, permission_code)
    values (v_prof, aa, 'roles.attribuer'), (v_prof, aa, 'roles.modifier') on conflict do nothing;
  perform pg_temp.en_tant_que(ue);
  begin
    insert into public.membre_profils_acces (user_id, profil_acces_id, atelier_id)
      select ue, id, aa from public.profils_acces where atelier_id = aa and nom = 'Production';
    raise exception 'ECHEC escalade: auto-attribution possible';
  exception when raise_exception then
    if sqlerrm like 'ECHEC%' then raise; end if;
  end;
  begin
    insert into public.profil_acces_permissions (profil_acces_id, atelier_id, permission_code)
      values (v_prof, aa, 'employes.desactiver');
    raise exception 'ECHEC escalade: modification de son propre profil possible';
  exception when raise_exception then
    if sqlerrm like 'ECHEC%' then raise; end if;
  end;
  perform pg_temp.en_tant_qu_admin();

  -- ---------- 6. Code d'abonnement : usage unique, autre atelier refusé ----------
  insert into public.abonnements (atelier_id, duree_jours, statut) values (ab, 30, 'en_attente') returning id into v_hab;
  insert into public.codes_abonnement (atelier_id, abonnement_id, code_hash, valide_jusqu_a)
    values (ab, v_hab, v_code_hash, now() + interval '5 days');
  v_res := public.srv_activer_abonnement(aa, ua, v_code_hash);
  if (v_res->>'ok')::boolean then raise exception 'ECHEC code: un code de B a été accepté pour A'; end if;
  v_res := public.srv_activer_abonnement(ab, ub, v_code_hash);
  if not (v_res->>'ok')::boolean then raise exception 'ECHEC code: activation valide refusée (%)', v_res; end if;
  v_res := public.srv_activer_abonnement(ab, ub, v_code_hash);
  if (v_res->>'ok')::boolean or v_res->>'raison' <> 'utilise' then raise exception 'ECHEC code: double usage (%)', v_res; end if;

  -- ---------- 7. Production : un seul gagnant ----------
  insert into public.membre_profils_acces (user_id, profil_acces_id, atelier_id)
    select ue, id, aa from public.profils_acces where atelier_id = aa and nom = 'Production';
  select id into v_role from public.roles_production where atelier_id = aa and nom = 'Coupeur';
  insert into public.membre_roles_production (user_id, role_id, atelier_id) values (ue, v_role, aa);
  perform pg_temp.en_tant_que(ua);
  v_cmd := public.creer_commande(ca, null, 50000, 10000, null,
    jsonb_build_array(jsonb_build_object('type_libelle','Boubou',
      'circuit_modele_id', (select id from public.modeles_circuits where atelier_id = aa and nom = 'Simple'))));
  perform pg_temp.en_tant_qu_admin();
  select e.id into v_et from public.habit_etapes e join public.habits h on h.id = e.habit_id
   where h.commande_id = v_cmd and e.ordre = 1;
  perform pg_temp.en_tant_que(ue);
  perform public.prendre_etape(v_et, v_role);
  begin
    perform public.prendre_etape(v_et, v_role);
    raise exception 'ECHEC concurrence: seconde prise acceptée';
  exception when raise_exception then
    if sqlerrm not like '%DEJA_PRIS%' then raise; end if;
  end;
  perform public.terminer_etape(v_et);
  perform pg_temp.en_tant_qu_admin();

  -- ---------- 8. Calcul de fin d'abonnement (jour d'activation = jour 1, fin à 23:59:59 Bamako) ----------
  select ((date_trunc('day', timestamptz '2026-10-05 10:00:00+00' at time zone 'Africa/Bamako') + 30 * interval '1 day')
          at time zone 'Africa/Bamako') into v_ok_ts;
  raise notice 'Fin attendue pour 30 jours activés le 5 octobre 2026 : %', v_ok_ts;

  -- ---------- 9. Désactivation / réactivation / prolongation d'abonnement (scénarios D et E) ----------
  update public.abonnements set statut = 'desactive' where atelier_id = aa;
  perform pg_temp.en_tant_que(ua);
  select count(*) into n from public.clients;
  if n <> 0 then raise exception 'ECHEC desactivation: % clients visibles avec un abonnement désactivé', n; end if;
  perform pg_temp.en_tant_qu_admin();
  update public.abonnements set statut = 'actif' where atelier_id = aa;
  perform pg_temp.en_tant_que(ua);
  select count(*) into n from public.clients;
  if n <> 1 then raise exception 'ECHEC reactivation: accès non rétabli (% clients)', n; end if;
  perform pg_temp.en_tant_qu_admin();
  update public.abonnements set fin_at = now() - interval '1 hour', debut_at = now() - interval '2 days' where atelier_id = aa;
  select id into v_hab from public.abonnements where atelier_id = aa limit 1;
  perform public.srv_prolonger_abonnement(v_hab, 5, ua);
  perform pg_temp.en_tant_que(ua);
  select count(*) into n from public.clients;
  if n <> 1 then raise exception 'ECHEC prolongation: accès non rétabli après prolongation (% clients)', n; end if;
  perform pg_temp.en_tant_qu_admin();

  -- ---------- 10. Étape attribuée à une personne précise + rôle utilisé tracé (tests 11 et 14) ----------
  perform pg_temp.en_tant_que(ua);
  v_cmd := public.creer_commande(ca, null, 20000, 0, null, jsonb_build_array(jsonb_build_object('type_libelle','Chemise',
    'etapes', jsonb_build_array(jsonb_build_object('nom','Montage','mode','personne','user_id', ue)))));
  perform pg_temp.en_tant_qu_admin();
  select e.id into v_et from public.habit_etapes e join public.habits h on h.id = e.habit_id where h.commande_id = v_cmd;
  perform pg_temp.en_tant_que(ua);
  begin
    perform public.prendre_etape(v_et, null);
    raise exception 'ECHEC attribution: le propriétaire a pris une étape réservée à un autre employé';
  exception when raise_exception then
    if sqlerrm like 'ECHEC%' then raise; end if;
    if sqlerrm not like '%NON_ELIGIBLE%' then raise; end if;
  end;
  perform pg_temp.en_tant_que(ue);
  perform public.prendre_etape(v_et, v_role);
  perform pg_temp.en_tant_qu_admin();
  select count(*) into n from public.habit_etapes where id = v_et and pris_par = ue and role_utilise_id = v_role;
  if n <> 1 then raise exception 'ECHEC traçabilité: le rôle utilisé par l''employé n''est pas enregistré'; end if;

  -- ---------- 11. Essayages et retouches : isolation ----------
  insert into public.habits (atelier_id, commande_id, code, type_libelle) select aa, v_cmd, 'HAB-TEST-ESS', 'Test' returning id into v_hab;
  insert into public.essayages (atelier_id, habit_id, date_essayage) values (aa, v_hab, current_date);
  perform pg_temp.en_tant_que(ub);
  select count(*) into n from public.essayages;
  if n <> 0 then raise exception 'ECHEC isolation essayages: B voit % essayage(s) de A', n; end if;
  select count(*) into n from public.retouches;
  if n <> 0 then raise exception 'ECHEC isolation retouches'; end if;
  perform pg_temp.en_tant_qu_admin();

  -- ---------- 12. Tables réservées au serveur : inaccessibles aux utilisateurs ----------
  perform pg_temp.en_tant_que(ua);
  begin
    perform 1 from public.abonnements limit 1;
    raise exception 'ECHEC droits: un propriétaire peut lire la table abonnements';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.codes_abonnement limit 1;
    raise exception 'ECHEC droits: un propriétaire peut lire les codes d''abonnement';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.journal_audit (atelier_id, action) values (aa, 'faux');
    raise exception 'ECHEC audit: écriture directe dans le journal possible';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.en_tant_qu_admin();

  raise notice 'TOUS LES TESTS DE SECURITE SQL SONT PASSES';
end $$;

rollback;
