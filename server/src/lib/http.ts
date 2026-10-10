import type { NextFunction, Request, RequestHandler, Response } from 'express';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Traduit une erreur renvoyée par Postgres (fonctions métier) en erreur HTTP lisible.
const MESSAGES_METIER: Record<string, [number, string]> = {
  ACCES_REFUSE: [403, "Vous n'avez pas l'autorisation d'effectuer cette action."],
  INTROUVABLE: [404, 'Élément introuvable.'],
  MONTANT_INVALIDE: [400, 'Montant invalide.'],
};

export function erreurDepuisPostgres(err: { message?: string } | null): HttpError {
  const msg = err?.message ?? '';
  for (const [code, [status, texte]] of Object.entries(MESSAGES_METIER)) {
    if (msg.includes(code)) return new HttpError(status, texte, code);
  }
  if (/row-level security|permission denied/i.test(msg)) {
    return new HttpError(403, "Vous n'avez pas l'autorisation d'effectuer cette action.", 'ACCES_REFUSE');
  }
  return new HttpError(500, 'Erreur serveur');
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ erreur: err.message, code: err.code });
  }
  if (err?.name === 'ZodError') {
    return res.status(400).json({
      erreur: 'Données invalides',
      details: err.issues.map((i: any) => ({ champ: i.path.join('.'), message: i.message })),
    });
  }
  if (err?.message === 'CORS') return res.status(403).json({ erreur: 'Origine non autorisée' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ erreur: 'Requête trop volumineuse' });
  // Jamais de corps de requête, de jeton ni de mot de passe dans les logs.
  console.error('[erreur]', err?.message ?? err);
  return res.status(500).json({ erreur: 'Erreur serveur' });
}
