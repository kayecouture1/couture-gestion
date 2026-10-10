import { Router } from 'express';
import { z } from 'zod';
import { admin } from '../lib/supabase';
import { HttpError, asyncHandler, erreurDepuisPostgres } from '../lib/http';
import { requireAbonnement, requireAuth, requireMembre, requirePermission } from '../middleware/auth';
import { genererPdfFacture } from '../lib/pdf';

export const factures = Router();
factures.use('/factures', requireAuth, requireMembre, requireAbonnement);

// Génère un NOUVEAU justificatif (montants du moment) : facture PDF numérotée, enregistrée dans le Storage privé.
factures.post('/factures', requirePermission('factures.generer'), asyncHandler(async (req, res) => {
  const { commande_id } = z.object({ commande_id: z.string().uuid() }).parse(req.body);
  const atelierId = req.auth!.ctx!.atelier!.id;

  // Droits, montants et numéro : calculés par la base, sous l'identité de l'utilisateur.
  const { data, error } = await req.auth!.db.rpc('generer_facture', { p_commande: commande_id });
  if (error || !data) throw erreurDepuisPostgres(error);
  const d = data as any;

  let logo: Buffer | undefined;
  if (d.atelier?.logo_path) {
    const dl = await admin.storage.from('logos').download(d.atelier.logo_path);
    if (dl.data) logo = Buffer.from(await dl.data.arrayBuffer());
  }
  const pdf = await genererPdfFacture({
    facture: d.facture, atelier: d.atelier, client: d.client, commande: d.commande, habits: d.habits, paiements: d.paiements,
  }, logo);

  const chemin = `${atelierId}/factures/${d.facture.numero}.pdf`;
  const up = await admin.storage.from('documents').upload(chemin, pdf, { contentType: 'application/pdf', upsert: true });
  if (up.error) throw new HttpError(500, "La facture a été créée mais le PDF n'a pas pu être enregistré. Réessayez.");
  await admin.from('factures').update({ pdf_path: chemin }).eq('id', d.facture.id).eq('atelier_id', atelierId);

  const signe = await admin.storage.from('documents').createSignedUrl(chemin, 7 * 86_400, { download: `${d.facture.numero}.pdf` });
  res.status(201).json({ facture: d.facture, url: signe.data?.signedUrl ?? null, whatsapp: d.client?.whatsapp_e164 ?? d.client?.telephone_e164 ?? null });
}));
