import { supabase } from './supabase';
import { ApiError } from './erreurs';

const BASE = ((import.meta.env.VITE_API_URL as string) || '').replace(/\/$/, '');

export async function api<T = any>(
  chemin: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false) {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${chemin}`, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('Problème de connexion réseau. Vérifiez votre connexion puis réessayez.', 'RESEAU');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(json.details) && json.details.length ? ` (${json.details.map((d: any) => d.message).join(', ')})` : '';
    throw new ApiError((json.erreur ?? 'Erreur serveur') + detail, json.code, res.status);
  }
  return json as T;
}
