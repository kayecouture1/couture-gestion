# Tests manuels — scénarios des prompts 02 et 03

À dérouler après l'installation (`INSTALLATION.md`). Cochez chaque ligne ; en cas d'écart, notez le message exact.
Préparez : un compte Super Admin, deux ateliers **A** et **B** (propriétaires `proprioA`, `proprioB`), un employé `EMP-001` dans A.

## Prompt 02 — accès, abonnements, isolation

| # | Scénario | Résultat attendu |
|---|---|---|
| A | Créer un atelier → vérifier l'email → se connecter sans abonnement | L'écran « saisir le code » s'affiche ; aucune page de l'application n'est accessible (essayez `/app/clients` dans la barre d'adresse : retour à l'écran du code) |
| B | Super Admin : abonnement 30 jours + code → propriétaire saisit le code | « Abonnement activé » ; l'application s'ouvre ; fin = fin de la journée (jour d'activation = jour 1) |
| B2 | Resaisir le même code | « Ce code a déjà été utilisé » |
| B3 | Saisir un code de l'atelier B depuis A | « Code invalide » (sans indiquer qu'il existe ailleurs) |
| B4 | Saisir 5 codes faux de suite | Message « Trop de tentatives » ; réessayer après 15 min |
| C | Dans Supabase (SQL), mettre `fin_at` d'un abonnement dans le passé | Au plus tard 1 minute plus tard (ou après rechargement), l'atelier est renvoyé à l'écran d'abonnement ; une requête API directe sur `clients` renvoie 0 ligne |
| D | Super Admin désactive l'abonnement | Accès bloqué immédiatement ; « Réactiver » rétablit l'accès |
| E | Super Admin prolonge de 10 jours | Accès rétabli si expiré ; nouvelle fin affichée |
| F | Connecté en `proprioA`, ouvrir l'adresse d'un client / commande de B (copier l'ID depuis la base) | « Élément introuvable » / liste vide, jamais de données de B |
| G | Connecté en `proprioA`, ouvrir `/admin` ; appeler `GET /api/admin/stats` avec son jeton | Redirection vers `/app` ; l'API répond **403** |
| H | Dans la console réseau, modifier l'`atelier_id` d'une requête d'écriture (ou appeler `/api/abonnement/activer` avec un autre atelier) | Refus par la base (RLS) ; l'API ignore tout `atelier_id` envoyé |

## Prompt 03 — employés, rôles, permissions

| # | Test | Résultat attendu |
|---|---|---|
| 1 | Créer un employé | Identifiants affichés **une seule fois** ; connexion employé OK ; mot de passe à changer à la première connexion |
| 2 | Attribuer un rôle | Visible dans la liste des employés |
| 3 | Attribuer 2 rôles à la même personne | Les deux apparaissent |
| 4 | Créer un rôle personnalisé | Disponible dans les circuits et les employés |
| 5 | Même rôle pour plusieurs personnes | La page « Rôles » liste toutes les personnes |
| 6 | Modifier une permission d'un profil d'accès | Effet visible à la prochaine navigation de l'employé |
| 7 | Désactiver un employé | Connexion refusée ; ses anciennes opérations restent dans l'historique |
| 8 | Réactiver | Connexion de nouveau possible |
| 9 | Un employé sans `roles.modifier` tente de modifier un profil (appel API direct) | Erreur 403 / « autorisation » |
| 10 | Employé de A → employés de B | Aucune donnée de B |
| 11 | Étape attribuée à une personne précise | Seule cette personne peut la prendre |
| 12 | Étape attribuée à un rôle | Tous les porteurs du rôle la voient |
| 13 | Deux employés cliquent « J'ai pris cet habit » en même temps (deux navigateurs) | Un seul réussit ; l'autre voit « Cet habit vient d'être pris par un autre utilisateur » |
| 14 | Employé avec 2 rôles prend une étape | L'historique de l'habit affiche le rôle utilisé |
| E1 | Secrétaire (avec `roles.attribuer`) s'attribue un profil / modifie son propre profil | Refusé (« permissions que vous ne possédez pas, ni les vôtres ») |
| E2 | Autre utilisateur tente de désactiver le propriétaire | Refusé |

## Sécurité complémentaire

- Accès sans connexion : `GET /api/admin/stats` → 401 ; ouvrir `/app` → redirection vers `/connexion`.
- Session expirée : supprimer le jeton dans l'outil de développement → retour à la connexion.
- Employé désactivé avec session ouverte : toute lecture de données renvoie 0 ligne dès la requête suivante.
- Recherche publique : atelier non visible → « Aucun résultat » ; 16 recherches en 1 minute → « Trop de requêtes ».
- Fichiers : une adresse de photo privée signée expire (10 minutes côté public, 1 heure côté atelier).

## Responsive

Vérifiez sur un téléphone (ou en mode mobile du navigateur) : navigation inférieure, formulaires de commande, boutons de production, tableaux (défilement horizontal), factures.
