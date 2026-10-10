-- =====================================================================
-- COUTURE GESTION — 0006 : modules complémentaires
-- Essayages, retouches, statistiques, export des données, paramètres globaux,
-- photos de profil, suppression de rôles non utilisés.
-- =====================================================================

-- ---------- Nouvelles permissions ----------
insert into public.permissions (code, libelle, groupe) values
  ('essayages.voir',    'Voir les essayages',                   'Essayages'),
  ('essayages.gerer',   'Planifier et gérer les essayages',     'Essayages'),
  ('retouches.voir',    'Voir les retouches',                   'Retouches'),
  ('retouches.gerer',   'Demander et gérer les retouches',      'Retouches'),
  ('statistiques.voir', 'Voir les statistiques',                'Paramètres'),
  ('donnees.exporter',  'Exporter les données de l''atelier',   'Paramètres')
on conflict (code) do nothing;

-- ---------- Essayages ----------
create table public.essayages (
  id            uuid primary key default gen_random_uuid(),
  atelier_id    uuid not null,
  habit_id      uuid not null,
  date_essayage date not null,
  heure         text check (heure is null or heure ~ '^[0-2][0-9]:[0-5][0-9]$'),
  statut        text not null default 'planifie' check (statut in ('planifie','effectue','annule')),
  note          text,
  created_by    uuid references auth.users(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  foreign key (habit_id, atelier_id) references public.habits(id, atelier_id)
);
create index on public.essayages(atelier_id, statut, date_essayage);
create index on public.essayages(habit_id);

-- ---------- Retouches ----------
create table public.retouches (
  id          uuid primary key default gen_random_uuid(),
  atelier_id  uuid not null,
  habit_id    uuid not null,
  description text not null check (char_length(description) between 3 and 500),
  statut      text not null default 'demandee' check (statut in ('demandee','en_cours','terminee','annulee')),
  date_prevue date,
  cout_fcfa   bigint not null default 0 check (cout_fcfa >= 0),
  note        text,
  created_by  uuid references auth.users(id) default auth.uid(),
  created_at  timestamptz not null default now(),
  termine_at  timestamptz,
  foreign key (habit_id, atelier_id) references public.habits(id, atelier_id)
);
create index on public.retouches(atelier_id, statut);
create index on public.retouches(habit_id);

-- ---------- Paramètres globaux (Super Admin, accès serveur uniquement) ----------
create table public.parametres_globaux (
  cle        text primary key,
  valeur     jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.parametres_globaux (cle, valeur) values
  ('duree_abonnement_defaut_jours',  '30'::jsonb),
  ('fenetre_activation_defaut_jours','30'::jsonb),
  ('contact_support',                '""'::jsonb)
on conflict (cle) do nothing;

alter table public.essayages          enable row level security;
alter table public.retouches          enable row level security;
alter table public.parametres_globaux enable row level security;

call private.politiques('essayages', array['essayages.voir'], array['essayages.gerer'], array['essayages.gerer'], null::text[]);
call private.politiques('retouches', array['retouches.voir'], array['retouches.gerer'], array['retouches.gerer'], null::text[]);

create trigger audit_essayages after insert or update on public.essayages for each row execute function private.trg_audit();
create trigger audit_retouches after insert or update on public.retouches for each row execute function private.trg_audit();

-- ---------- Suppression d'un rôle de production NON utilisé ----------
-- Les clés étrangères empêchent la suppression d'un rôle déjà attribué ou présent dans un circuit / un historique :
-- il faut alors le désactiver (l'historique est conservé).
create policy roles_production_del on public.roles_production for delete to authenticated
  using (atelier_id = private.mon_atelier_id() and private.acces('roles.modifier'));
grant delete on public.roles_production to authenticated;

-- ---------- Photos de profil (bucket privé) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', false, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = private.mon_atelier_id()::text and private.membre_abonne());
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = private.mon_atelier_id()::text
              and private.membre_abonne() and storage.filename(name) like (auth.uid()::text || '%'));
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = private.mon_atelier_id()::text
         and storage.filename(name) like (auth.uid()::text || '%'))
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = private.mon_atelier_id()::text
              and storage.filename(name) like (auth.uid()::text || '%'));

-- ---------- Profils par défaut : nouvelles permissions ----------
create or replace function public.srv_completer_profils(p_atelier uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profil_acces_permissions (profil_acces_id, atelier_id, permission_code)
  select pa.id, p_atelier, unnest(array['essayages.voir','essayages.gerer','retouches.voir','retouches.gerer'])
    from public.profils_acces pa where pa.atelier_id = p_atelier and pa.nom = 'Secrétaire'
  on conflict do nothing;
  insert into public.profil_acces_permissions (profil_acces_id, atelier_id, permission_code)
  select pa.id, p_atelier, 'retouches.voir'
    from public.profils_acces pa where pa.atelier_id = p_atelier and pa.nom = 'Production'
  on conflict do nothing;
end $$;

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
  perform public.srv_completer_profils(v);
  return v;
end $$;

-- ---------- Statistiques (calculées sur les données réelles de l'atelier) ----------
create or replace function public.statistiques_atelier(p_mois int default 6) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_at uuid := private.mon_atelier_id();
  v_debut date; v_mois jsonb; v_types jsonb; v_etapes jsonb; v_emp jsonb; v_tot jsonb;
begin
  if v_at is null or not private.acces('statistiques.voir') then raise exception 'ACCES_REFUSE'; end if;
  if p_mois is null or p_mois < 1 or p_mois > 24 then p_mois := 6; end if;
  v_debut := (date_trunc('month', now() at time zone 'Africa/Bamako') - make_interval(months => p_mois - 1))::date;

  select coalesce(jsonb_agg(jsonb_build_object(
      'mois', to_char(m.d, 'YYYY-MM'),
      'encaisse', coalesce((select sum(p.montant_fcfa) from public.paiements p
                             where p.atelier_id = v_at and p.annule_at is null
                               and date_trunc('month', p.paye_le at time zone 'Africa/Bamako')::date = m.d::date), 0),
      'depenses', coalesce((select sum(d.montant_fcfa) from public.depenses d
                             where d.atelier_id = v_at and d.archived_at is null
                               and date_trunc('month', d.date_depense)::date = m.d::date), 0),
      'commandes', (select count(*) from public.commandes c
                     where c.atelier_id = v_at and c.statut <> 'annulee'
                       and date_trunc('month', c.created_at at time zone 'Africa/Bamako')::date = m.d::date)
    ) order by m.d), '[]'::jsonb)
    into v_mois
    from generate_series(v_debut::timestamp, v_debut::timestamp + make_interval(months => p_mois - 1), interval '1 month') as m(d);

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_types from (
    select h.type_libelle as type, count(*) as nombre from public.habits h
     where h.atelier_id = v_at and h.statut <> 'annule' and h.created_at >= v_debut
     group by h.type_libelle order by count(*) desc limit 6) t;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_etapes from (
    select e.nom as etape, count(*) as nombre, round(avg(e.duree_secondes))::int as duree_moyenne_s
      from public.habit_etapes e
     where e.atelier_id = v_at and e.statut = 'terminee' and e.termine_a >= v_debut
     group by e.nom order by count(*) desc limit 10) t;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_emp from (
    select e.pris_par as user_id, count(*) as nombre, coalesce(sum(e.duree_secondes), 0)::int as duree_totale_s
      from public.habit_etapes e
     where e.atelier_id = v_at and e.statut = 'terminee' and e.termine_a >= v_debut and e.pris_par is not null
     group by e.pris_par order by count(*) desc limit 20) t;

  select jsonb_build_object(
    'habits_termines', (select count(*) from public.habits h where h.atelier_id = v_at and h.statut = 'termine' and h.valide_at >= v_debut),
    'commandes', (select count(*) from public.commandes c where c.atelier_id = v_at and c.statut <> 'annulee' and c.created_at >= v_debut),
    'reste_a_encaisser', coalesce((select sum(c.total_fcfa - coalesce((select sum(p.montant_fcfa) from public.paiements p
                                    where p.commande_id = c.id and p.annule_at is null), 0))
                                    from public.commandes c where c.atelier_id = v_at and c.statut = 'en_cours'), 0)
  ) into v_tot;

  return jsonb_build_object('depuis', v_debut, 'mois', v_mois, 'types', v_types, 'etapes', v_etapes, 'employes', v_emp, 'totaux', v_tot);
end $$;

-- ---------- Export complet des données d'un atelier (JSON) ----------
create or replace function public.exporter_atelier() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_at uuid := private.mon_atelier_id();
begin
  if v_at is null or not private.acces('donnees.exporter') then raise exception 'ACCES_REFUSE'; end if;
  return jsonb_build_object(
    'export_le', now(), 'version', 1,
    'atelier', (select to_jsonb(a) - 'est_demo' from public.ateliers a where a.id = v_at),
    'clients', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.clients t where t.atelier_id = v_at),
    'mesure_champs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.mesure_champs t where t.atelier_id = v_at),
    'client_mesures', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.client_mesures t where t.atelier_id = v_at),
    'types_vetements', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.types_vetements t where t.atelier_id = v_at),
    'modeles', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.modeles t where t.atelier_id = v_at),
    'roles_production', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.roles_production t where t.atelier_id = v_at),
    'modeles_circuits', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.modeles_circuits t where t.atelier_id = v_at),
    'modeles_circuits_etapes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.modeles_circuits_etapes t where t.atelier_id = v_at),
    'emplacements', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.emplacements t where t.atelier_id = v_at),
    'commandes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.commandes t where t.atelier_id = v_at),
    'habits', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.habits t where t.atelier_id = v_at),
    'habit_etapes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.habit_etapes t where t.atelier_id = v_at),
    'paiements', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.paiements t where t.atelier_id = v_at),
    'factures', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.factures t where t.atelier_id = v_at),
    'depenses', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.depenses t where t.atelier_id = v_at),
    'essayages', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.essayages t where t.atelier_id = v_at),
    'retouches', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.retouches t where t.atelier_id = v_at),
    'propositions_rdv', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.propositions_rdv t where t.atelier_id = v_at)
  );
  -- (l'écriture dans le journal est faite par l'API appelante)
end $$;

create or replace function public.journaliser_export() returns void
language plpgsql security definer set search_path = '' as $$
declare v_at uuid := private.mon_atelier_id();
begin
  if v_at is null or not private.acces('donnees.exporter') then raise exception 'ACCES_REFUSE'; end if;
  perform private.journaliser(v_at, 'atelier.exporte', 'ateliers', v_at::text, '{}'::jsonb);
end $$;

-- ---------- Droits des nouvelles tables et fonctions ----------
revoke all on public.essayages, public.retouches, public.parametres_globaux from anon;
revoke all on public.parametres_globaux from authenticated;
revoke delete on public.essayages, public.retouches from authenticated;

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
