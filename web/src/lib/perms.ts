export interface Contexte {
  type: 'anonyme' | 'super_admin' | 'sans_atelier' | 'membre';
  est_proprietaire?: boolean;
  statut_membre?: string;
  identifiant?: string | null;
  doit_changer_mdp?: boolean;
  permissions?: string[];
  roles?: { id: string; nom: string }[];
  atelier?: {
    id: string; nom: string; code: string; logo_path: string | null; visible_public: boolean; statut: string;
    capacite_jour: number; delai_min_jours: number; jours_travail: number[];
  };
  abonnement?: { actif: boolean; statut: string; fin_at: string | null };
}

// Sert uniquement à l'AFFICHAGE. La vraie sécurité est dans la base (RLS) et dans l'API.
export const peut = (ctx: Contexte | null | undefined, ...codes: string[]) =>
  !!ctx?.permissions && codes.some((c) => ctx.permissions!.includes(c));
