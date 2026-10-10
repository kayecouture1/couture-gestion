import { Router } from 'express';
import { z } from 'zod';
import { admin } from '../lib/supabase';
import { env } from '../config/env';
import { HttpError, asyncHandler } from '../lib/http';
import { genererCode, hasherCode } from '../lib/codes';
import { requireAuth, requireSuperAdmin } from '../middleware/auth';

export const adminRoutes = Router();
adminRoutes.use('/admin', requireAuth, requireSuperAdmin);

const uuid = z.string().uuid();

async function historiser(atelierId: string, abonnementId: string | null, action: string, acteur: string, details: object = {}) {
  await admin.from('abonnements_historique').insert({
    atelier_id: atelierId, abonnement_id: abonnementId, action, acteur_id: acteur, details,
  });
}

type Abo = { id: string; atelier_id: string; statut: string; debut_at: string | null; fin_at: string | null; duree_jours: number };
export function etatAbonnement(a: Pick<Abo, 'statut' | 'debut_at' | 'fin_at'>, now = new Date()): 'en_attente' | 'actif' | 'a_venir' | 'expire' | 'desactive' {
  if (a.statut === 'desactive') return 'desactive';
  if (a.statut === 'en_attente') return 'en_attente';
  if (a.fin_at && new Date(a.fin_at) <= now) return 'expire';
  if (a.debut_at && new Date(a.debut_at) > now) return 'a_venir';
  return 'actif';
}

function etatAtelier(statutAtelier: string, abos: Abo[]): 'desactive' | 'actif' | 'expire' | 'en_attente' {
  if (statutAtelier === 'desactive') return 'desactive';
  const etats = abos.map((a) => etatAbonnement(a));
  if (etats.includes('actif')) return 'actif';
  if (etats.includes('expire')) return 'expire';
  return 'en_attente';
}

adminRoutes.get('/admin/ateliers', asyncHandler(async (_req, res) => {
  const [{ data: ateliers, error }, { data: abos }, { data: membres }] = await Promise.all([
    admin.from('ateliers').select('id, nom, code_atelier, statut, visible_public, est_demo, created_at').order('created_at', { ascending: false }),
    admin.from('abonnements').select('id, atelier_id, statut, debut_at, fin_at, duree_jours'),
    admin.from('membres_atelier').select('atelier_id, est_proprietaire, statut'),
  ]);
  if (error) throw new HttpError(500, 'Erreur serveur');
  const liste = (ateliers ?? []).map((a: any) => {
    const mine = ((abos ?? []) as Abo[]).filter((x) => x.atelier_id === a.id);
    const fins = mine.map((x) => x.fin_at).filter(Boolean).sort() as string[];
    return {
      ...a,
      etat: etatAtelier(a.statut, mine),
      fin_abonnement: fins.length ? fins[fins.length - 1] : null,
      nb_membres: (membres ?? []).filter((m: any) => m.atelier_id === a.id && m.statut === 'actif').length,
    };
  });
  res.json({ ateliers: liste });
}));

adminRoutes.get('/admin/stats', asyncHandler(async (_req, res) => {
  const [{ data: ateliers }, { data: abos }] = await Promise.all([
    admin.from('ateliers').select('id, statut, est_demo'),
    admin.from('abonnements').select('id, atelier_id, statut, debut_at, fin_at, duree_jours'),
  ]);
  const reels = (ateliers ?? []).filter((a: any) => !a.est_demo);
  const compte: Record<string, number> = { actif: 0, expire: 0, desactive: 0, en_attente: 0 };
  for (const a of reels as any[]) {
    compte[etatAtelier(a.statut, ((abos ?? []) as Abo[]).filter((x) => x.atelier_id === a.id))]++;
  }
  const ab: Record<string, number> = { actif: 0, expire: 0, a_venir: 0, desactive: 0, en_attente: 0 };
  for (const a of (abos ?? []) as Abo[]) ab[etatAbonnement(a)]++;
  res.json({ ateliers: { total: reels.length, ...compte }, abonnements: ab });
}));

adminRoutes.get('/admin/ateliers/:id', asyncHandler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { data: atelier } = await admin.from('ateliers')
    .select('id, nom, code_atelier, statut, telephone, adresse, visible_public, est_demo, created_at').eq('id', id).maybeSingle();
  if (!atelier) throw new HttpError(404, 'Atelier introuvable.');
  const [{ data: abos }, { data: codes }, { data: hist }, { data: prop }] = await Promise.all([
    admin.from('abonnements').select('*').eq('atelier_id', id).order('created_at', { ascending: false }),
    admin.from('codes_abonnement').select('id, abonnement_id, apercu, valide_jusqu_a, statut, utilise_at, created_at').eq('atelier_id', id),
    admin.from('abonnements_historique').select('*').eq('atelier_id', id).order('created_at', { ascending: false }).limit(200),
    admin.from('membres_atelier').select('user_id').eq('atelier_id', id).eq('est_proprietaire', true).maybeSingle(),
  ]);
  let proprietaire = null;
  if (prop) {
    const { data: p } = await admin.from('profils').select('nom, prenom, telephone, email').eq('id', prop.user_id).maybeSingle();
    proprietaire = p;
  }
  res.json({
    atelier,
    proprietaire,
    abonnements: ((abos ?? []) as Abo[]).map((a) => ({
      ...a, etat: etatAbonnement(a), codes: (codes ?? []).filter((c: any) => c.abonnement_id === a.id),
    })),
    historique: hist ?? [],
  });
}));

adminRoutes.patch('/admin/ateliers/:id/statut', asyncHandler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { actif } = z.object({ actif: z.boolean() }).parse(req.body);
  const { data, error } = await admin.from('ateliers').update({ statut: actif ? 'actif' : 'desactive' }).eq('id', id).select('id').maybeSingle();
  if (error || !data) throw new HttpError(404, 'Atelier introuvable.');
  await historiser(id, null, actif ? 'atelier_reactive' : 'atelier_desactive', req.auth!.userId);
  res.json({ ok: true });
}));

// Création d'un abonnement : durée + fenêtre d'activation. Le code n'est montré QU'UNE FOIS.
adminRoutes.post('/admin/abonnements', asyncHandler(async (req, res) => {
  const b = z.object({
    atelier_id: uuid,
    duree_jours: z.number().int().min(1).max(3660),
    fenetre_jours: z.number().int().min(1).max(365).default(30),
    note: z.string().trim().max(300).optional(),
  }).parse(req.body);
  const { data: at } = await admin.from('ateliers').select('id').eq('id', b.atelier_id).maybeSingle();
  if (!at) throw new HttpError(404, 'Atelier introuvable.');

  const { data: abo, error } = await admin.from('abonnements')
    .insert({ atelier_id: b.atelier_id, duree_jours: b.duree_jours, note: b.note ?? null, cree_par: req.auth!.userId })
    .select('id').single();
  if (error || !abo) throw new HttpError(500, 'Erreur serveur');

  const code = genererCode();
  const valide = new Date(Date.now() + b.fenetre_jours * 86_400_000).toISOString();
  const { error: eCode } = await admin.from('codes_abonnement').insert({
    atelier_id: b.atelier_id, abonnement_id: abo.id, code_hash: hasherCode(code, env.CODE_HMAC_SECRET),
    apercu: code.slice(-4), valide_jusqu_a: valide,
  });
  if (eCode) {
    await admin.from('abonnements').delete().eq('id', abo.id);
    throw new HttpError(500, 'Erreur serveur');
  }
  await historiser(b.atelier_id, abo.id, 'abonnement_cree', req.auth!.userId, { duree_jours: b.duree_jours });
  await historiser(b.atelier_id, abo.id, 'code_genere', req.auth!.userId, { valide_jusqu_a: valide });
  res.status(201).json({ id: abo.id, code, valide_jusqu_a: valide, avertissement: "Ce code ne sera plus affichable. Copiez-le maintenant." });
}));

async function chargerAbo(id: string) {
  const { data } = await admin.from('abonnements').select('*').eq('id', id).maybeSingle();
  if (!data) throw new HttpError(404, 'Abonnement introuvable.');
  return data as Abo & { note: string | null };
}

// Nouveau code (l'ancien est invalidé) : seulement tant que l'abonnement n'est pas activé.
adminRoutes.post('/admin/abonnements/:id/regenerer-code', asyncHandler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { fenetre_jours } = z.object({ fenetre_jours: z.number().int().min(1).max(365).default(30) }).parse(req.body ?? {});
  const abo = await chargerAbo(id);
  if (abo.statut !== 'en_attente') throw new HttpError(400, "Un code ne peut être régénéré que pour un abonnement non encore activé.");
  await admin.from('codes_abonnement').update({ statut: 'remplace' }).eq('abonnement_id', id).eq('statut', 'non_utilise');
  const code = genererCode();
  const valide = new Date(Date.now() + fenetre_jours * 86_400_000).toISOString();
  const { error } = await admin.from('codes_abonnement').insert({
    atelier_id: abo.atelier_id, abonnement_id: id, code_hash: hasherCode(code, env.CODE_HMAC_SECRET),
    apercu: code.slice(-4), valide_jusqu_a: valide,
  });
  if (error) throw new HttpError(500, 'Erreur serveur');
  await historiser(abo.atelier_id, id, 'code_regenere', req.auth!.userId, { valide_jusqu_a: valide });
  res.json({ code, valide_jusqu_a: valide, avertissement: "Ce code ne sera plus affichable. Copiez-le maintenant." });
}));

adminRoutes.patch('/admin/abonnements/:id', asyncHandler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const b = z.object({
    debut_at: z.string().datetime().optional(),
    fin_at: z.string().datetime().optional(),
    duree_jours: z.number().int().min(1).max(3660).optional(),
    note: z.string().trim().max(300).optional(),
  }).parse(req.body);
  const abo = await chargerAbo(id);
  const maj: Record<string, unknown> = {};
  if (b.note !== undefined) maj.note = b.note;
  if (b.duree_jours !== undefined) {
    if (abo.statut !== 'en_attente') throw new HttpError(400, "La durée ne se modifie que avant activation.");
    maj.duree_jours = b.duree_jours;
  }
  if (b.debut_at || b.fin_at) {
    if (!abo.debut_at) throw new HttpError(400, "Les dates ne se modifient qu'après activation du code.");
    const debut = b.debut_at ?? abo.debut_at, fin = b.fin_at ?? (abo.fin_at as string);
    if (new Date(fin) <= new Date(debut)) throw new HttpError(400, 'La date de fin doit être après la date de début.');
    maj.debut_at = debut; maj.fin_at = fin;
  }
  if (!Object.keys(maj).length) throw new HttpError(400, 'Rien à modifier.');
  const { error } = await admin.from('abonnements').update(maj).eq('id', id);
  if (error) throw new HttpError(500, 'Erreur serveur');
  await historiser(abo.atelier_id, id, 'modifie', req.auth!.userId, { avant: { debut_at: abo.debut_at, fin_at: abo.fin_at, duree_jours: abo.duree_jours }, apres: maj });
  res.json({ ok: true });
}));

adminRoutes.post('/admin/abonnements/:id/prolonger', asyncHandler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { jours } = z.object({ jours: z.number().int().min(1).max(3660) }).parse(req.body);
  const { data, error } = await admin.rpc('srv_prolonger_abonnement', { p_id: id, p_jours: jours, p_acteur: req.auth!.userId });
  if (error) {
    if (/NON_ACTIVE/.test(error.message)) throw new HttpError(400, "Cet abonnement n'a pas encore été activé : rien à prolonger.");
    if (/INTROUVABLE/.test(error.message)) throw new HttpError(404, 'Abonnement introuvable.');
    throw new HttpError(500, 'Erreur serveur');
  }
  res.json(data);
}));

adminRoutes.post('/admin/abonnements/:id/desactiver', asyncHandler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const abo = await chargerAbo(id);
  await admin.from('abonnements').update({ statut: 'desactive' }).eq('id', id);
  await admin.from('codes_abonnement').update({ statut: 'desactive' }).eq('abonnement_id', id).eq('statut', 'non_utilise');
  await historiser(abo.atelier_id, id, 'desactive', req.auth!.userId);
  res.json({ ok: true });
}));

adminRoutes.post('/admin/abonnements/:id/reactiver', asyncHandler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const abo = await chargerAbo(id);
  if (abo.statut !== 'desactive') throw new HttpError(400, "Cet abonnement n'est pas désactivé.");
  if (!abo.debut_at) throw new HttpError(400, "Abonnement jamais activé : régénérez un code à la place.");
  if (new Date(abo.fin_at as string) <= new Date()) throw new HttpError(400, 'Abonnement expiré : prolongez-le pour le réactiver.');
  await admin.from('abonnements').update({ statut: 'actif' }).eq('id', id);
  await historiser(abo.atelier_id, id, 'reactive', req.auth!.userId);
  res.json({ ok: true });
}));

// Suppression : uniquement un abonnement jamais activé. Sinon : désactiver (l'historique est conservé).
adminRoutes.delete('/admin/abonnements/:id', asyncHandler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const abo = await chargerAbo(id);
  if (abo.debut_at) throw new HttpError(400, "Un abonnement déjà activé ne peut pas être supprimé (historique à conserver). Désactivez-le.");
  await historiser(abo.atelier_id, null, 'abonnement_supprime', req.auth!.userId, { abonnement_id: id });
  const { error } = await admin.from('abonnements').delete().eq('id', id);
  if (error) throw new HttpError(500, 'Erreur serveur');
  res.json({ ok: true });
}));

// ---------- Utilisateurs (vue globale) ----------
adminRoutes.get('/admin/utilisateurs', asyncHandler(async (_req, res) => {
  const [{ data: membres }, { data: profils }, { data: ateliers }, { data: sa }] = await Promise.all([
    admin.from('membres_atelier').select('user_id, atelier_id, est_proprietaire, statut, identifiant_interne, created_at'),
    admin.from('profils').select('id, nom, prenom, telephone, email'),
    admin.from('ateliers').select('id, nom'),
    admin.from('super_admins').select('user_id'),
  ]);
  const p = new Map((profils ?? []).map((x: any) => [x.id, x]));
  const a = new Map((ateliers ?? []).map((x: any) => [x.id, x.nom]));
  const supers = new Set((sa ?? []).map((x: any) => x.user_id));
  const utilisateurs = [
    ...(sa ?? []).map((s: any) => ({ user_id: s.user_id, nom: p.get(s.user_id)?.nom ?? '', prenom: p.get(s.user_id)?.prenom ?? '', email: p.get(s.user_id)?.email ?? null, role: 'super_admin', atelier: null, atelier_id: null, statut: 'actif', identifiant: null })),
    ...(membres ?? []).filter((m: any) => !supers.has(m.user_id)).map((m: any) => ({
      user_id: m.user_id, nom: p.get(m.user_id)?.nom ?? '', prenom: p.get(m.user_id)?.prenom ?? '',
      email: p.get(m.user_id)?.email ?? null, telephone: p.get(m.user_id)?.telephone ?? null,
      role: m.est_proprietaire ? 'proprietaire' : 'employe', atelier: a.get(m.atelier_id) ?? null, atelier_id: m.atelier_id,
      statut: m.statut, identifiant: m.identifiant_interne,
    })),
  ];
  res.json({ utilisateurs });
}));

// Désactiver / réactiver un utilisateur d'atelier (jamais un Super Administrateur, jamais soi-même).
adminRoutes.patch('/admin/utilisateurs/:id/statut', asyncHandler(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { actif } = z.object({ actif: z.boolean() }).parse(req.body);
  if (id === req.auth!.userId) throw new HttpError(400, 'Vous ne pouvez pas modifier votre propre compte.');
  const { data: sa } = await admin.from('super_admins').select('user_id').eq('user_id', id).maybeSingle();
  if (sa) throw new HttpError(403, "Un Super Administrateur ne peut pas être modifié ici.");
  const { data: m } = await admin.from('membres_atelier').select('user_id, atelier_id').eq('user_id', id).maybeSingle();
  if (!m) throw new HttpError(404, 'Utilisateur introuvable.');
  const { error } = await admin.from('membres_atelier')
    .update({ statut: actif ? 'actif' : 'desactive', desactive_at: actif ? null : new Date().toISOString() }).eq('user_id', id);
  if (error) throw new HttpError(500, 'Erreur serveur');
  const { error: eBan } = await admin.auth.admin.updateUserById(id, { ban_duration: actif ? 'none' : '876000h' });
  if (eBan) throw new HttpError(500, 'Le statut a été changé mais le blocage du compte a échoué. Réessayez.');
  await admin.from('journal_audit').insert({ atelier_id: m.atelier_id, acteur_id: req.auth!.userId, action: actif ? 'utilisateur.reactive_par_admin' : 'utilisateur.desactive_par_admin', ressource: 'membres_atelier', ressource_id: id });
  res.json({ ok: true });
}));

// ---------- Paramètres globaux ----------
const PARAMS = z.object({
  duree_abonnement_defaut_jours: z.number().int().min(1).max(3660),
  fenetre_activation_defaut_jours: z.number().int().min(1).max(365),
  contact_support: z.string().trim().max(200),
});

adminRoutes.get('/admin/parametres', asyncHandler(async (_req, res) => {
  const { data, error } = await admin.from('parametres_globaux').select('cle, valeur');
  if (error) throw new HttpError(500, 'Erreur serveur');
  res.json(Object.fromEntries((data ?? []).map((r: any) => [r.cle, r.valeur])));
}));

adminRoutes.put('/admin/parametres', asyncHandler(async (req, res) => {
  const b = PARAMS.parse(req.body);
  const lignes = Object.entries(b).map(([cle, valeur]) => ({ cle, valeur, updated_at: new Date().toISOString(), updated_by: req.auth!.userId }));
  const { error } = await admin.from('parametres_globaux').upsert(lignes, { onConflict: 'cle' });
  if (error) throw new HttpError(500, 'Erreur serveur');
  res.json({ ok: true });
}));
