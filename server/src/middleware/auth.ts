import type { NextFunction, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { admin, userClient } from '../lib/supabase';
import { HttpError, asyncHandler } from '../lib/http';

export interface Contexte {
  type: 'anonyme' | 'super_admin' | 'sans_atelier' | 'membre';
  est_proprietaire?: boolean;
  statut_membre?: string;
  permissions?: string[];
  atelier?: { id: string; code: string; nom: string; logo_path: string | null };
  abonnement?: { actif: boolean; statut: string; fin_at: string | null };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; token: string; db: SupabaseClient; ctx?: Contexte };
    }
  }
}

// 1) Vérifie le jeton auprès de Supabase Auth (session valide, non révoquée, utilisateur non bloqué).
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const h = req.headers.authorization;
  const token = h && h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Authentification requise', 'NON_AUTHENTIFIE');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Session invalide ou expirée', 'SESSION_INVALIDE');
  req.auth = { userId: data.user.id, token, db: userClient(token) };
  next();
});

// 2) Charge le contexte depuis la BASE (source de vérité unique des permissions : pas de duplication ici).
export const requireMembre = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const { data, error } = await req.auth!.db.rpc('mon_contexte');
  if (error || !data) throw new HttpError(500, 'Erreur serveur');
  const ctx = data as Contexte;
  if (ctx.type !== 'membre') throw new HttpError(403, "Aucun atelier n'est associé à ce compte.", 'ACCES_REFUSE');
  if (ctx.statut_membre !== 'actif') throw new HttpError(403, 'Ce compte est désactivé.', 'COMPTE_DESACTIVE');
  req.auth!.ctx = ctx;
  next();
});

export const requireAbonnement = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth?.ctx?.abonnement?.actif) {
    return next(new HttpError(402, "L'abonnement de l'atelier n'est pas actif.", 'ABONNEMENT_REQUIS'));
  }
  next();
};

export const requireProprietaire = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth?.ctx?.est_proprietaire) {
    return next(new HttpError(403, "Réservé au propriétaire de l'atelier.", 'ACCES_REFUSE'));
  }
  next();
};

export const requirePermission = (code: string) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth?.ctx?.permissions?.includes(code)) {
    return next(new HttpError(403, "Vous n'avez pas l'autorisation d'effectuer cette action.", 'ACCES_REFUSE'));
  }
  next();
};

// Super Administrateur : vérifié dans la table super_admins, jamais d'après un champ envoyé par le navigateur.
export const requireSuperAdmin = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const { data, error } = await admin.from('super_admins').select('user_id').eq('user_id', req.auth!.userId).maybeSingle();
  if (error) throw new HttpError(500, 'Erreur serveur');
  if (!data) throw new HttpError(403, 'Accès refusé', 'ACCES_REFUSE');
  next();
});
