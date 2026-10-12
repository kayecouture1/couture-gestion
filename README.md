# COUTURE GESTION

Application web en français pour gérer un atelier de couture : clients et mesures, commandes et habits,
circuits de production, employés et permissions, paiements, factures PDF, suivi public et abonnements.
L'interface utilise les montants en FCFA (XOF) et le fuseau `Africa/Bamako`.

## Démarrage rapide

1. Installez Node.js 20 ou une version plus récente.
2. Suivez [`docs/INSTALLATION.md`](docs/INSTALLATION.md) dans l'ordre.
3. Exécutez les tests SQL et les tests locaux avant tout déploiement.
4. Déroulez les scénarios de [`docs/TESTS_MANUELS.md`](docs/TESTS_MANUELS.md).

Le déploiement est séparé en deux services :

- `server/` : API Node.js/Express/TypeScript, à déployer sur Render ;
- `web/` : frontend React/TypeScript/Vite, à déployer sur Vercel ;
- Supabase : Auth, PostgreSQL, RLS et Storage.

## Structure du dépôt

```text
supabase/migrations/   migrations SQL à exécuter dans l'ordre (0001 à 0011)
supabase/tests/        tests d'isolation, permissions et sécurité
server/                API, scripts d'administration et tests unitaires
web/                   frontend et tests du navigateur
docs/                  installation, architecture, état, décisions et tests manuels
load/                  scénario k6 de charge publique
```

La migration `0007_notifications_taches.sql` ajoute les notifications ciblées des tâches de production,
leur compteur dans l'en-tête et les actions de lecture/ignorance. Une alerte est automatiquement clôturée
lorsque l'étape est prise par un employé.

## Documentation

| Document | Utilité |
|---|---|
| [`docs/INSTALLATION.md`](docs/INSTALLATION.md) | Installation locale, Supabase, variables, tests et déploiement |
| [`docs/TESTS_MANUELS.md`](docs/TESTS_MANUELS.md) | Parcours fonctionnels et contrôles de sécurité à réaliser |
| [`docs/ETAT_DU_PROJET.md`](docs/ETAT_DU_PROJET.md) | Fonctionnalités livrées, limites et vérifications restantes |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Répartition des responsabilités et règles techniques |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Décisions produit et compromis connus |
| [`docs/SCALABILITE.md`](docs/SCALABILITE.md) | Préparation à la charge et checklist de production |

## Sécurité à retenir

- `SUPABASE_SERVICE_ROLE_KEY` et `CODE_HMAC_SECRET` restent uniquement côté serveur.
- Le frontend ne reçoit que la clé Supabase publique `anon`.
- L'isolation entre ateliers, les permissions et l'abonnement actif sont contrôlés par PostgreSQL/RLS.
- Les codes d'abonnement sont à usage unique et stockés sous forme d'empreinte HMAC.
- Ne committez jamais un fichier `.env`, un mot de passe, un jeton ou une clé secrète.

## Principes de sécurité

- Isolation des ateliers : `atelier_id` partout, clés étrangères composites, RLS, vérifications côté API.
- Les permissions, l'expiration de l'abonnement et l'isolation sont appliquées **dans la base** (RLS) : le frontend
  ne sert qu'à l'affichage.
- `SUPABASE_SERVICE_ROLE_KEY` et `CODE_HMAC_SECRET` n'existent que sur le serveur (Render).
- Codes d'abonnement : aléatoires, stockés sous forme d'empreinte HMAC, à usage unique, tentatives limitées.
- Journal d'audit en ajout seul (aucune écriture possible depuis l'application).
