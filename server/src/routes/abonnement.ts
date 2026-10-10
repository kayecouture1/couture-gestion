import { Router } from 'express';
import { z } from 'zod';
import { admin } from '../lib/supabase';
import { env } from '../config/env';
import { HttpError, asyncHandler } from '../lib/http';
import { hasherCode } from '../lib/codes';
import { requireAuth, requireMembre, requireProprietaire } from '../middleware/auth';
import { limiteActivation } from '../middleware/limites';

export const abonnement = Router();

const MESSAGES: Record<string, string> = {
  invalide: 'Code invalide.',
  expire: "Ce code a expiré. Contactez l'administrateur pour en obtenir un nouveau.",
  utilise: 'Ce code a déjà été utilisé.',
  desactive: "Ce code a été désactivé. Contactez l'administrateur.",
};

// Activation du code par le PROPRIÉTAIRE de l'atelier. Vérification entièrement côté serveur / base.
abonnement.post(
  '/abonnement/activer',
  limiteActivation,
  requireAuth,
  requireMembre,
  requireProprietaire,
  asyncHandler(async (req, res) => {
    const { code } = z.object({ code: z.string().trim().min(8).max(40) }).parse(req.body);
    const userId = req.auth!.userId;
    const atelierId = req.auth!.ctx!.atelier!.id; // jamais lu dans la requête
    const ip = req.ip ?? 'inconnue';

    // Anti brute-force durable (en base) : par utilisateur et par adresse IP.
    const depuis = (ms: number) => new Date(Date.now() - ms).toISOString();
    const compter = (filtre: (q: any) => any) =>
      filtre(admin.from('tentatives_code').select('id', { count: 'exact', head: true }).eq('reussi', false));
    const [u15, u24, i10] = await Promise.all([
      compter((q) => q.eq('user_id', userId).gte('created_at', depuis(15 * 60_000))),
      compter((q) => q.eq('user_id', userId).gte('created_at', depuis(24 * 3_600_000))),
      compter((q) => q.eq('ip', ip).gte('created_at', depuis(10 * 60_000))),
    ]);
    if ((u15.count ?? 0) >= 5 || (u24.count ?? 0) >= 15 || (i10.count ?? 0) >= 10) {
      throw new HttpError(429, 'Trop de tentatives. Réessayez plus tard.', 'TROP_DE_TENTATIVES');
    }

    const hash = hasherCode(code, env.CODE_HMAC_SECRET);
    const { data, error } = await admin.rpc('srv_activer_abonnement', { p_atelier: atelierId, p_user: userId, p_hash: hash });
    if (error || !data) throw new HttpError(500, 'Erreur serveur');
    await admin.from('tentatives_code').insert({ user_id: userId, atelier_id: atelierId, ip, reussi: !!data.ok });

    if (!data.ok) throw new HttpError(400, MESSAGES[data.raison] ?? MESSAGES.invalide, 'CODE_REFUSE');
    res.json({ ok: true, message: 'Abonnement activé avec succès.', debut_at: data.debut_at, fin_at: data.fin_at });
  }),
);
