-- Suppression contrôlée des éléments de catalogue.
-- La fonction vérifie les droits avant d'exécuter la suppression en
-- SECURITY DEFINER, ce qui évite qu'une politique RLS de la table cible
-- bloque une action pourtant autorisée.
create or replace function public.supprimer_catalogue(p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atelier uuid := private.mon_atelier_id();
  v_permission text;
begin
  if p_table not in ('mesure_champs', 'emplacements', 'types_vetements') then
    raise exception 'TABLE_NON_AUTORISEE';
  end if;

  v_permission := case p_table
    when 'emplacements' then 'emplacements.gerer'
    else 'parametres.modifier'
  end;

  if v_atelier is null
     or not private.abonnement_actif(v_atelier)
     or (not private.est_proprietaire() and not private.a_permission(v_permission)) then
    raise exception 'ACCES_REFUSE';
  end if;

  execute format(
    'delete from public.%I where id = $1 and atelier_id = $2',
    p_table
  ) using p_id, v_atelier;
end;
$$;

revoke all on function public.supprimer_catalogue(text, uuid) from public;
grant execute on function public.supprimer_catalogue(text, uuid) to authenticated;
