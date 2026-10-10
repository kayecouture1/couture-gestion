import { Router } from 'express';
import express from 'express';
import { z } from 'zod';
import { admin, anon } from '../lib/supabase';
import { env } from '../config/env';
import { HttpError, asyncHandler } from '../lib/http';
import { normaliserTelephone } from '../lib/phone';
import { codeAtelierAleatoire } from '../lib/password';
import { detecterImage } from '../lib/images';
import { limiteInscription } from '../middleware/limites';

export const inscription = Router();

const schema = z.object({
  nom_atelier: z.string().trim().min(2, "Nom de l'atelier trop court").max(120),
  nom: z.string().trim().min(1, 'Nom requis').max(80),
  prenom: z.string().trim().min(1, 'Prénom requis').max(80),
  telephone: z.string().trim().min(8).max(25),
  email: z.string().trim().toLowerCase().email('Email invalide').max(200),
  password: z.string().min(8, 'Au moins 8 caractères').max(72)
    .regex(/[A-Za-z]/, 'Le mot de passe doit contenir une lettre')
    .regex(/\d/, 'Le mot de passe doit contenir un chiffre'),
  logo: z.object({
    mime: z.enum(['image/png', 'image/jpeg']),
    base64: z.string().max(1_500_000),
  }).optional(),
});

const MESSAGE =
  "Un email de vérification vient de vous être envoyé. Cliquez sur le lien qu'il contient pour confirmer votre adresse.";

// Le logo est envoyé en base64 (petit, déjà compressé par le navigateur) : on autorise un corps plus grand ici seulement.
inscription.post(
  '/ateliers/inscription',
  limiteInscription,
  express.json({ limit: '2mb' }),
  asyncHandler(async (req, res) => {
    const b = schema.parse(req.body);
    const tel = normaliserTelephone(b.telephone);
    if (!tel) throw new HttpError(400, 'Numéro de téléphone invalide.');

    let logo: Buffer | undefined;
    let logoExt = 'png';
    if (b.logo) {
      logo = Buffer.from(b.logo.base64, 'base64');
      if (logo.length > 1_048_576) throw new HttpError(400, 'Logo trop volumineux (1 Mo maximum).');
      const vrai = detecterImage(logo);
      if (!vrai || vrai !== b.logo.mime) throw new HttpError(400, "Le logo doit être une image PNG ou JPEG valide.");
      logoExt = vrai === 'image/png' ? 'png' : 'jpg';
    }

    // Supabase Auth envoie l'email de vérification et gère le mot de passe (jamais stocké ici).
    const { data, error } = await anon().auth.signUp({
      email: b.email,
      password: b.password,
      options: { emailRedirectTo: `${env.APP_URL}/connexion?verifie=1`, data: { nom: b.nom, prenom: b.prenom } },
    });
    if (error) {
      if ((error as any).status === 429) throw new HttpError(429, "Trop de demandes d'email. Réessayez dans quelques minutes.");
      if (/password/i.test(error.message)) throw new HttpError(400, 'Mot de passe trop faible.');
      throw new HttpError(400, "Impossible de créer le compte. Vérifiez les informations saisies.");
    }
    const user = data.user;
    // Adresse déjà inscrite : Supabase renvoie un utilisateur sans identités. Réponse identique pour ne rien révéler.
    if (!user || (Array.isArray(user.identities) && user.identities.length === 0)) {
      return res.status(200).json({ ok: true, message: MESSAGE });
    }

    let atelierId: string | null = null;
    for (let essai = 0; essai < 5 && !atelierId; essai++) {
      const { data: id, error: e } = await admin.rpc('srv_creer_atelier', {
        p_user: user.id, p_nom_atelier: b.nom_atelier, p_code: codeAtelierAleatoire(),
        p_telephone: tel, p_nom: b.nom, p_prenom: b.prenom, p_email: b.email,
      });
      if (!e) { atelierId = id as string; break; }
      if ((e as any).code !== '23505' || /profils|membres/.test(e.message)) {
        await admin.auth.admin.deleteUser(user.id); // annule le compte : rien ne reste à moitié créé
        throw new HttpError(500, "Impossible de créer l'atelier. Veuillez réessayer.");
      }
    }
    if (!atelierId) {
      await admin.auth.admin.deleteUser(user.id);
      throw new HttpError(500, "Impossible de créer l'atelier. Veuillez réessayer.");
    }

    let logoOk: boolean | undefined;
    if (logo) {
      const chemin = `${atelierId}/logo.${logoExt}`;
      const up = await admin.storage.from('logos').upload(chemin, logo, { contentType: b.logo!.mime, upsert: true });
      if (up.error) logoOk = false;
      else {
        const maj = await admin.from('ateliers').update({ logo_path: chemin }).eq('id', atelierId);
        logoOk = !maj.error;
      }
    }
    return res.status(201).json({
      ok: true,
      message: MESSAGE,
      logo_ok: logoOk,
      logo_message: logoOk === false ? "Impossible d'enregistrer le logo. Vous pourrez le remplacer dans les paramètres." : undefined,
    });
  }),
);
