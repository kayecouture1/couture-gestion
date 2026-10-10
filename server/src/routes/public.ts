import { Router } from 'express';
import { z } from 'zod';
import { admin } from '../lib/supabase';
import { HttpError, asyncHandler } from '../lib/http';
import { normaliserTelephone } from '../lib/phone';
import { limiteListeAteliers, limiteRechercheHeure, limiteRechercheMinute } from '../middleware/limites';

export const publicRoutes = Router();

const CACHE_TTL_MS = 30_000;
let ateliersCache: { expires: number; value: unknown } | null = null;
let configCache: { expires: number; value: { contact_support: string } } | null = null;
const signedUrlCache = new Map<string, { expires: number; value: string | null }>();

// Ateliers visibles : option activée par le propriétaire (invisible par défaut), atelier actif, abonnement en cours.
publicRoutes.get('/public/ateliers', limiteListeAteliers, asyncHandler(async (_req, res) => {
  if (ateliersCache && ateliersCache.expires > Date.now()) {
    res.setHeader('cache-control', 'public, max-age=15, stale-while-revalidate=30');
    return res.json(ateliersCache.value);
  }
  const { data, error } = await admin.from('ateliers')
    .select('id, nom, logo_path').eq('visible_public', true).eq('statut', 'actif').eq('est_demo', false).order('nom');
  if (error) throw new HttpError(503, 'Service temporairement indisponible');
  const maintenant = new Date().toISOString();
  const { data: abos } = await admin.from('abonnements').select('atelier_id')
    .eq('statut', 'actif').lte('debut_at', maintenant).gt('fin_at', maintenant);
  const actifs = new Set((abos ?? []).map((a: any) => a.atelier_id));
  const ateliers = (data ?? []).filter((a: any) => actifs.has(a.id)).map((a: any) => ({
    id: a.id, nom: a.nom,
    logo_url: a.logo_path ? admin.storage.from('logos').getPublicUrl(a.logo_path).data.publicUrl : null,
  }));
  const value = { ateliers };
  ateliersCache = { expires: Date.now() + CACHE_TTL_MS, value };
  res.setHeader('cache-control', 'public, max-age=15, stale-while-revalidate=30');
  res.json(value);
}));

const recherche = z.object({
  atelier_id: z.string().uuid(),
  code: z.string().trim().max(20).optional(),
  telephone: z.string().trim().max(25).optional(),
  nom: z.string().trim().max(80).optional(),
  prenom: z.string().trim().max(80).optional(),
});

const initiales = (n: string, p: string) => `${(p[0] ?? '').toUpperCase()}.${(n[0] ?? '').toUpperCase()}.`;

// Recherche SANS COMPTE. Règles : atelier choisi d'abord ; recherche par ID, par téléphone, ou par nom ET prénom ;
// réponse minimale (jamais de nom complet, téléphone, montants ni employés) ; résultats plafonnés ; débit limité.
publicRoutes.post('/public/suivi', limiteRechercheMinute, limiteRechercheHeure, asyncHandler(async (req, res) => {
  const b = recherche.parse(req.body);
  const vide = { resultats: [] as unknown[] };

  const atelierQuery = admin.from('ateliers').select('id, nom, visible_public, statut').eq('id', b.atelier_id).maybeSingle();
  const maintenant = new Date().toISOString();
  const abonnementQuery = admin.from('abonnements').select('id').eq('atelier_id', b.atelier_id)
    .eq('statut', 'actif').lte('debut_at', maintenant).gt('fin_at', maintenant).limit(1);
  const [{ data: at, error: atelierError }, { data: abo, error: abonnementError }] = await Promise.all([atelierQuery, abonnementQuery]);
  if (atelierError || abonnementError) throw new HttpError(503, 'Service temporairement indisponible');
  if (!at || at.statut !== 'actif' || !at.visible_public || !abo?.length) return res.json(vide);

  const depuis = new Date(Date.now() - 120 * 86_400_000).toISOString();
  let requete = admin.from('habits')
    .select('id, code, type_libelle, modele_libelle, statut, photo_habit_path, photo_modele_path, commande_id, created_at')
    .eq('atelier_id', b.atelier_id).neq('statut', 'annule').gte('created_at', depuis)
    .order('created_at', { ascending: false }).limit(10);

  if (b.code) {
    const code = b.code.toUpperCase().replace(/\s/g, '');
    const norm = /^HAB-?\d+$/.test(code) ? `HAB-${code.replace(/\D/g, '').padStart(6, '0')}` : code;
    requete = requete.eq('code', norm);
  } else {
    let clients: { id: string; nom: string; prenom: string }[] = [];
    if (b.telephone) {
      const tel = normaliserTelephone(b.telephone);
      if (!tel) return res.json(vide);
      const { data } = await admin.from('clients').select('id, nom, prenom').eq('atelier_id', b.atelier_id)
        .is('archived_at', null).or(`telephone_e164.eq.${tel},whatsapp_e164.eq.${tel}`).limit(20);
      clients = data ?? [];
    } else if (b.nom && b.prenom) {
      // Nom ET prénom ensemble, correspondance exacte (insensible à la casse), pas de recherche partielle.
      const { data } = await admin.from('clients').select('id, nom, prenom').eq('atelier_id', b.atelier_id)
        .is('archived_at', null).ilike('nom', b.nom.replace(/[%_]/g, '')).ilike('prenom', b.prenom.replace(/[%_]/g, '')).limit(20);
      clients = data ?? [];
    } else {
      throw new HttpError(400, 'Indiquez un ID d’habit, un numéro de téléphone, ou un nom et un prénom.');
    }
    if (!clients.length) return res.json(vide);
    const { data: cmds } = await admin.from('commandes').select('id, client_id')
      .eq('atelier_id', b.atelier_id).in('client_id', clients.map((c) => c.id)).neq('statut', 'annulee');
    if (!cmds?.length) return res.json(vide);
    requete = requete.in('commande_id', cmds.map((c: any) => c.id));
  }

  const { data: habits } = await requete;
  if (!habits?.length) return res.json(vide);

  const { data: etapes } = await admin.from('habit_etapes').select('habit_id, ordre, nom, statut')
    .in('habit_id', habits.map((h: any) => h.id)).order('ordre');
  const { data: cmdsInfo } = await admin.from('commandes').select('id, client_id').in('id', habits.map((h: any) => h.commande_id));
  const { data: cls } = await admin.from('clients').select('id, nom, prenom').in('id', (cmdsInfo ?? []).map((c: any) => c.client_id));

  const url = async (chemin: string | null) => {
    if (!chemin) return null;
    const cached = signedUrlCache.get(chemin);
    if (cached && cached.expires > Date.now()) return cached.value;
    const { data } = await admin.storage.from('photos-habits').createSignedUrl(chemin, 600); // 10 minutes
    const value = data?.signedUrl ?? null;
    signedUrlCache.set(chemin, { expires: Date.now() + 540_000, value });
    if (signedUrlCache.size > 5000) {
      const first = signedUrlCache.keys().next().value;
      if (first) signedUrlCache.delete(first);
    }
    return value;
  };

  const resultats = await Promise.all(habits.map(async (h: any) => {
    const circuit = (etapes ?? []).filter((e: any) => e.habit_id === h.id).map((e: any) => ({ nom: e.nom, statut: e.statut }));
    const courante = circuit.find((e: any) => e.statut === 'en_cours') ?? circuit.find((e: any) => e.statut === 'disponible') ?? null;
    const cmd = (cmdsInfo ?? []).find((c: any) => c.id === h.commande_id);
    const cl = (cls ?? []).find((c: any) => c.id === cmd?.client_id);
    return {
      code: h.code, type: h.type_libelle, modele: h.modele_libelle, statut: h.statut,
      etape_actuelle: courante?.nom ?? null, circuit,
      client: cl ? initiales(cl.nom, cl.prenom) : null,
      photo_habit: await url(h.photo_habit_path), photo_modele: await url(h.photo_modele_path),
    };
  }));
  res.json({ atelier: at.nom, resultats });
}));

// Information publique : seul le contact du support est exposé.
publicRoutes.get('/public/config', limiteListeAteliers, asyncHandler(async (_req, res) => {
  if (configCache && configCache.expires > Date.now()) {
    res.setHeader('cache-control', 'public, max-age=30');
    return res.json(configCache.value);
  }
  const { data } = await admin.from('parametres_globaux').select('valeur').eq('cle', 'contact_support').maybeSingle();
  const value = { contact_support: typeof data?.valeur === 'string' ? data.valeur : '' };
  configCache = { expires: Date.now() + 60_000, value };
  res.setHeader('cache-control', 'public, max-age=30');
  res.json(value);
}));
