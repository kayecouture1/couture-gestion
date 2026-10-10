# Préparation à la charge et à la production

Ce document décrit ce qui est automatisé dans le code et ce qui doit être configuré
sur Supabase, Render et Vercel. Aucun document ne peut garantir l'absence totale de
bugs : la capacité doit être mesurée sur une infrastructure équivalente à la production.

## Ce qui a été renforcé dans le code

- Les pages privées du frontend sont chargées à la demande, afin de réduire le JavaScript
  initial envoyé à un visiteur public.
- Les lectures publiques peu changeantes sont mises en cache quelques secondes dans chaque
  instance API et bénéficient de `Cache-Control`.
- Les URLs signées des photos de suivi sont réutilisées pendant leur durée de validité.
- Les requêtes atelier et abonnement de la recherche publique sont lancées en parallèle.
- L'API expose `/sante` (liveness) et `/pret` (readiness avec vérification Supabase).
- Chaque réponse porte un `x-request-id`, réutilisant celui du proxy s'il est fourni.
- Les timeouts HTTP et l'arrêt propre de Node sont configurés pour les déploiements sans
  requêtes coupées en plein traitement.
- La vérification périodique du contexte dans le frontend est espacée à cinq minutes.

Le cache en mémoire est volontairement court et ne remplace pas un cache distribué :
avec plusieurs instances, chaque instance possède son cache. Les données d'autorisation
ne sont jamais mises en cache.

## Test de charge local ou de préproduction

Installer [k6](https://k6.io/docs/get-started/installation/) sur la machine de test,
puis lancer l'API ou utiliser une URL de préproduction :

Pour un test local, l'API doit être démarrée dans un terminal séparé (`npm run dev`)
et l'URL par défaut est `http://localhost:3000`. Pour Render, remplacez l'URL d'exemple
par l'URL réelle du service. Le script refuse les domaines d'exemple pour éviter un
test de capacité sans serveur réellement accessible.

```powershell
k6 run -e API_URL=http://localhost:3000 load/k6-public.js
```

Pour tester aussi la recherche publique, fournir un atelier de test :

```powershell
k6 run `
  -e API_URL=http://localhost:3000 `
  -e ATELIER_ID=00000000-0000-0000-0000-000000000000 `
  load/k6-public.js
```

Le zéro UUID est seulement un test de disponibilité : il ne vérifie aucune donnée
de suivi réelle. Pour tester `/public/suivi`, utilisez l'UUID d'un atelier de test
et un code d'habit de test.

Avant le test de charge, vérifiez d'abord que l'API répond :

```powershell
Invoke-RestMethod http://localhost:3000/sante
Invoke-RestMethod http://localhost:3000/pret
```

Le scénario complet génère jusqu'à 1 000 itérations par seconde, soit environ
3 000 requêtes par seconde sans `ATELIER_ID`, et davantage si le suivi public est
activé. Commencez par un test court et réduit avant le scénario de 12 minutes :

```powershell
k6 run -e SMOKE=1 -e API_URL=http://localhost:3000 load/k6-public.js
```

Ne jamais lancer ce test sur la production sans fenêtre autorisée. Le scénario commence
à 100 requêtes/s, monte à 500 puis 1000 requêtes/s et vérifie les p95/p99. Pour simuler
des utilisateurs authentifiés, créer un second scénario avec des comptes de test et des
jetons temporaires : ne mettez jamais de mot de passe ou de jeton dans le dépôt.

## Seuils de décision

Une étape est acceptable seulement si, pendant le palier, les seuils suivants sont tenus :

- moins de 1 % de requêtes en erreur ;
- p95 inférieur à 1 seconde ;
- p99 inférieur à 2 secondes ;
- aucune erreur RLS ou fuite de données ;
- aucune croissance continue de la mémoire ;
- aucune file de connexions Supabase saturée.

Augmenter ensuite par paliers de 25 %, et conserver les résultats. La capacité annoncée
est le plus grand palier stable, pas le nombre théorique de VUs.

## Configuration obligatoire du fournisseur

### Supabase

1. Choisir une région proche des utilisateurs et une offre dont les limites de base,
   connexions, stockage et bande passante couvrent le palier mesuré.
2. Vérifier les limites dans le tableau de bord pendant un test.
3. Activer les sauvegardes adaptées au besoin de reprise.
4. Restaurer une sauvegarde sur un projet séparé au moins une fois avant l'ouverture.
5. Examiner les requêtes lentes et leurs plans ; ajouter un index seulement après mesure.
6. Configurer un SMTP de production pour éviter le plafond du service email intégré.

### Render

1. Utiliser `/sante` pour le liveness et `/pret` pour la readiness.
2. Activer le redémarrage automatique et le déploiement progressif si disponible.
3. Dimensionner l'instance avec la mémoire nécessaire à la génération PDF.
4. Activer l'autoscaling après un test ; commencer avec au moins deux instances si
   l'abonnement le permet.
5. Si le rate limiting doit être global entre instances, ajouter un store Redis partagé
   et un `RedisStore` pour `express-rate-limit`. Les compteurs actuels sont par instance.
6. Configurer les variables secrètes uniquement dans Render, jamais dans Vercel.

### Vercel

1. Déployer uniquement le dossier `web`.
2. Vérifier que le frontend ne contient que la clé Supabase publique `anon`.
3. Configurer les domaines autorisés côté CORS et Supabase Auth.
4. Vérifier les règles de cache et les routes SPA après chaque déploiement.

## Avant l'ouverture publique

- Exécuter `supabase/tests/securite.sql` sur une base de test.
- Exécuter `npm test` et `npm run typecheck` dans `server`.
- Exécuter `npm run typecheck` et `npm run build` dans `web`.
- Tester une migration sur une copie avant production.
- Tester la restauration et la rotation des secrets.
- Vérifier les alertes 5xx, latence, mémoire, connexions, stockage et erreurs frontend.
- Faire un test de montée en charge puis un test de panne d'une instance.
- Garder une procédure de retour arrière et un contact d'astreinte.
