-- Autoriser la suppression des champs de mesure selon le même droit
-- que leur création et leur modification.
drop policy if exists mesure_champs_del on public.mesure_champs;

create policy mesure_champs_del on public.mesure_champs
  for delete to authenticated
  using (
    atelier_id = private.mon_atelier_id()
    and private.acces('parametres.modifier')
  );

drop policy if exists emplacements_del on public.emplacements;
create policy emplacements_del on public.emplacements
  for delete to authenticated
  using (
    atelier_id = private.mon_atelier_id()
    and private.acces('emplacements.gerer')
  );

drop policy if exists types_vetements_del on public.types_vetements;
create policy types_vetements_del on public.types_vetements
  for delete to authenticated
  using (
    atelier_id = private.mon_atelier_id()
    and private.acces('parametres.modifier')
  );

-- Une définition supprimée ne doit pas laisser des mesures de profil orphelines.
alter table public.client_mesures
  drop constraint if exists client_mesures_champ_id_atelier_id_fkey;

alter table public.client_mesures
  add constraint client_mesures_champ_id_atelier_id_fkey
  foreign key (champ_id, atelier_id)
  references public.mesure_champs(id, atelier_id)
  on delete cascade;
