/**
 * Création du PREMIER Super Administrateur (à exécuter une seule fois, depuis votre poste ou le shell Render).
 *
 *   SUPERADMIN_EMAIL=vous@exemple.com SUPERADMIN_PASSWORD='MotDePasseLong!' npm run init:superadmin
 *
 * Le script réutilise un utilisateur Auth déjà créé. Les identifiants sont lus dans l'environnement
 * AU MOMENT de l'exécution : aucun compte ni mot de passe n'est écrit dans le code.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD;
const nom = process.env.SUPERADMIN_NOM ?? 'Administrateur';
const prenom = process.env.SUPERADMIN_PRENOM ?? 'Super';

if (!url || !key || !email) {
  console.error('Variables requises : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPERADMIN_EMAIL');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function main() {
  const { count, error: countError } = await admin.from('super_admins').select('user_id', { count: 'exact', head: true });
  if (countError) {
    console.error('Impossible de vérifier la table super_admins :', countError.message);
    process.exit(1);
  }
  if ((count ?? 0) > 0 && process.env.ALLOW_ADDITIONAL_SUPERADMIN !== 'yes') {
    console.error('Un Super Administrateur existe déjà. Pour en ajouter un autre : ALLOW_ADDITIONAL_SUPERADMIN=yes');
    process.exit(1);
  }

  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) {
    console.error('Impossible de rechercher l’utilisateur Auth :', usersError.message);
    process.exit(1);
  }

  let user = users.users.find((candidate) => candidate.email?.trim().toLowerCase() === email);
  let userCreated = false;
  if (!user) {
    if (!password) {
      console.error('SUPERADMIN_PASSWORD est requis lorsqu’aucun utilisateur Auth ne correspond à cet email.');
      process.exit(1);
    }
    if (password.length < 12) {
      console.error('Le mot de passe du Super Administrateur doit contenir au moins 12 caractères.');
      process.exit(1);
    }
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) {
      console.error('Échec de la création du compte :', error?.message);
      process.exit(1);
    }
    user = data.user;
    userCreated = true;
  }

  const uid = user.id;
  const { error: profileError } = await admin.from('profils').upsert(
    { id: uid, nom, prenom, email },
    { onConflict: 'id' },
  );
  const { error: superAdminError } = await admin.from('super_admins').upsert(
    { user_id: uid },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );
  const { error: auditError } = await admin.from('journal_audit').insert({
    acteur_id: uid,
    action: 'super_admin.cree',
    ressource: 'utilisateur',
    ressource_id: uid,
    details: { email },
  });

  if (profileError || superAdminError || auditError) {
    if (userCreated) {
      await admin.auth.admin.deleteUser(uid);
    }
    console.error('Échec de la configuration du Super Administrateur :',
      profileError?.message ?? superAdminError?.message ?? auditError?.message);
    process.exit(1);
  }
  console.log(`Super Administrateur configuré : ${email}. Retirez SUPERADMIN_PASSWORD de votre environnement.`);
}
main();
