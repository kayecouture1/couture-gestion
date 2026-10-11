# Guide d'installation et de déploiement — COUTURE GESTION

Ce guide s'adresse à une personne qui installe le projet pour la première fois. Il couvre l'installation locale,
la création de la base Supabase, les vérifications obligatoires et le déploiement sur Render et Vercel.

## 1. Prérequis et organisation des dossiers

Installez :

- Node.js 20 ou une version plus récente : <https://nodejs.org> ;
- Git : <https://git-scm.com> ;
- un compte Supabase ;
- un compte GitHub si le code doit être publié ;
- un compte Render pour l'API et Vercel pour le frontend.

Ouvrez le terminal **à la racine du projet**, c'est-à-dire le dossier qui contient `server`, `web`, `supabase`
et `docs`. Ne lancez pas les commandes depuis un éventuel sous-dossier portant le même nom.

Sous Windows PowerShell :

```powershell
cd "C:\Users\KAYE\Documents\mesprojrts\couture-gestion"
```

Les commandes `npm install` et `npm test` doivent être lancées séparément dans `server` et `web`.

## 2. Créer et préparer le projet Supabase

1. Allez sur <https://supabase.com>, créez un compte puis **New project**.
2. Nom : `couture-gestion`. Choisissez un mot de passe de base de données (conservez-le), et la **région la plus proche du Mali** proposée.
3. Attendez la fin de la création (1 à 2 minutes).
4. Notez, dans **Project Settings → API** :
   - `Project URL` → sera `SUPABASE_URL`
   - clé `anon` `public` → sera `SUPABASE_ANON_KEY`
   - clé `service_role` `secret` → sera `SUPABASE_SERVICE_ROLE_KEY` (**ne jamais la partager ni la mettre dans le frontend**)

## 3. Exécuter les migrations SQL dans l'ordre

Dans Supabase : **SQL Editor → New query**. Pour chaque fichier ci-dessous, **dans cet ordre**, copiez tout le
contenu, collez, puis cliquez **Run**. Chaque exécution doit afficher « Success ».

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_permissions_et_helpers.sql`
3. `supabase/migrations/0003_fonctions_metier.sql`
4. `supabase/migrations/0004_rls_et_droits.sql`
5. `supabase/migrations/0005_storage.sql`
6. `supabase/migrations/0006_modules_complementaires.sql` (essayages, retouches, statistiques, export, paramètres globaux, photos de profil)
7. `supabase/migrations/0007_notifications_taches.sql` (notifications ciblées et compteur des tâches)

Si une erreur apparaît : arrêtez-vous, copiez le message **et le numéro du fichier**, et ne continuez pas.

N'exécutez pas une migration deux fois sur une base déjà configurée, sauf si vous savez exactement comment annuler
son effet. En cas d'erreur, arrêtez-vous, notez le fichier et le message complet.

## 4. Régler Supabase Auth, les URL et le stockage

Dans **Authentication** :

- **Sign In / Providers → Email** : *Confirm email* **activé**. Mot de passe minimum : **8**.
- **Sign In / Providers** : l'inscription par email doit rester **activée** (l'API crée les ateliers ainsi).
- **URL Configuration** :
  - *Site URL* : l'adresse de votre frontend (en local : `http://localhost:5173`).
  - *Redirect URLs* : ajoutez `http://localhost:5173/**` et, plus tard, l'adresse Vercel suivie de `/**`.
- **Emails** : le service d'envoi intégré de Supabase est **très limité** (quelques emails par heure). Pour un usage réel,
  configurez votre propre service SMTP (*Authentication → SMTP Settings*).
- **JWT expiry** (*Project Settings → Auth*) : 3600 s (1 h) recommandé.
- Dans **Storage**, vérifiez que les buckets créés par `0005_storage.sql` existent. Ne rendez pas publics les buckets
  qui contiennent des photos de clients ou de membres.

## 5. Vérifier la base avant de créer des données (obligatoire)

Dans **SQL Editor**, ouvrez `supabase/tests/securite.sql`, collez-le et exécutez-le. Il crée deux ateliers de test,
vérifie l'isolation, l'expiration, l'anti-escalade, l'usage unique d'un code et la prise d'étape, puis **annule tout**
(`ROLLBACK`). Résultat attendu : le message `TOUS LES TESTS DE SECURITE SQL SONT PASSES` (12 familles de tests : isolation, clés composites, expiration, permissions, anti-escalade, codes, prise d'étape, abonnement désactivé/réactivé/prolongé, étape attribuée à une personne, essayages/retouches, tables réservées au serveur).
Une ligne `ECHEC …` indique un test raté : ne mettez pas le projet en ligne avant de l'avoir corrigé.

## 6. Configurer et lancer l'API en local

```powershell
cd server
Copy-Item .env.example .env
```

Ouvrez `server/.env` et renseignez : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, et
`CODE_HMAC_SECRET` (au moins 32 caractères aléatoires ; générez-en un avec `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).

```powershell
npm install
npm test                    # tests unitaires (codes, téléphones, mots de passe, images)
npm run typecheck
npm run dev                 # l'API écoute sur http://localhost:3000
```

Dans un autre terminal, vérifiez :

```powershell
Invoke-RestMethod http://localhost:3000/sante
Invoke-RestMethod http://localhost:3000/pret
```

`/sante` vérifie que le processus répond. `/pret` vérifie aussi la connexion Supabase.

### Configurer le premier Super Administrateur

Si l'utilisateur existe déjà dans **Supabase → Authentication → Users**, le script le retrouve par
son adresse email et lui ajoute son profil ainsi que son entrée dans `super_admins`. Dans ce cas,
aucun mot de passe n'est nécessaire. Depuis `server/` :

```powershell
# Windows PowerShell — utilisateur Auth déjà créé
$env:SUPERADMIN_EMAIL="vous@exemple.com"; npm run init:superadmin
```

Si l'utilisateur Auth n'existe pas encore, ajoutez aussi un mot de passe d'au moins 12 caractères :

```powershell
# Depuis n'importe quel dossier :
cd "C:\Users\KAYE\Documents\mesprojrts\couture-gestion\server"

# Définissez l'adresse email et un nouveau mot de passe :
$env:SUPERADMIN_EMAIL = "votre-email@gmail.com"
$env:SUPERADMIN_PASSWORD = "VotreMotDePasseLong123!"
$env:SUPERADMIN_NOM = "Votre nom"
$env:SUPERADMIN_PRENOM = "Votre prénom"
npm run init:superadmin
```

Le script crée alors l'utilisateur avec l'email confirmé, puis configure `profils` et `super_admins`.
Il journalise l'opération dans `journal_audit` avec les colonnes du schéma (`acteur_id`, `ressource`,
`ressource_id`). Supprimez ensuite `SUPERADMIN_PASSWORD` de votre terminal.


Le compte ainsi configuré est reconnu par `mon_contexte()` comme `super_admin` et bénéficie de
l'espace `/admin` et des contrôles API associés. Pour ajouter un autre super administrateur,
définissez explicitement `ALLOW_ADDITIONAL_SUPERADMIN=yes` avant l'exécution.

## 7. Configurer et lancer le frontend en local

```powershell
cd web
Copy-Item .env.example .env
```

Renseignez `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (clé **anon**, jamais `service_role`), `VITE_API_URL=http://localhost:3000`.

```powershell
npm install
npm run typecheck
npm test
npm run dev                 # http://localhost:5173
```

### Données de démonstration (facultatif)

```powershell
cd ..\server
npm run seed:demo                    # crée des données de démonstration séparées
npm run seed:demo -- --supprimer     # supprime uniquement ces données
```

L'atelier de démonstration est marqué `est_demo` : il n'apparaît ni dans la liste publique ni dans les statistiques globales. Les identifiants affichés à la fin ne sont montrés qu'une fois.

### Parcours de vérification

1. **Super Admin** : connectez-vous (onglet « Propriétaire / Admin ») avec le compte de l'étape 6 → espace Administration.
2. **Créer un atelier** (déconnexion, puis « Créer un atelier ») → cliquez le lien reçu par email → connectez-vous : l'écran « saisir le code » s'affiche (accès bloqué).
3. **Abonnement** : Super Admin → Ateliers → l'atelier → *Nouvel abonnement* → copiez le code → connectez-vous en propriétaire → saisissez le code → l'application s'ouvre.
4. **Employé** : Employés → *Ajouter un employé* (profil « Production », rôle « Coupeur ») → notez le code atelier, l'identifiant et le mot de passe temporaire → connectez-vous (onglet « Employé ») → changez le mot de passe.
5. **Commande** : Clients → créer un client → Nouvelle commande (modèle de circuit « Simple ») → l'employé voit la tâche dans « Mes tâches » → *J'ai pris cet habit* → *Terminé* → … → le propriétaire confirme l'habit et choisit l'emplacement.
6. **Paiement et facture** : détail de la commande → Enregistrer un paiement → Générer une facture PDF.
7. **Suivi public** : Paramètres → cocher la visibilité publique → page publique « Voir les ateliers » → rechercher par ID d'habit.

## 8. Déployer l'API et le frontend

Cette partie suppose que tout fonctionne déjà en local :

- `server` démarre avec `npm run dev` ;
- `web` démarre avec `npm run dev` ;
- `/sante` et `/pret` répondent ;
- le test SQL de sécurité a passé ;
- les migrations Supabase sont déjà exécutées.

Si l'un de ces points échoue, corrigez-le avant Render et Vercel.

### Comprendre les deux plateformes

- **Render** héberge l'API Node.js qui parle à Supabase.
- **Vercel** héberge le frontend React/Vite.
- Les deux doivent pointer vers **le même dépôt GitHub**.
- Le frontend ne doit jamais contenir `SUPABASE_SERVICE_ROLE_KEY` ni `CODE_HMAC_SECRET`.

### Ce que signifient vos logs actuels

#### Erreur Vercel : `vite: command not found`

Cette erreur veut dire que Vercel a essayé d'exécuter `vite build` alors que la commande `vite` n'était pas disponible dans l'environnement de build.

Causes les plus fréquentes :

1. le **Root Directory** n'était pas `web` ;
2. la commande de build était `vite build` au lieu de `npm run build` ;
3. les dépendances n'ont pas été installées dans le bon dossier ;
4. le projet pointait vers la racine du dépôt au lieu du sous-dossier `web`.

Dans ce dépôt, la bonne approche est :

- Root Directory : `web`
- Install Command : `npm install`
- Build Command : `npm run build`
- Output Directory : `dist`

#### Erreur Render : `Cannot find module '/opt/render/project/src/server/dist/index.js'`

Cette erreur veut dire que Render a essayé de démarrer l'API, mais le fichier compilé `dist/index.js` n'existait pas encore.

Causes les plus fréquentes :

1. le **Build Command** n'a pas été lancé ;
2. le build a échoué avant de créer `dist` ;
3. le service est mal configuré et ne pointe pas sur `server` ;
4. le **Start Command** démarre l'application avant compilation ;
5. le dépôt a été branché sur la racine alors que l'API est dans `server`.

Dans ce dépôt, la bonne approche est :

- Root Directory : `server`
- Build Command : `npm ci --include=dev && npm run build`
- Start Command : `npm start`
- `--include=dev` est obligatoire lorsque `NODE_ENV=production` est défini dans Render :
  TypeScript et les types nécessaires au build sont dans `devDependencies`.
- le build doit créer `server/dist/index.js`

### API sur Render

1. Poussez la racine du projet sur GitHub. Le dépôt doit contenir directement `server`, `web`, `supabase` et `docs`.
2. Render → **New → Web Service** → votre dépôt.
3. Vérifiez les champs un par un :
   - **Name** : par exemple `couture-gestion-api`
   - **Branch** : `main`
   - **Root Directory** : `server`
   - **Runtime** : `Node`
   - **Region** : la région de votre choix
   - **Build Command** : `npm ci --include=dev && npm run build`
   - **Start Command** : `npm start`
   - **Health Check Path** : `/sante`
   - **Plan** : selon votre besoin
4. Dans l'environnement Render, ajoutez les variables de `server/.env.example` avec les vraies valeurs :
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CODE_HMAC_SECRET`,
   `APP_URL`, `ALLOWED_ORIGINS`, `EMPLOYEE_EMAIL_DOMAIN`, `APP_TIMEZONE`, `PORT` et `NODE_ENV=production`.
   `APP_URL` et `ALLOWED_ORIGINS` doivent être l'URL Vercel exacte, sans slash final.
   `PORT` peut être laissé vide si vous utilisez la valeur automatique proposée par Render ; l'application la lit via `process.env.PORT` avec une valeur par défaut de `3000`.
5. Cliquez **Create Web Service**.
6. Attendez la fin du build. S'il échoue, ouvrez les logs et cherchez la première erreur réelle, pas seulement la dernière.
7. Après le déploiement, vérifiez `https://votre-api.onrender.com/sante` puis `/pret`.
8. L'offre gratuite de Render se met en veille : la première requête peut prendre environ une minute. Pour un usage réel,
   prévoyez une offre payante.

### Frontend sur Vercel

1. Vercel → **Add New → Project** → même dépôt.
2. Avant de cliquer sur le déploiement, vérifiez les champs :
   - **Framework Preset** : `Vite`
   - **Root Directory** : `web`
   - **Install Command** : `npm install`
   - **Build Command** : `npm run build`
   - **Output Directory** : `dist`
3. Ajoutez uniquement `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (adresse Render)
   et `VITE_EMPLOYEE_EMAIL_DOMAIN`. Ne mettez jamais `SUPABASE_SERVICE_ROLE_KEY` dans Vercel.
4. Déployez.
5. Revenez dans Supabase (*URL Configuration*) pour ajouter l'adresse Vercel (voir étape 4).
6. Mettez à jour `APP_URL` / `ALLOWED_ORIGINS` sur Render avec l'adresse Vercel définitive.
7. Si Vercel affiche `vite: command not found`, vérifiez dans cet ordre :
   - le projet pointe bien vers `web` ;
   - la commande de build est bien `npm run build` ;
   - le dossier `web/package.json` contient bien le script `"build": "vite build"`.
   Ne cherchez pas à lancer `vite build` directement dans Vercel si les dépendances ne sont pas installées.

### Procédure recommencée à zéro, propre et simple

Si vous repartez de zéro, faites exactement dans cet ordre :

1. Supabase : projet créé, migrations SQL exécutées, test `securite.sql` vert.
2. Local : `server/.env` configuré, `npm test` et `npm run typecheck` OK dans `server`.
3. Local : `web/.env` configuré, `npm run typecheck` et `npm run build` OK dans `web`.
4. Render : créer **seulement** l'API avec `Root Directory = server`.
5. Vérifier `https://.../sante` et `https://.../pret`.
6. Vercel : créer **seulement** le frontend avec `Root Directory = web`.
7. Revenir dans Supabase pour autoriser l'URL Vercel.
8. Revenir dans Render pour remplacer `APP_URL` et `ALLOWED_ORIGINS` par l'URL Vercel finale.
9. Tester la connexion, la création d'atelier et l'ouverture de session.

## 9. Sauvegardes et secrets

- **Export** : Paramètres → « Exporter les données (JSON) » (propriétaire). Fichier unique contenant les données de l'atelier (les photos et PDF restent dans le stockage).
- **Restauration automatique** : non implémentée. Pour une vraie sauvegarde, activez aussi les sauvegardes de votre projet Supabase (offre payante) ou exportez la base régulièrement depuis Supabase.

Ne versionnez jamais `.env`. Si une clé a été exposée, révoquez-la dans Supabase et remplacez-la dans Render/Vercel.

## 10. Application installable (PWA)

Après mise en ligne en HTTPS, le navigateur propose « Installer l'application » (manifeste + service worker de base). Le mode hors connexion complet n'est pas inclus : seule l'interface est mise en cache, les données nécessitent le réseau.

## 11. Tests manuels avant ouverture

Déroulez `docs/TESTS_MANUELS.md` (scénarios A à H du prompt 02, tests 1 à 14 du prompt 03).

## Dépannage

| Symptôme | Piste |
| -------- | ----- |
| « Configuration invalide » au démarrage de l'API | Une variable de `server/.env` manque ou `CODE_HMAC_SECRET` fait moins de 32 caractères |
| Création d'atelier : erreur ou pas d'email | Limite d'emails Supabase atteinte → configurer un SMTP ; vérifier *Site URL* |
| « Origine non autorisée » | `ALLOWED_ORIGINS` ne contient pas l'adresse exacte du frontend |
| Connexion employé impossible | `VITE_EMPLOYEE_EMAIL_DOMAIN` (web) ≠ `EMPLOYEE_EMAIL_DOMAIN` (API) |
| Après connexion : « Aucun atelier associé » | La création de l'atelier a échoué à moitié : recréez le compte |
| Photos qui ne s'affichent pas | Migration `0005_storage.sql` non exécutée, ou abonnement inactif |
| Migration déjà exécutée | Ne la relancez pas à l'aveugle ; restaurez une sauvegarde ou corrigez avec une migration dédiée |
| Vercel affiche une page blanche | Vérifiez le Root Directory `web`, les variables `VITE_*`, puis consultez les logs de build |
| Render démarre puis s'arrête | Vérifiez `npm run build`, `npm start`, `PORT` et les logs du service |
| Vercel dit `vite: command not found` | Le build est lancé au mauvais endroit ou sur la mauvaise commande ; vérifiez `Root Directory = web` et `npm run build` |
| Render dit `Cannot find module .../dist/index.js` | Le build n'a pas créé `dist` ; vérifiez `Root Directory = server`, `npm ci --include=dev && npm run build` et les logs du build |
