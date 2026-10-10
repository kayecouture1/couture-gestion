# État du projet (v0.3) — rapport honnête

## Ce qui a réellement été vérifié

| Vérification | Résultat |
|---|---|
| Syntaxe de **tous** les fichiers TypeScript / TSX (78 fichiers) | ✅ aucune erreur |
| Tests unitaires du serveur (`server/test/lib.test.ts` : codes, téléphones, mots de passe, images) | ✅ 5/5 |
| Audit de cohérence automatique : imports, fonctions SQL appelées (19), tables utilisées (35), appels frontend ↔ routes API (26), permissions (44, toutes utilisées, aucune inconnue), pages ↔ routes (37 pages, 39 routes), liens de navigation | ✅ aucune incohérence |
| Typecheck partiel serveur et frontend (sans les paquets npm) | ✅ aucune erreur de logique relevée |

## Ce qui n'a PAS pu être vérifié (à faire chez vous — `INSTALLATION.md`)

- ❌ **Aucun fichier SQL n'a été exécuté** (pas de PostgreSQL ici). Des erreurs sont possibles dans les 6 migrations. `supabase/tests/securite.sql` (12 familles de tests) est fait pour les révéler : **à lancer en premier**. Il n'a lui-même jamais été exécuté.
- ❌ `npm install` / `npm run build` jamais exécutés (pas de réseau).
- ❌ Aucune requête réelle vers Supabase : comportement exact de Supabase Auth (comptes à adresse technique, blocage de compte, e-mails, réponse « adresse déjà utilisée »), Storage et PostgREST à confirmer.
- ❌ Aucun test dans un navigateur ou sur téléphone : le responsive est conçu mais non vérifié visuellement.
- ❌ Génération PDF (pdfkit), export JSON, service worker, graphiques SVG : jamais exécutés.
- ❌ Deux utilisateurs qui cliquent exactement en même temps : atomique par conception (`UPDATE … WHERE statut='disponible'`), à confirmer (`TESTS_MANUELS.md`, test 13).

## Modules livrés

| Module | Contenu |
|---|---|
| Authentification | Connexion email / employé, vérification d'email, mot de passe oublié, changement forcé, création d'atelier avec logo |
| Super Admin | Tableau de bord cliquable, ateliers (activer / désactiver), abonnements complets (créer, régénérer le code, modifier dates, prolonger, désactiver, réactiver, supprimer si jamais activé), historique, **utilisateurs** (liste globale, désactiver / réactiver), **paramètres globaux** (durée et validité par défaut, contact support), premier compte par script |
| Abonnements | Codes HMAC à usage unique, tentatives limitées en base, expiration appliquée par la RLS |
| Employés / rôles / permissions | Rôles de production, profils d'accès, permissions (44), plusieurs rôles par personne, anti-élévation de privilèges, désactivation + blocage de compte, suppression d'un rôle inutilisé, photos de profil, journal d'audit |
| Clients et mesures | 4 catégories, mesures extensibles, reprise automatique dans les commandes, archivage / restauration |
| Commandes / habits | Plusieurs habits par commande, photos compressées, circuit copié par habit, modèles de circuits, proposition de date (accepter / modifier / rejeter avec motif) |
| Production | « J'ai pris cet habit » atomique, « Terminé » avec durée, validation finale, emplacement, appel / WhatsApp préparé, **historique des notifications** |
| **Essayages** et **retouches** | Planification et suivi par habit et en liste globale, statuts, coût informatif |
| Argent | Paiements contrôlés, annulation motivée, factures PDF numérotées, partage WhatsApp par lien, dépenses |
| **Statistiques** | Encaissé / dépenses / commandes par mois (graphiques SVG), vêtements les plus commandés, durée moyenne par étape, productivité par employé |
| Public | Liste des ateliers visibles, suivi sans compte (ID, téléphone, nom + prénom) |
| Transverse | Tableau de bord, planning, **recherche globale**, **mon profil**, paramètres (capacité, jours, types, emplacements, mesures, logo), **export JSON de l'atelier**, **PWA de base** (installable), bandeau « hors connexion », **données de démonstration séparées** (`npm run seed:demo`) |

## Non implémenté ou partiel (soyons clairs)

- **Mode hors connexion complet** (file d'actions et synchronisation) : seulement l'interface en cache, un bandeau d'alerte, la compression d'images et les nouvelles tentatives d'envoi.
- **Restauration** d'un export dans un atelier : non fournie (l'export JSON l'est).
- **Envoi automatique** de messages WhatsApp / SMS : seul le lien prérempli existe.
- **Application Android / iOS** (Capacitor) : architecture compatible, rien de généré.
- **Tests de bout en bout** (Playwright) et tests d'intégration automatiques API ↔ base : remplacés par `TESTS_MANUELS.md` et `securite.sql`.
- Super Admin : pas de réinitialisation de mot de passe d'un utilisateur ni de suppression d'atelier.
- Statistiques : pas d'export de graphiques, pas de comparaison entre ateliers.
- Retouche : le coût n'est pas ajouté automatiquement au total de la commande.

## Risques connus avant une mise en production

1. Lancer et corriger les migrations SQL puis `securite.sql` (priorité n°1).
2. Configurer un **SMTP** : les e-mails intégrés de Supabase sont très limités.
3. Offre gratuite de Render : mise en veille (premier appel lent).
4. La recherche publique par nom / prénom / téléphone révèle, même minimalement, l'existence d'un habit à qui connaît ces informations (`DECISIONS.md` D4).
5. Un jeton déjà émis reste valable jusqu'à son expiration pour l'API Supabase ; la base refuse néanmoins toute lecture / écriture d'un membre désactivé (la RLS vérifie le statut à chaque requête).
6. Limiteurs de débit de l'API en mémoire (une instance) ; compteurs du code d'abonnement durables en base.
7. Photos téléversées avant une commande échouée : orphelines dans le stockage (nettoyage non fait).
8. Les collègues d'un même atelier voient nom, téléphone et email des autres membres (nécessaire pour « qui a pris quoi »).
9. La suppression de démonstration (`--supprimer`) supprime les lignes dans l'ordre des dépendances : à tester.
