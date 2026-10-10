import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

const handler = (_req: Request, res: Response) =>
  res.status(429).json({ erreur: 'Trop de requêtes. Veuillez patienter avant de réessayer.', code: 'TROP_DE_REQUETES' });

const base = { standardHeaders: true, legacyHeaders: false, handler } as const;

// Limiteurs en mémoire (par instance du serveur). Les compteurs durables des codes d'abonnement
// sont en plus tenus en base (table tentatives_code).
export const limiteGenerale = rateLimit({ ...base, windowMs: 60_000, limit: 300 });
export const limiteInscription = rateLimit({ ...base, windowMs: 3_600_000, limit: 8 });
export const limiteActivation = rateLimit({ ...base, windowMs: 600_000, limit: 20 });
export const limiteRechercheMinute = rateLimit({ ...base, windowMs: 60_000, limit: 15 });
export const limiteRechercheHeure = rateLimit({ ...base, windowMs: 3_600_000, limit: 120 });
export const limiteListeAteliers = rateLimit({ ...base, windowMs: 60_000, limit: 60 });
