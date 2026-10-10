-- =====================================================================
-- COUTURE GESTION — 0004 : RLS, droits de colonnes, droits des fonctions
-- Principe : accès refusé par défaut. Chaque politique impose
--   atelier_id = atelier de l'utilisateur  ET  abonnement actif  ET  permission.
-- =====================================================================

-- RLS activée sur TOUTES les tables du schéma public
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Générateur de politiques : listes de permissions (au moins une suffit).
-- '*' dans p_sel = tout membre actif d'un atelier à l'abonnement actif.
create or replace procedure private.politiques(
  p_table text, p_sel text[], p_ins text[], p_upd text[], p_del text[]
) language plpgsql as $$
begin
  if p_sel is not null then
    if p_sel = array['*'] then
      execute format('create policy %I on public.%I for select to authenticated
        using (atelier_id = private.mon_atelier_id() and private.membre_abonne())', p_table || '_sel', p_table);
    else
      execute format('create policy %I on public.%I for select to authenticated
        using (atelier_id = private.mon_atelier_id() and private.acces_un_de(%L::text[]))',
        p_table || '_sel', p_table, p_sel);
    end if;
  end if;
  if p_ins is not null then
    execute format('create policy %I on public.%I for insert to authenticated
      with check (atelier_id = private.mon_atelier_id() and private.acces_un_de(%L::text[]))',
      p_table || '_ins', p_table, p_ins);
  end if;
  if p_upd is not null then
    execute format('create policy %I on public.%I for update to authenticated
      using (atelier_id = private.mon_atelier_id() and private.acces_un_de(%L::text[]))
      with check (atelier_id = private.mon_atelier_id() and private.acces_un_de(%L::text[]))',
      p_table || '_upd', p_table, p_upd, p_upd);
  end if;
  if p_del is not null then
    execute format('create policy %I on public.%I for delete to authenticated
      using (atelier_id = private.mon_atelier_id() and private.acces_un_de(%L::text[]))',
      p_table || '_del', p_table, p_del);
  end if;
end $$;

-- ---------- Clients et mesures ----------
call private.politiques('clients',
  array['clients.voir','commandes.voir','commandes.creer'], array['clients.creer'], array['clients.modifier'], null::text[]);
call private.politiques('client_mesures',
  array['mesures.voir','commandes.creer'], array['mesures.modifier'], array['mesures.modifier'], array['mesures.modifier']);
call private.politiques('mesure_champs',
  array['*'], array['parametres.modifier'], array['parametres.modifier'], null::text[]);

-- ---------- Catalogue et circuits ----------
call private.politiques('types_vetements', array['*'], array['parametres.modifier'], array['parametres.modifier'], null::text[]);
call private.politiques('modeles', array['*'], array['modeles.gerer'], array['modeles.gerer'], null::text[]);
call private.politiques('emplacements', array['*'], array['emplacements.gerer'], array['emplacements.gerer'], null::text[]);
call private.politiques('modeles_circuits', array['*'], array['circuits.gerer'], array['circuits.gerer'], null::text[]);
call private.politiques('modeles_circuits_etapes', array['*'], array['circuits.gerer'], array['circuits.gerer'], array['circuits.gerer']);

-- ---------- Rôles, profils d'accès ----------
call private.politiques('roles_production', array['*'], array['roles.creer'], array['roles.modifier'], null::text[]);
call private.politiques('membre_roles_production', array['*'], array['roles.attribuer'], null::text[], array['roles.attribuer']);
call private.politiques('profils_acces',
  array['roles.voir','roles.creer','roles.modifier','roles.attribuer','employes.voir','employes.creer'],
  array['roles.creer'], array['roles.modifier'], null::text[]);
call private.politiques('profil_acces_permissions',
  array['roles.voir','roles.creer','roles.modifier','roles.attribuer','employes.voir','employes.creer'],
  array['roles.creer','roles.modifier'], null::text[], array['roles.modifier']);
call private.politiques('membre_profils_acces',
  array['roles.voir','roles.creer','roles.modifier','roles.attribuer','employes.voir','employes.creer'],
  array['roles.attribuer'], null::text[], array['roles.attribuer']);

-- ---------- Commandes, habits (écritures via fonctions RPC) ----------
call private.politiques('commandes', array['commandes.voir','rendez_vous.voir'], null::text[],
  array['commandes.modifier','rendez_vous.gerer'], null::text[]);
call private.politiques('habits', array['habits.voir','habits.voir_circuit','production.prendre','commandes.voir'],
  null::text[], array['commandes.modifier'], null::text[]);
call private.politiques('habit_etapes', array['habits.voir','habits.voir_circuit','production.prendre','commandes.voir'],
  null::text[], null::text[], null::text[]);
call private.politiques('paiements', array['paiements.voir'], null::text[], null::text[], null::text[]);
call private.politiques('factures', array['factures.voir'], null::text[], null::text[], null::text[]);
call private.politiques('propositions_rdv', array['rendez_vous.voir'], null::text[], null::text[], null::text[]);
call private.politiques('depenses', array['depenses.voir'], array['depenses.creer'], array['depenses.modifier'], null::text[]);
call private.politiques('notifications', array['habits.voir','commandes.voir'], array['habits.confirmer_termine'], null::text[], null::text[]);
call private.politiques('journal_audit', array['audit.voir'], null::text[], null::text[], null::text[]);

-- ---------- Ateliers, profils, appartenances, permissions ----------
create policy ateliers_sel on public.ateliers for select to authenticated
  using (id = private.mon_atelier_id());
create policy ateliers_upd on public.ateliers for update to authenticated
  using (id = private.mon_atelier_id() and private.acces('parametres.modifier'))
  with check (id = private.mon_atelier_id() and private.acces('parametres.modifier'));

create policy profils_sel on public.profils for select to authenticated
  using (id = auth.uid()
         or exists (select 1 from public.membres_atelier m
                    where m.user_id = profils.id and m.atelier_id = private.mon_atelier_id()));
create policy profils_upd on public.profils for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy membres_sel on public.membres_atelier for select to authenticated
  using (atelier_id = private.mon_atelier_id());

create policy permissions_sel on public.permissions for select to authenticated using (true);

-- Tables réservées au serveur : RLS active, AUCUNE politique.
-- (super_admins, abonnements, codes_abonnement, abonnements_historique, tentatives_code, compteurs)

-- ---------- Valeurs par défaut utiles ----------
alter table public.clients       alter column created_by set default auth.uid();
alter table public.depenses      alter column created_by set default auth.uid();
alter table public.notifications alter column created_by set default auth.uid();

-- ---------- Droits sur les tables (défense en profondeur, en plus de la RLS) ----------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

revoke all on public.super_admins, public.abonnements, public.codes_abonnement,
              public.abonnements_historique, public.tentatives_code, public.compteurs
  from authenticated;

revoke insert, update, delete on public.membres_atelier, public.habit_etapes, public.paiements,
  public.factures, public.propositions_rdv, public.journal_audit, public.permissions from authenticated;

revoke insert, delete on public.commandes, public.habits, public.ateliers, public.profils from authenticated;
revoke delete on public.clients, public.depenses, public.roles_production, public.profils_acces,
  public.modeles, public.types_vetements, public.emplacements, public.modeles_circuits,
  public.mesure_champs, public.notifications from authenticated;

-- Mises à jour limitées à certaines colonnes
revoke update on public.commandes from authenticated;
grant  update (date_rdv, total_fcfa, note) on public.commandes to authenticated;

revoke update on public.habits from authenticated;
grant  update (photo_habit_path, photo_modele_path, mesures_utilisees, modele_libelle, type_libelle)
  on public.habits to authenticated;

revoke update on public.ateliers from authenticated;
grant  update (nom, telephone, adresse, logo_path, visible_public, capacite_jour, delai_min_jours, jours_travail)
  on public.ateliers to authenticated;

revoke update on public.profils from authenticated;
grant  update (nom, prenom, telephone, photo_path, doit_changer_mdp) on public.profils to authenticated;

-- ---------- Droits d'exécution des fonctions ----------
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind in ('f','p')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    if r.proname like 'srv\_%' then
      execute format('grant execute on function %s to service_role', r.sig);
    else
      execute format('grant execute on function %s to authenticated, service_role', r.sig);
    end if;
  end loop;
end $$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
