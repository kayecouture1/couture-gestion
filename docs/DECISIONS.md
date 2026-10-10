# COUTURE GESTION — REGISTRE DES DÉCISIONS (v0.1)

> **Règle de priorité** : en cas de contradiction entre un ancien prompt (00 à 03) et ce registre, **ce registre prime**, car il reprend les décisions validées les plus récentes.
> Les prompts 00 à 03 ne sont pas réécrits en entier : ce fichier est leur **amendement officiel**. Une version consolidée de chaque prompt peut être régénérée sur demande.

---

## A. Décisions intégrées

| # | Décision validée | Effet sur l'architecture |
|---|---|---|
| 1 | React/TS (Vercel) + Supabase (Auth, PostgreSQL, Storage, RLS) + Node.js (Render) pour la logique sensible ; pas de duplication de logique ; `service_role` jamais côté frontend | `ARCHITECTURE.md` §2–4 |
| 2 | Une commande contient plusieurs habits ; commande = conteneur commercial ; habit = unité de fabrication | Tables `commandes` / `habits` séparées |
| 3 | Modèles de circuits indépendants, **copiés** dans l'habit | `modeles_circuits*` + `habit_etapes` |
| 4 | Recherche publique sans compte par ID, nom, prénom ou téléphone, avec limites anti-abus et infos minimales | Route Node dédiée, pas d'accès `anon` aux tables |
| 5 | Visibilité publique de l'atelier : option, **invisible par défaut** | `ateliers.visible_public` |
| 6 | Abonnement : durée fixée par le Super Admin, démarrage **à l'activation**, validité du code distincte, code unique / usage unique / lié à l'atelier / non réversible / anti brute-force | §7 de l'architecture |
| 7 | Employés sans email, identifiant interne, changement de mot de passe à la première connexion, solution compatible Supabase Auth | §6 (⚠️ choix D1, D3) |
| 8 | Modèle de données évolutif (liste de 21 domaines) | §5 |
| 9 | `atelier_id` partout + RLS + vérification backend | §1, §9 |
| 10 | Rôles de production ≠ permissions | §8 (⚠️ choix D2) |
| 11 | Anti-élévation de privilèges ; propriétaire non désactivable par un autre | §8.2 |
| 12 | Employé désactivé : connexion bloquée, sessions révoquées, historique conservé | §6 |
| 13 | Journal d'audit centralisé, append-only | §9 |
| 14 | Suppression logique / archivage | §5.3 |
| 15 | Confirmation : commande = commercial, habit = fabrication, circuit propre à chaque habit | — |
| 16 | **Séquençage** : un module à la fois, validation en fin de module | Voir contradiction C1 |
| 17–18 | `docs/ARCHITECTURE.md` = source de vérité ; rapport avec Mermaid, matrice, exemples RLS, séparation Supabase/Node, décisions à trancher, éléments non vérifiés | Fait |
| 19 | Tests unitaires, intégration, sécurité, e2e | §13 |
| 20 | Français, FCFA (XOF), téléphones E.164, fuseau Africa/Bamako | §3, §5.3 |
| 21 | Web responsive → PWA → Capacitor | §15 |
| 22 | Hors connexion prévu mais pas construit tout de suite ; compression des photos, uploads interrompus | §10, §15 |
| 23 | Sauvegarde / restauration / export prévus plus tard, sans simulation | §15 |
| 24 | Données de démo séparées et identifiées | `ateliers.est_demo` |

---

## B. Amendements aux prompts existants

### Prompt 00 — Maître
- **Commandes / habits** : la liste « type de vêtement, modèle, photos, circuit, emplacement » appartient désormais à l'**habit**, plus à la commande. La commande garde : client, rendez-vous, prix, avance, reste, paiements, facture.
- **Circuit** : « configurable pour chaque habit » est confirmé ; ajout des **modèles de circuits réutilisables** copiés dans l'habit.
- **Espace client** : recherche conservée (ID, nom, prénom, téléphone) mais **uniquement via le backend**, avec limitation de débit et données minimales.
- **Abonnement** : « choisir une date de début / d'expiration » devient « choisir une **durée** » ; les dates sont calculées à l'activation (voir Prompt 02).
- **Langue / région** : français, FCFA, Africa/Bamako ajoutés.

### Prompt 01 — Analyse et architecture
- « Circuit configurable **par commande** » → **par habit**.
- Le rapport d'analyse demandé est remplacé par `ARCHITECTURE.md` et ce registre. **État actuel constaté : aucun fichier, aucune variable, aucun projet Supabase.**
- Choix confirmés : Vercel (front), Render (back), Supabase (données, Auth, Storage).

### Prompt 02 — Authentification, ateliers, abonnements
- §11 « sélectionner date de début et date d'expiration » → **durée** + fenêtre d'activation du code.
- §12–13 : le code est stocké sous forme **non réversible** ; il n'est affiché **qu'une fois** au Super Admin (⚠️ D5).
- §15 : l'expiration est appliquée **dans les politiques RLS** (et pas seulement dans Node), car le frontend parle directement à Supabase.
- §8–9 : Super Admin dans une table dédiée `super_admins` ; premier compte créé par script d'initialisation.
- §3–5 : « email non vérifié » ne concerne que les comptes avec email ; les employés sans email se connectent autrement (Prompt 03).

### Prompt 03 — Employés, rôles, permissions
- §2 / §13 : email facultatif ; identifiant interne ; blocage de connexion à la désactivation **obligatoire** (plus « si le système le prévoit »), avec révocation des sessions.
- §3–10 : les « rôles » du prompt (Secrétaire, Responsable qualité…) portant des permissions sont séparés en **rôles de production** (étapes) et **profils d'accès** (permissions) (⚠️ D2).
- §2 : « ne jamais afficher un mot de passe temporaire en clair » est précisé : affichage **unique** au propriétaire (⚠️ D3).
- §15–19 : l'attribution porte sur les **étapes d'habit** (`habit_etapes`), pas sur la commande.
- Ajout : protection contre l'élévation de privilèges, propriétaire protégé.

---

## C. Contradictions restantes

| # | Contradiction | Ma proposition |
|---|---|---|
| **C1** | Au début de cette conversation, tu as demandé que je **crée le projet complet d'un bloc**. Ta décision n°16 impose maintenant **un module à la fois**, avec validation entre chaque. | J'applique la règle la plus récente (module par module). **Confirme-le.** |
| C2 | Prompt 03 : l'exemple du rôle « Responsable qualité » avec une permission « Confirmer contrôle qualité ». Aucune fonctionnalité de contrôle qualité n'existe dans le cahier des charges. | Ne pas créer cette permission tant que la fonction n'existe pas. |
| C3 | Prompt 03 §10 : « Créer le rôle X avec des permissions ». Décision n°10 : rôles de production et permissions séparés. | Voir D2. |
| C4 | Prompt 00 : sur l'espace client, « il ne doit jamais voir les données internes ». Décision n°4 : recherche par nom, prénom ou téléphone ouverte au public. Le risque est qu'un nom partagé expose l'habit d'une autre personne. | Voir D4. |
| C5 | Prompt 02 mentionne « abonnement expiré » comme erreur de connexion. Avec RLS, la connexion réussit mais l'accès métier est bloqué. | Message clair après connexion, redirection vers l'écran « saisir le code ». |

---

## D. Décisions qui nécessitent ton choix

Chaque point a une **recommandation** ; réponds simplement « D1 ok », ou donne ton choix.

**D1 — Connexion des employés sans email.**
Recommandation : l'employé saisit **code atelier + identifiant + mot de passe**. L'identifiant (ex. `MONTEUR-001`) est unique **par atelier** ; le code atelier évite les doublons entre ateliers.
Alternative : identifiant unique sur toute la plateforme (plus simple à saisir, mais les identifiants courts seraient vite pris).

**D2 — Modèle de permissions.**
Recommandation : trois notions : **rôles de production** (étapes), **profils d'accès** (groupes de permissions, ex. « Secrétaire ») et **permissions**. Un membre peut avoir plusieurs profils ; ses droits sont l'union.
Alternative : permissions cochées directement sur chaque employé (plus rigide, plus long à gérer).

**D3 — Mot de passe temporaire d'un employé.**
Recommandation : généré par le serveur, **affiché une seule fois** au propriétaire (avec bouton « copier »), changement obligatoire à la première connexion.
Alternative : le propriétaire choisit lui-même le mot de passe initial (moins sûr).

**D4 — Recherche publique par nom / prénom / téléphone.**
Je conserve la recherche comme demandé. Je recommande ces protections :
- l'atelier doit être choisi **avant** la recherche ;
- le **téléphone seul**, ou **nom + prénom ensemble**, déclenche une recherche (pas un seul mot de nom) ;
- les résultats affichent l'**ID de l'habit, le type, la photo, l'étape**, mais **jamais le nom complet ni le téléphone** (au plus les initiales) ;
- plafond de résultats et limitation de débit.
Dis-moi si tu veux assouplir l'un de ces points.

**D5 — Affichage du code d'abonnement.**
Recommandation : le code n'est montré **qu'une fois** au Super Admin à la création (copie / partage WhatsApp). S'il est perdu, on en **régénère** un nouveau (l'ancien est invalidé).
Alternative : stocker le code chiffré pour pouvoir le réafficher (moins sûr).

**D6 — Valeurs anti brute-force et fenêtre d'activation.**
Recommandation : 5 échecs → blocage 15 minutes pour cet utilisateur, 10 minutes par IP ; blocage prolongé après 15 échecs en 24 h. Fenêtre d'activation par défaut d'un code : **30 jours** (modifiable par le Super Admin).

**D7 — Comptage des jours d'abonnement.**
Ton exemple (30 jours, activé le 5 octobre, fin le 3 novembre) correspond à : **le jour d'activation compte pour le jour 1**, et l'abonnement se termine à la **fin de la journée** du dernier jour (23 h 59 min 59 s, heure de Bamako).
Confirme que c'est bien la règle voulue (sinon : 30 × 24 h exactes à partir de l'heure d'activation, soit fin le 4 novembre à la même heure).

**D8 — Visibilité des fichiers.**
Recommandation : `logos` en lecture publique ; photos d'habits, de modèles et documents **privés**, servis au public par **URLs signées courtes** après une recherche valide.
Alternative : photos publiques (plus simple, mais n'importe qui possédant le lien peut les voir).

**D9 — Outils de test.**
Recommandation : Vitest (unitaires), Playwright (e2e), tests SQL pour les règles RLS. Modifiable.

**D10 — Régions d'hébergement.**
À choisir lors de la création des projets Supabase et Render. Je recommande de choisir la région **la plus proche de Bamako** proposée par chacun et de mesurer la latence avant de figer.

---

## E. Éléments que je n'ai pas pu vérifier

- Aucun fichier, dépôt, variable d'environnement, projet Supabase, configuration Vercel ou Render n'existe dans mon environnement : **rien n'a pu être inspecté**.
- Je n'ai pas consulté la documentation officielle de Supabase, Render ou Vercel pour ce document : les comportements indiqués (comptes sans email, révocation de sessions, politiques Storage, quotas, offres gratuites) restent à confirmer.
- Les exemples SQL de `ARCHITECTURE.md` n'ont **pas été exécutés**.

---

## F. Prochaine étape proposée

1. Tu valides ou ajustes **C1** et **D1 à D10**.
2. Je mets à jour `ARCHITECTURE.md` (v0.2).
3. Tu m'envoies le prompt du module à construire (probablement **Module 02**, puis 03).
4. À la fin de chaque module : tests, vérification des permissions et des données, rapport de validation, liste de ce qui reste.


---

## G. Choix appliqués dans l'implémentation (v0.2)

Faute de réponse aux points D1 à D10 avant la demande du projet complet, **mes recommandations ont été appliquées**. Tout reste modifiable.

| Point | Choix appliqué |
|---|---|
| C1 | Projet complet livré d'un bloc, comme demandé en dernier |
| D1 | Employé sans email : **code atelier + identifiant + mot de passe** ; compte Supabase Auth avec adresse technique `<code>.<identifiant>@<EMPLOYEE_EMAIL_DOMAIN>` |
| D2 | Trois notions : rôles de production, profils d'accès (« Production » et « Secrétaire » créés par défaut, modifiables), permissions |
| D3 | Mot de passe temporaire généré par le serveur, affiché **une seule fois**, changement obligatoire à la première connexion |
| D4 | Recherche publique : atelier choisi d'abord ; ID, **ou** téléphone, **ou** nom ET prénom exacts ; résultats limités à 10 ; initiales du client seulement ; limitation de débit ; 120 derniers jours |
| D5 | Code d'abonnement affiché **une seule fois** ; régénérable tant que l'abonnement n'est pas activé |
| D6 | 5 échecs en 15 min ou 15 en 24 h par utilisateur, 10 en 10 min par IP → blocage ; validité par défaut d'un code : 30 jours |
| D7 | Jour d'activation = jour 1 ; fin à la fin du dernier jour (heure de Bamako) |
| D8 | `logos` public ; photos d'habits/modèles et factures **privées** (adresses signées temporaires) |
| D9 | `node:test` (serveur) + tests SQL ; pas de Vitest ni Playwright dans cette version |
| D10 | Région à choisir à la création des projets (voir `INSTALLATION.md`) |
