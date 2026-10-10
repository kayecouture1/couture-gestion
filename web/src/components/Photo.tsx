import { useQuery } from '@tanstack/react-query';
import { ImageOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Les photos sont dans un stockage PRIVÉ : on demande une adresse signée temporaire (soumise à la RLS).
export function useUrlPrivee(bucket: string, chemin?: string | null) {
  return useQuery({
    queryKey: ['url', bucket, chemin],
    enabled: !!chemin,
    staleTime: 45 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(chemin!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function Photo({ chemin, alt, bucket = 'photos-habits', classe = 'photo' }: { chemin?: string | null; alt: string; bucket?: string; classe?: string }) {
  const { data } = useUrlPrivee(bucket, chemin);
  if (!chemin || !data) return <div className={`${classe} photo-vide`} aria-label={alt}><ImageOff size={20} /></div>;
  return <img className={classe} src={data} alt={alt} loading="lazy" />;
}

export const urlLogo = (chemin?: string | null) =>
  chemin ? supabase.storage.from('logos').getPublicUrl(chemin).data.publicUrl : null;
