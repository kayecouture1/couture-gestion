-- =====================================================================
-- COUTURE GESTION — 0005 : buckets Storage et politiques
-- Chemin imposé : <atelier_id>/... (premier segment = atelier de l'utilisateur)
--   logos          : lecture publique (non sensible), écriture par ceux qui gèrent les paramètres
--   photos-habits  : PRIVÉ (photos d'habits et de modèles)
--   documents      : PRIVÉ (factures PDF, écrites par le serveur)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('logos',         'logos',         true,  1048576, array['image/png','image/jpeg']),
  ('photos-habits', 'photos-habits', false, 3145728, array['image/jpeg','image/png','image/webp']),
  ('documents',     'documents',     false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- logos
create policy logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = private.mon_atelier_id()::text
              and private.acces('parametres.modifier'));
create policy logos_update on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = private.mon_atelier_id()::text
         and private.acces('parametres.modifier'))
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = private.mon_atelier_id()::text);
create policy logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = private.mon_atelier_id()::text
         and private.acces('parametres.modifier'));

-- photos des habits et des modèles
create policy photos_select on storage.objects for select to authenticated
  using (bucket_id = 'photos-habits' and (storage.foldername(name))[1] = private.mon_atelier_id()::text
         and private.acces_un_de(array['habits.voir','production.prendre','commandes.voir','modeles.gerer']));
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos-habits' and (storage.foldername(name))[1] = private.mon_atelier_id()::text
              and private.acces_un_de(array['commandes.creer','commandes.modifier','modeles.gerer']));
create policy photos_update on storage.objects for update to authenticated
  using (bucket_id = 'photos-habits' and (storage.foldername(name))[1] = private.mon_atelier_id()::text
         and private.acces_un_de(array['commandes.creer','commandes.modifier','modeles.gerer']))
  with check (bucket_id = 'photos-habits' and (storage.foldername(name))[1] = private.mon_atelier_id()::text);

-- documents (factures) : lecture seulement ; l'écriture est faite par le serveur (service_role)
create policy documents_select on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = private.mon_atelier_id()::text
         and private.acces('factures.voir'));
