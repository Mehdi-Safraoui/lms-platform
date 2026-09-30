# Procédure de déploiement

Déploiement cible : **Vercel** (déploiement actuel : `lms-platform-ten-gamma.vercel.app`).

## 1. Variables d'environnement (Vercel)

Voir [.env.example](.env.example) pour la liste complète et leur origine. Dans Vercel → Settings → Environment Variables, renseigner toutes les variables pour **Production** (et **Preview** si les previews doivent fonctionner).

Pièges à connaître :

- **`NEXT_PUBLIC_APP_URL`** doit pointer vers le vrai domaine de prod (`https://lms-platform-ten-gamma.vercel.app`), pas `localhost`. Elle sert aux `success_url`/`cancel_url` de Stripe Checkout.
- **`STRIPE_WEBHOOK_SECRET`** et **`CLERK_WEBHOOK_SIGNING_SECRET`** de prod sont **différents** des secrets utilisés en local (voir étape 3). Ne jamais copier une valeur locale vers Vercel ou inversement.
- **`OPENAI_API_KEY`** — nécessaire pour la génération de formation par IA (super_admin et admin_tenant) et le chat apprenant. **`OPENAI_MODEL_GENERATION`** (défaut `gpt-6.1-sol`) et **`OPENAI_MODEL_CHAT`** (défaut `gpt-6-luna`) sont optionnelles : sans valeur, les défauts de `lib/openai/index.ts` s'appliquent. L'ancienne variable `OPENAI_MODEL` n'est plus lue.
- **`VOYAGE_API_KEY`** / **`VOYAGE_MODEL`** (`voyage-3`) — nécessaires pour tout le pipeline RAG V2 (upload de documents, génération de formation par un `admin_tenant`, chat apprenant) : voir ARCHITECTURE.md, section RAG. Sans `VOYAGE_API_KEY`, l'upload d'un document reste bloqué en `ingestion_status = erreur` (échec silencieux à l'usage, pas d'erreur au démarrage de l'app).
- **`YOUTUBE_API_KEY`** — nécessaire pour la recherche/validation de vidéos (`/api/admin/youtube/search`, `/resolve`). Doit être restreinte à "YouTube Data API v3" dans Google Cloud Console. Sans elle, seule cette fonctionnalité échoue.
- **`NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL`** doit valoir `/create-organization` (pas `/invite-members`, une ancienne valeur qui menait à une impasse — voir ARCHITECTURE.md, onboarding chemin B). Si cette variable n'est pas à jour sur Vercel, l'auto-inscription d'un admin_tenant reste bloquée indéfiniment sur `WaitForSync`.

## 2. Migrations Supabase

Le projet n'utilise pas encore la CLI Supabase pour appliquer les migrations automatiquement. Procédure manuelle :

1. Ouvrir Supabase → SQL Editor (sur le projet de prod)
2. Exécuter chaque fichier de [supabase/migrations/](supabase/migrations/) **dans l'ordre chronologique** (le nom du fichier commence par un timestamp)
3. Vérifier qu'aucune erreur n'apparaît (les migrations ne sont pas idempotentes pour la plupart — ne pas les rejouer si déjà appliquées)
4. **Appliquer une nouvelle migration AVANT de déployer le code qui s'en sert** : les migrations sont écrites pour rester compatibles avec le code déjà en ligne, l'inverse n'est pas vrai.

## 3. Webhooks à configurer

### Clerk

Dashboard Clerk → Webhooks → endpoint pointant vers :
```
https://<domaine-prod>/api/webhooks/clerk
```
Events à écouter : `organization.created`, `organization.updated`, `organizationMembership.created`, `organizationMembership.updated`.
Copier le **Signing Secret** généré dans `CLERK_WEBHOOK_SIGNING_SECRET` (Vercel).

### Stripe

Dashboard Stripe → Developers → Webhooks → endpoint pointant vers :
```
https://<domaine-prod>/api/webhooks/stripe
```
Events à écouter : `checkout.session.completed`, `invoice.payment_failed`, `customer.subscription.deleted`.
Copier le **Signing secret** généré dans `STRIPE_WEBHOOK_SECRET` (Vercel).

> Chaque endpoint Stripe a son propre secret. Si l'app tourne aussi en local avec `stripe listen`, ce dernier a un secret distinct — c'est normal, les deux coexistent sans conflit.

## 4. Déploiement

Push sur la branche connectée à Vercel (déploiement automatique), ou `vercel --prod` en CLI.

## 5. Vérification post-déploiement

- [ ] Connexion (sign-in / sign-up) fonctionne
- [ ] Un paiement de test (`/pricing`, carte `4242 4242 4242 4242`) redirige bien vers `/org?checkout=success`
- [ ] Dashboard Stripe → Webhooks → endpoint prod → onglet Événements : le dernier `checkout.session.completed` est en `200`
- [ ] La table `tenants` (Supabase) reflète bien `subscription_status = active` après le test
- [ ] La cloche de notifications reçoit bien les notifs `subscription_activated`
- [ ] Génération de formation par IA (`/admin/catalog/new` → « Générer avec l'IA » → documents, cadrage, structure, génération d'une leçon) fonctionne en prod. Les routes de génération ont `maxDuration = 180` (un appel à `gpt-6.1-sol` a été mesuré à ~30-40 s) : à vérifier contre la limite de durée du plan Vercel. Limite d'upload applicative : 4 Mo par fichier (`MAX_FILE_SIZE_BYTES` dans `app/api/org/formations/[id]/knowledge-sources/route.ts`), sous la limite de body ~4,5 Mo des Serverless Functions.

## Développement local

Pour tester le webhook Stripe en local, le `stripe listen` doit tourner en parallèle du serveur dev :

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Le secret affiché par cette commande va dans `STRIPE_WEBHOOK_SECRET` de `.env.local` (distinct du secret de prod — voir étape 3).

Le webhook Clerk n'a pas d'équivalent CLI dans ce projet : pour tester la synchronisation Organization/Membership en local, il faut soit utiliser un tunnel (ex. `ngrok`) pointé vers l'endpoint du Dashboard Clerk, soit tester directement en environnement déployé.
