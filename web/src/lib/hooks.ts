import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export interface Membre {
  user_id: string; est_proprietaire: boolean; statut: string; identifiant_interne: string | null;
  nom: string; prenom: string; email: string | null; telephone: string | null; photo_path: string | null;
}

export interface ProfilAcces {
  id: string;
  nom: string;
  description: string | null;
  permissions: string[];
}

// Membres de l'atelier avec leur identité (deux lectures sous RLS : membres_atelier puis profils).
export function useMembres() {
  return useQuery({
    queryKey: ['membres'],
    queryFn: async (): Promise<Membre[]> => {
      const { data: m, error } = await supabase.from('membres_atelier').select('user_id, est_proprietaire, statut, identifiant_interne');
      if (error) throw error;
      const ids = (m ?? []).map((x: any) => x.user_id);
      if (!ids.length) return [];
      const { data: p, error: e2 } = await supabase.from('profils').select('id, nom, prenom, email, telephone, photo_path').in('id', ids);
      if (e2) throw e2;
      const parId = new Map<string, any>((p ?? []).map((x: any) => [x.id, x] as [string, any]));
      return (m ?? []).map((x: any) => ({ ...x, nom: parId.get(x.user_id)?.nom ?? '?', prenom: parId.get(x.user_id)?.prenom ?? '', email: parId.get(x.user_id)?.email ?? null, telephone: parId.get(x.user_id)?.telephone ?? null, photo_path: parId.get(x.user_id)?.photo_path ?? null }))
        .sort((a, b) => Number(b.est_proprietaire) - Number(a.est_proprietaire) || a.nom.localeCompare(b.nom));
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles-production'],
    queryFn: async () => { const { data, error } = await supabase.from('roles_production').select('id, nom, description, actif').order('nom'); if (error) throw error; return data as { id: string; nom: string; description: string | null; actif: boolean }[]; },
  });
}

export function useProfilsAcces() {
  return useQuery({
    queryKey: ['profils-acces'],
    queryFn: async (): Promise<ProfilAcces[]> => {
      const { data, error } = await supabase.from('profils_acces').select('id, nom, description, profil_acces_permissions(permission_code)').order('nom');
      if (error) throw error;
      return (data ?? []).map((p: any): ProfilAcces => ({ id: p.id as string, nom: p.nom as string, description: p.description as string | null, permissions: (p.profil_acces_permissions ?? []).map((x: any) => x.permission_code as string) }));
    },
  });
}

export function useEmplacements() {
  return useQuery({ queryKey: ['emplacements'], queryFn: async () => { const { data, error } = await supabase.from('emplacements').select('id, nom, actif').order('nom'); if (error) throw error; return data as { id: string; nom: string; actif: boolean }[]; } });
}

export function useTypesVetements() {
  return useQuery({ queryKey: ['types-vetements'], queryFn: async () => { const { data, error } = await supabase.from('types_vetements').select('id, nom, actif').order('nom'); if (error) throw error; return data as { id: string; nom: string; actif: boolean }[]; } });
}

export function useCircuits() {
  return useQuery({
    queryKey: ['modeles-circuits'],
    queryFn: async () => {
      const { data, error } = await supabase.from('modeles_circuits').select('id, nom, actif, modeles_circuits_etapes(id, ordre, nom, mode, role_id, user_id)').order('nom');
      if (error) throw error;
      return (data ?? []).map((c: any) => ({ ...c, etapes: [...(c.modeles_circuits_etapes ?? [])].sort((a: any, b: any) => a.ordre - b.ordre) })) as any[];
    },
  });
}
