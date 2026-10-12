-- Le propriétaire dispose explicitement des droits de suppression des
-- catalogues de l'atelier. Les autres membres restent soumis à leur permission.

drop policy if exists mesure_champs_del on public.mesure_champs;
create policy mesure_champs_del on public.mesure_champs
  for delete to authenticated
  using (
    atelier_id = private.mon_atelier_id()
    and private.abonnement_actif(private.mon_atelier_id())
    and (
      private.est_proprietaire()
      or private.a_permission('parametres.modifier')
    )
  );

drop policy if exists emplacements_del on public.emplacements;
create policy emplacements_del on public.emplacements
  for delete to authenticated
  using (
    atelier_id = private.mon_atelier_id()
    and private.abonnement_actif(private.mon_atelier_id())
    and (
      private.est_proprietaire()
      or private.a_permission('emplacements.gerer')
    )
  );

drop policy if exists types_vetements_del on public.types_vetements;
create policy types_vetements_del on public.types_vetements
  for delete to authenticated
  using (
    atelier_id = private.mon_atelier_id()
    and private.abonnement_actif(private.mon_atelier_id())
    and (
      private.est_proprietaire()
      or private.a_permission('parametres.modifier')
    )
  );
