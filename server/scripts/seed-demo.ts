/**
 * Données de DÉMONSTRATION — jamais mélangées aux ateliers réels.
 * Crée un atelier marqué est_demo = true (exclu de la liste publique et des statistiques globales),
 * avec un abonnement actif, quelques clients, une commande et ses habits.
 *
 *   npm run seed:demo        (après avoir renseigné server/.env)
 *
 * Compte de démonstration : l'adresse et le mot de passe sont affichés à la fin (mot de passe aléatoire).
 * Pour supprimer la démo : npm run seed:demo -- --supprimer
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis.'); process.exit(1); }
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const EMAIL = 'demo@couture-gestion.demo';

async function supprimer() {
  const { data: at } = await admin.from('ateliers').select('id').eq('est_demo', true);
  for (const a of at ?? []) {
    // ordre inverse des dépendances
    for (const t of ['notifications', 'essayages', 'retouches', 'paiements', 'factures', 'propositions_rdv', 'habit_etapes', 'habits', 'commandes',
      'client_mesures', 'clients', 'modeles_circuits_etapes', 'modeles_circuits', 'modeles', 'types_vetements', 'emplacements', 'mesure_champs',
      'membre_roles_production', 'membre_profils_acces', 'profil_acces_permissions', 'profils_acces', 'roles_production', 'depenses',
      'abonnements_historique', 'codes_abonnement', 'abonnements', 'journal_audit', 'compteurs'] as const) {
      await admin.from(t).delete().eq('atelier_id', a.id);
    }
    const { data: m } = await admin.from('membres_atelier').select('user_id').eq('atelier_id', a.id);
    await admin.from('membres_atelier').delete().eq('atelier_id', a.id);
    for (const x of m ?? []) await admin.auth.admin.deleteUser(x.user_id);
    await admin.from('ateliers').delete().eq('id', a.id);
  }
  console.log('Données de démonstration supprimées.');
}

async function main() {
  if (process.argv.includes('--supprimer')) return supprimer();
  const { data: deja } = await admin.from('ateliers').select('id').eq('est_demo', true).limit(1);
  if (deja?.length) { console.error('Un atelier de démonstration existe déjà. Supprimez-le avec : npm run seed:demo -- --supprimer'); process.exit(1); }

  const mdp = randomBytes(9).toString('base64url') + 'a1';
  const { data: u, error: eU } = await admin.auth.admin.createUser({ email: EMAIL, password: mdp, email_confirm: true });
  if (eU || !u.user) { console.error('Création du compte démo impossible :', eU?.message); process.exit(1); }
  const { data: atelierId, error } = await admin.rpc('srv_creer_atelier', {
    p_user: u.user.id, p_nom_atelier: '[DÉMO] Atelier de démonstration', p_code: 'demo' + randomBytes(2).toString('hex').slice(0, 3),
    p_telephone: '+22370000000', p_nom: 'Démo', p_prenom: 'Propriétaire', p_email: EMAIL,
  });
  if (error || !atelierId) { await admin.auth.admin.deleteUser(u.user.id); console.error('Échec :', error?.message); process.exit(1); }
  const at = atelierId as string;
  await admin.from('ateliers').update({ est_demo: true, visible_public: false }).eq('id', at);
  const debut = new Date(), fin = new Date(Date.now() + 365 * 86_400_000);
  await admin.from('abonnements').insert({ atelier_id: at, duree_jours: 365, statut: 'actif', debut_at: debut.toISOString(), fin_at: fin.toISOString(), note: 'Abonnement de démonstration' });

  const { data: clients } = await admin.from('clients').insert([
    { atelier_id: at, nom: 'Traoré', prenom: 'Fanta', telephone_e164: '+22376000001', whatsapp_e164: '+22376000001', notes: '[DÉMO]' },
    { atelier_id: at, nom: 'Diarra', prenom: 'Oumar', telephone_e164: '+22376000002', notes: '[DÉMO]' },
  ]).select('id');
  const { data: types } = await admin.from('types_vetements').select('id, nom').eq('atelier_id', at);
  const { data: modele } = await admin.from('modeles_circuits').select('id').eq('atelier_id', at).eq('nom', 'Simple').single();
  const { data: etapesModele } = await admin.from('modeles_circuits_etapes').select('*').eq('modele_circuit_id', modele!.id).order('ordre');

  const { data: cmd } = await admin.from('commandes').insert({ atelier_id: at, code: 'CMD-000001', client_id: clients![0].id, total_fcfa: 45000, date_rdv: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10), note: '[DÉMO]' }).select('id').single();
  for (const [i, nomType] of ['Bazin', 'Wax'].entries()) {
    const { data: h } = await admin.from('habits').insert({ atelier_id: at, commande_id: cmd!.id, code: `HAB-00000${i + 1}`, type_vetement_id: types!.find((t: any) => t.nom === nomType)?.id, type_libelle: nomType, statut: 'en_attente' }).select('id').single();
    await admin.from('habit_etapes').insert((etapesModele ?? []).map((e: any, k: number) => ({ atelier_id: at, habit_id: h!.id, ordre: e.ordre, nom: e.nom, mode: e.mode, role_id: e.role_id, user_id: e.user_id, statut: k === 0 ? 'disponible' : 'en_attente' })));
  }
  await admin.from('paiements').insert({ atelier_id: at, commande_id: cmd!.id, montant_fcfa: 15000, mode: 'especes', note: 'Avance [DÉMO]' });
  await admin.from('compteurs').upsert([{ atelier_id: at, cle: 'commande', valeur: 1 }, { atelier_id: at, cle: 'habit', valeur: 2 }]);

  console.log(`Atelier de démonstration créé (marqué est_demo, exclu des statistiques globales et de la liste publique).\nEmail : ${EMAIL}\nMot de passe : ${mdp}\n(Notez-le : il ne sera plus affiché.)`);
}
main();
