-- Notifications persistantes pour les étapes de production disponibles.
create table public.notifications_taches (
  id          uuid primary key default gen_random_uuid(),
  atelier_id  uuid not null references public.ateliers(id) on delete cascade,
  etape_id    uuid not null references public.habit_etapes(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  lu_at       timestamptz,
  ignoree_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_taches_user_idx
  on public.notifications_taches(user_id, created_at desc);

create index notifications_taches_etape_idx
  on public.notifications_taches(etape_id);

alter table public.notifications_taches enable row level security;

create policy notifications_taches_sel on public.notifications_taches
  for select to authenticated
  using (user_id = auth.uid() and ignoree_at is null);

revoke all on public.notifications_taches from anon;
grant select on public.notifications_taches to authenticated;

create or replace function private.creer_notifications_etape()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.statut = 'disponible'
     and new.statut is distinct from 'disponible' then
    update public.notifications_taches
       set ignoree_at = coalesce(ignoree_at, now())
     where etape_id = new.id
       and ignoree_at is null;
  end if;

  if new.statut = 'disponible'
     and (tg_op = 'INSERT' or old.statut is distinct from 'disponible') then
    insert into public.notifications_taches (atelier_id, etape_id, user_id)
    select new.atelier_id, new.id, m.user_id
      from public.membres_atelier m
     where m.atelier_id = new.atelier_id
       and m.statut = 'actif'
       and (
         (new.mode = 'personne' and m.user_id = new.user_id)
         or (new.mode = 'role' and exists (
           select 1
             from public.membre_roles_production mr
             join public.roles_production r on r.id = mr.role_id
            where mr.user_id = m.user_id
              and mr.role_id = new.role_id
              and mr.atelier_id = new.atelier_id
              and r.actif
         ))
       )
       and not exists (
         select 1
           from public.notifications_taches n
          where n.etape_id = new.id
            and n.user_id = m.user_id
            and n.lu_at is null
            and n.ignoree_at is null
       );
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_etape_disponible on public.habit_etapes;
create trigger notifications_etape_disponible
after insert or update of statut on public.habit_etapes
for each row execute function private.creer_notifications_etape();

-- Rattrape les tâches déjà disponibles au moment de l'installation.
insert into public.notifications_taches (atelier_id, etape_id, user_id)
select e.atelier_id, e.id, m.user_id
  from public.habit_etapes e
  join public.membres_atelier m
    on m.atelier_id = e.atelier_id
   and m.statut = 'actif'
 where e.statut = 'disponible'
   and (
     (e.mode = 'personne' and m.user_id = e.user_id)
     or (e.mode = 'role' and exists (
       select 1
         from public.membre_roles_production mr
         join public.roles_production r on r.id = mr.role_id
        where mr.user_id = m.user_id
          and mr.role_id = e.role_id
          and mr.atelier_id = e.atelier_id
          and r.actif
     ))
   )
   and not exists (
     select 1
       from public.notifications_taches n
      where n.etape_id = e.id
        and n.user_id = m.user_id
        and n.lu_at is null
        and n.ignoree_at is null
   );

create or replace function public.marquer_notification_tache(
  p_notification uuid,
  p_action text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_action not in ('lue', 'ignoree') then
    raise exception 'ACTION_INVALIDE';
  end if;

  update public.notifications_taches
     set lu_at = case when p_action = 'lue' then now() else lu_at end,
         ignoree_at = case when p_action = 'ignoree' then now() else ignoree_at end
   where id = p_notification
     and user_id = auth.uid()
     and ignoree_at is null;

  if not found then raise exception 'INTROUVABLE'; end if;
end;
$$;

revoke all on function public.marquer_notification_tache(uuid, text) from public;
grant execute on function public.marquer_notification_tache(uuid, text) to authenticated;
