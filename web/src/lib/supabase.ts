import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
if (!url || !anon) console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes (voir web/.env.example)');

// Seule la clé PUBLIQUE (anon) est utilisée ici. La protection des données repose sur la RLS de la base.
export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const DOMAINE_EMPLOYES = (import.meta.env.VITE_EMPLOYEE_EMAIL_DOMAIN as string) || 'employes.couture-gestion.app';
