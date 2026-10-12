-- Les types de vêtements décrivent désormais la matière ou la finition.
-- Les anciens types par défaut ne sont supprimés que s'ils ne sont pas
-- utilisés par un habit ou un modèle existant.
do $$
declare
  v_atelier uuid;
begin
  for v_atelier in select id from public.ateliers loop
    delete from public.types_vetements t
    where t.atelier_id = v_atelier
      and t.nom in (
        'Boubou', 'Grand boubou', 'Chemise', 'Pantalon', 'Costume',
        'Robe', 'Jupe', 'Ensemble pagne', 'Tunique', 'Autre'
      )
      and not exists (
        select 1 from public.habits h
        where h.type_vetement_id = t.id
      )
      and not exists (
        select 1 from public.modeles m
        where m.type_vetement_id = t.id
      );

    insert into public.types_vetements (atelier_id, nom)
    select v_atelier, noms.nom
    from (values ('Bazin'), ('Tissu'), ('Wax'), ('Brodé')) as noms(nom)
    where not exists (
      select 1 from public.types_vetements t
      where t.atelier_id = v_atelier and t.nom = noms.nom
    );
  end loop;
end $$;
