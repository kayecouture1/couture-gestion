import { Router } from 'express';
import { z } from 'zod';
import { admin } from '../lib/supabase';
import { env } from '../config/env';
import { HttpError, asyncHandler } from '../lib/http';
import { normaliserTelephone } from '../lib/phone';
import { motDePasseTemporaire } from '../lib/password';
import { requireAbonnement, requireAuth, requireMembre, requirePermission } from '../middleware/auth';

export const employes = Router();
employes.use('/employes', requireAuth, requireMembre, requireAbonnement);

const uuid = z.string().uuid();

async function journaliser(atelierId: string, acteur: string, action: string, id: string, details: object = {}) {
  await admin.from('journal_audit').insert({
    atelier_id: atelierId, acteur_id: acteur, action, ressource: 'membres_atelier', ressource_id: id, details,
  });
}

// Le membre ciblé doit appartenir à l'atelier de l'appelant (modifier un ID dans la requête ne change rien).
async function membreCible(userId: string, atelierId: string) {
  const { data } = await admin.from('membres_atelier')
    .select('user_id, est_proprietaire, statut, identifiant_interne')
    .eq('user_id', userId).eq('atelier_id', atelierId).maybeSingle();
  if (!data) throw new HttpError(404, 'Employé introuvable.');
  return data;
}

const creation = z.object({
  nom: z.string().trim().min(1).max(80),
  prenom: z.string().trim().min(1).max(80),
  telephone: z.string().trim().max(25).optional().or(z.literal('')),
  email: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal('')),
  roles: z.array(uuid).max(30).default([]),
  profils: z.array(uuid).max(30).default([]),
});

employes.post(
  '/employes',
  requirePermission('employes.creer'),
  asyncHandler(async (req, res) => {
    const b = creation.parse(req.body);
    const ctx = req.auth!.ctx!;
    const db = req.auth!.db;
    const atelierId = ctx.atelier!.id;

    let tel: string | null = null;
    if (b.telephone) {
      tel = normaliserTelephone(b.telephone);
      if (!tel) throw new HttpError(400, 'Numéro de téléphone invalide.');
    }

    // Les rôles et profils choisis doivent exister dans CET atelier (lecture sous RLS).
    if (b.roles.length) {
      const { data } = await db.from('roles_production').select('id').in('id', b.roles).eq('actif', true);
      if ((data?.length ?? 0) !== b.roles.length) throw new HttpError(400, 'Rôle inconnu.');
    }
    if (b.profils.length) {
      const { data } = await db.from('profils_acces').select('id').in('id', b.profils);
      if ((data?.length ?? 0) !== b.profils.length) throw new HttpError(400, "Profil d'accès inconnu.");
      // Anti-escalade : hors propriétaire, on ne peut attribuer que des permissions que l'on détient.
      if (!ctx.est_proprietaire) {
        const { data: perms } = await db.from('profil_acces_permissions').select('permission_code').in('profil_acces_id', b.profils);
        const miennes = new Set(ctx.permissions ?? []);
        if ((perms ?? []).some((p: any) => !miennes.has(p.permission_code))) {
          throw new HttpError(403, "Vous ne pouvez pas attribuer des permissions que vous ne possédez pas.", 'ESCALADE_INTERDITE');
        }
      }
    }

    const { data: ident, error: eId } = await admin.rpc('srv_prochain_identifiant', { p_atelier: atelierId });
    if (eId || !ident) throw new HttpError(500, 'Erreur serveur');
    const identifiant = ident as string;

    const emailReel = !!b.email;
    const emailAuth = emailReel
      ? (b.email as string)
      : `${ctx.atelier!.code}.${identifiant}`.toLowerCase() + `@${env.EMPLOYEE_EMAIL_DOMAIN}`;
    const mdp = motDePasseTemporaire();

    const { data: cree, error: eAuth } = await admin.auth.admin.createUser({
      email: emailAuth, password: mdp, email_confirm: true, user_metadata: { nom: b.nom, prenom: b.prenom },
    });
    if (eAuth || !cree.user) {
      if (/already|registered|exists/i.test(eAuth?.message ?? '')) throw new HttpError(409, 'Cet email est déjà utilisé.');
      throw new HttpError(500, 'Impossible de créer le compte.');
    }
    const uid = cree.user.id;

    try {
      const e1 = await admin.from('profils').insert({
        id: uid, nom: b.nom, prenom: b.prenom, telephone: tel, email: emailReel ? emailAuth : null, doit_changer_mdp: true,
      });
      if (e1.error) throw e1.error;
      const e2 = await admin.from('membres_atelier').insert({
        user_id: uid, atelier_id: atelierId, est_proprietaire: false, identifiant_interne: identifiant,
      });
      if (e2.error) throw e2.error;
      if (b.roles.length) {
        const e3 = await admin.from('membre_roles_production')
          .insert(b.roles.map((r) => ({ user_id: uid, role_id: r, atelier_id: atelierId })));
        if (e3.error) throw e3.error;
      }
      if (b.profils.length) {
        const e4 = await admin.from('membre_profils_acces')
          .insert(b.profils.map((p) => ({ user_id: uid, profil_acces_id: p, atelier_id: atelierId })));
        if (e4.error) throw e4.error;
      }
    } catch {
      await admin.auth.admin.deleteUser(uid); // supprime aussi profil et appartenance (cascade)
      throw new HttpError(500, "Impossible de créer l'employé. Veuillez réessayer.");
    }

    await journaliser(atelierId, req.auth!.userId, 'employe.cree', uid, { identifiant });
    // Le mot de passe temporaire n'est renvoyé QU'UNE FOIS, dans cette réponse. Il n'est ni stocké ni journalisé.
    res.status(201).json({
      id: uid, identifiant, code_atelier: ctx.atelier!.code, mot_de_passe_temporaire: mdp, email_technique: !emailReel,
    });
  }),
);

employes.patch(
  '/employes/:id',
  requirePermission('employes.modifier'),
  asyncHandler(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const b = z.object({
      nom: z.string().trim().min(1).max(80),
      prenom: z.string().trim().min(1).max(80),
      telephone: z.string().trim().max(25).optional().or(z.literal('')),
    }).parse(req.body);
    const atelierId = req.auth!.ctx!.atelier!.id;
    const cible = await membreCible(id, atelierId);
    if (cible.est_proprietaire && id !== req.auth!.userId) throw new HttpError(403, 'Le propriétaire ne peut pas être modifié par un autre utilisateur.');
    let tel: string | null = null;
    if (b.telephone) {
      tel = normaliserTelephone(b.telephone);
      if (!tel) throw new HttpError(400, 'Numéro de téléphone invalide.');
    }
    const { error } = await admin.from('profils').update({ nom: b.nom, prenom: b.prenom, telephone: tel }).eq('id', id);
    if (error) throw new HttpError(500, 'Erreur serveur');
    await journaliser(atelierId, req.auth!.userId, 'employe.modifie', id);
    res.json({ ok: true });
  }),
);

employes.post(
  '/employes/:id/reinitialiser-mdp',
  requirePermission('employes.modifier'),
  asyncHandler(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const atelierId = req.auth!.ctx!.atelier!.id;
    const cible = await membreCible(id, atelierId);
    if (cible.est_proprietaire) throw new HttpError(403, 'Le mot de passe du propriétaire ne peut pas être réinitialisé ici.');
    if (id === req.auth!.userId) throw new HttpError(400, 'Utilisez « changer mon mot de passe » pour votre propre compte.');
    const mdp = motDePasseTemporaire();
    const { error } = await admin.auth.admin.updateUserById(id, { password: mdp });
    if (error) throw new HttpError(500, 'Impossible de réinitialiser le mot de passe.');
    await admin.from('profils').update({ doit_changer_mdp: true }).eq('id', id);
    await journaliser(atelierId, req.auth!.userId, 'employe.mdp_reinitialise', id);
    res.json({ mot_de_passe_temporaire: mdp, identifiant: cible.identifiant_interne, code_atelier: req.auth!.ctx!.atelier!.code });
  }),
);

// Désactivation / réactivation : le propriétaire ne peut jamais être désactivé, ni soi-même.
employes.patch(
  '/employes/:id/statut',
  requirePermission('employes.desactiver'),
  asyncHandler(async (req, res) => {
    const id = uuid.parse(req.params.id);
    const { actif } = z.object({ actif: z.boolean() }).parse(req.body);
    const atelierId = req.auth!.ctx!.atelier!.id;
    const cible = await membreCible(id, atelierId);
    if (cible.est_proprietaire) throw new HttpError(403, "Le propriétaire de l'atelier ne peut pas être désactivé.", 'PROPRIETAIRE_PROTEGE');
    if (id === req.auth!.userId) throw new HttpError(400, 'Vous ne pouvez pas désactiver votre propre compte.');

    // 1) Statut en base : coupe immédiatement tout accès (la RLS exige un membre « actif »).
    const { error } = await admin.from('membres_atelier')
      .update({ statut: actif ? 'actif' : 'desactive', desactive_at: actif ? null : new Date().toISOString() })
      .eq('user_id', id).eq('atelier_id', atelierId);
    if (error) throw new HttpError(500, 'Erreur serveur');
    // 2) Compte Auth bloqué : plus de nouvelle connexion ni de renouvellement de session.
    const { error: eBan } = await admin.auth.admin.updateUserById(id, { ban_duration: actif ? 'none' : '876000h' });
    if (eBan) throw new HttpError(500, 'Le statut a été changé mais le blocage du compte a échoué. Réessayez.');
    await journaliser(atelierId, req.auth!.userId, actif ? 'employe.reactive' : 'employe.desactive', id);
    res.json({ ok: true, actif });
  }),
);
