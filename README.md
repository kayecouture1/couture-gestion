# COUTURE GESTION

Plateforme web de gestion d'ateliers de couture : clients, mesures, commandes (plusieurs habits par commande),
circuits de fabrication, employés et permissions, paiements, factures PDF, suivi public pour les clients,
abonnements manuels pilotés par un Super Administrateur.

```
couture-gestion/
├── supabase/migrations/   Schéma SQL, RLS, fonctions métier, Storage (à exécuter dans l'ordre)
├── supabase/tests/        Tests de sécurité SQL (isolation, expiration, escalade, code à usage unique)
├── server/                API Node.js / Express / TypeScript (Render)
├── web/                   Frontend React / TypeScript / Vite (Vercel)
└── docs/                  INSTALLATION.md, TESTS_MANUELS.md, ETAT_DU_PROJET.md, ARCHITECTURE.md, DECISIONS.md
```

La migration `0007_notifications_taches.sql` ajoute les notifications ciblées des tâches de production,
leur compteur dans l'en-tête et les actions de lecture/ignorance. Une alerte est automatiquement clôturée
lorsque l'étape est prise par un employé.

Pour la préparation à la charge, les tests k6 et les étapes Supabase/Render/Vercel, voir
[`docs/SCALABILITE.md`](docs/SCALABILITE.md).

**Commencez par `docs/INSTALLATION.md`**, puis lisez `docs/ETAT_DU_PROJET.md` : il dit honnêtement ce qui a été
vérifié, ce qui ne l'a pas été, et ce qui reste à faire.

## Principes de sécurité

- Isolation des ateliers : `atelier_id` partout, clés étrangères composites, RLS, vérifications côté API.
- Les permissions, l'expiration de l'abonnement et l'isolation sont appliquées **dans la base** (RLS) : le frontend
  ne sert qu'à l'affichage.
- `SUPABASE_SERVICE_ROLE_KEY` et `CODE_HMAC_SECRET` n'existent que sur le serveur (Render).
- Codes d'abonnement : aléatoires, stockés sous forme d'empreinte HMAC, à usage unique, tentatives limitées.
- Journal d'audit en ajout seul (aucune écriture possible depuis l'application).
