import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

// Client « service_role » : contourne la RLS. À n'utiliser qu'après contrôle d'identité et de droits.
export const admin: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, opts);

export const anon = (): SupabaseClient => createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, opts);

// Client « au nom de l'utilisateur » : la RLS s'applique comme s'il appelait Supabase directement.
export const userClient = (token: string): SupabaseClient =>
  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    ...opts,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
