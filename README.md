# LMS Ahead Digital

Plateforme LMS (*Learning Management System*) **multi-tenant augmentée par l'IA**, développée pour Ahead Digital : Ahead (super-admin) fournit un catalogue de formations IA à des entreprises clientes (tenants), qui gèrent leurs propres apprenants — et peuvent, en V2, créer leurs propres formations à partir de leurs documents internes grâce à un pipeline RAG.

Pour l'architecture détaillée (schémas, choix techniques justifiés, pipeline RAG complet) voir [ARCHITECTURE.md](ARCHITECTURE.md). Pour la procédure de déploiement voir [DEPLOYMENT.md](DEPLOYMENT.md).

## Sommaire

- [Stack technique](#stack-technique)
- [Prérequis](#prérequis)
- [Installation et lancement en local](#installation-et-lancement-en-local)
- [Variables d'environnement](#variables-denvironnement)
- [Base de données (Supabase)](#base-de-données-supabase)
- [Rôles et comment naviguer dans l'application](#rôles-et-comment-naviguer-dans-lapplication)
- [Structure du projet](#structure-du-projet)
- [Scripts disponibles](#scripts-disponibles)
- [Vérifications avant de livrer une modification](#vérifications-avant-de-livrer-une-modification)
- [Déploiement](#déploiement)
- [Documentation complémentaire](#documentation-complémentaire)

## Stack technique

| Domaine | Technologie |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Turbopack) |
| Authentification & multi-tenant | Clerk (Organizations = tenants) |
| Base de données | Supabase (PostgreSQL + Row-Level Security + extension pgvector) |
| Paiements / abonnements | Stripe (Checkout + Webhooks) |
| Génération de contenu par IA | OpenAI (API Responses) |
| Embeddings / recherche sémantique (RAG) | Voyage AI (`voyage-3`, 1024 dimensions) |
| Recherche de vidéos | YouTube Data API v3 |
| Extraction de documents | `unpdf` (PDF), `mammoth` (Word), `JSZip` (PowerPoint), `cheerio` (pages web) |
| Déploiement | Vercel |

## Prérequis

- **Node.js 20+** (développé et testé avec Node 22).
- Un compte sur chacun des services suivants, avec les clés API correspondantes :
  - [Clerk](https://clerk.com) — authentification et gestion des Organizations.
  - [Supabase](https://supabase.com) — base de données PostgreSQL.
  - [Stripe](https://stripe.com) — abonnements (mode test suffit en développement).
  - [OpenAI](https://platform.openai.com) — génération de contenu par IA.
  - [Voyage AI](https://www.voyageai.com) — embeddings pour le pipeline RAG (V2).
  - [Google Cloud Console](https://console.cloud.google.com) — clé API restreinte à "YouTube Data API v3", pour la recherche de vidéos.
- La [CLI Stripe](https://stripe.com/docs/stripe-cli) si vous voulez tester les webhooks Stripe en local.

## Installation et lancement en local

```bash
# 1. Cloner le dépôt
git clone https://github.com/Mehdi-Safraoui/lms-platform.git
cd lms-platform

# 2. Installer les dépendances
npm install

# 3. Copier le modèle de configuration et renseigner les vraies valeurs
cp .env.example .env.local
# → éditer .env.local (voir la section Variables d'environnement ci-dessous)

# 4. Appliquer les migrations de base de données (voir section suivante)

# 5. Lancer le serveur de développement
npm run dev
```

L'application est alors accessible sur [http://localhost:3000](http://localhost:3000).

## Variables d'environnement

Le fichier [.env.example](.env.example) liste **toutes** les variables nécessaires, avec un commentaire pour chacune expliquant à quoi elle sert et où la récupérer. Résumé :

| Variable | Sert à |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Authentification Clerk |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Synchronisation Organizations/membres Clerk → base Supabase |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Accès à la base de données |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Paiements et abonnements |
| `STRIPE_PRICE_DECOUVERTE`, `STRIPE_PRICE_CREATION`, `STRIPE_PRICE_ENTREPRISE` | Identifiants des 3 offres dans le catalogue Stripe |
| `OPENAI_API_KEY`, `OPENAI_MODEL_GENERATION`, `OPENAI_MODEL_CHAT` | Génération de formation par IA (défaut `gpt-6.1-sol`) + agent conversationnel (défaut `gpt-6-luna`) |
| `VOYAGE_API_KEY`, `VOYAGE_MODEL` | Embeddings du pipeline RAG (V2) — sans elle, l'upload d'un document reste bloqué en erreur |
| `YOUTUBE_API_KEY` | Recherche/validation de vidéos pour les leçons |
| `NEXT_PUBLIC_APP_URL` | URL publique de l'app (redirections Stripe et invitations Clerk) |

**Piège classique** : `NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL` doit valoir `/create-organization` — voir [ARCHITECTURE.md](ARCHITECTURE.md#onboarding-dune-nouvelle-entreprise-cliente) pour comprendre pourquoi c'est indispensable (sans cette redirection, un nouvel administrateur qui s'inscrit reste bloqué sans compte fonctionnel).

## Base de données (Supabase)

Le projet n'utilise pas encore la CLI Supabase pour les migrations. Procédure manuelle, à faire une fois sur un projet Supabase neuf :

1. Ouvrir votre projet Supabase → **SQL Editor**.
2. Exécuter chaque fichier de [supabase/migrations/](supabase/migrations/) **dans l'ordre chronologique** (le nom commence par un timestamp).
3. Vérifier qu'aucune erreur n'apparaît — les migrations ne sont pas idempotentes pour la plupart, ne pas les rejouer si déjà appliquées.

Deux webhooks doivent aussi être configurés (Clerk et Stripe) pour que les données restent synchronisées — voir [DEPLOYMENT.md](DEPLOYMENT.md) pour la procédure complète.

## Rôles et comment naviguer dans l'application

L'application distingue 5 rôles, stockés dans `users.role` (Supabase) et synchronisés automatiquement depuis Clerk :

| Rôle | Portée | Où | Comment l'obtenir |
|---|---|---|---|
| `apprenant` | Un tenant | `/apprenant` | Rôle par défaut de tout compte qui rejoint une Organization Clerk sans être son créateur, ou qui accepte une invitation "membre" |
| `admin_tenant` | Un tenant | `/org` | Créateur d'une Organization Clerk (via `/create-organization`), ou invité explicitement avec le rôle `org:admin` |
| `tuteur` | Un tenant | `/org` (accès proche d'`admin_tenant`, sans la facturation) | Rôle peu utilisé actuellement, assigné manuellement en base |
| `formateur` | Un tenant | — | Rôle réservé, pas encore exploité par l'interface |
| `super_admin` | Global (Ahead) | `/admin` | **Pas de flux d'inscription dédié** — assigné manuellement en base (colonne `role` de la table `users`) sur un compte de test désigné |

**Pour tester en tant qu'entreprise cliente (`admin_tenant`)** :
1. Aller sur `/sign-up`, créer un compte.
2. Vous êtes automatiquement redirigé vers `/create-organization` — créez une Organization (= votre "entreprise").
3. Vous devenez `admin_tenant` de ce tenant, redirigé vers `/org`.
4. Depuis `/org/apprenants`, vous pouvez inviter de vrais apprenants par email (ils rejoignent la même Organization avec le rôle `apprenant`).
5. Depuis `/org/formations`, vous pouvez créer une formation par IA à partir de vos propres documents (nécessite l'offre Création ou Entreprise — voir `/org/abonnement`), ou activer des formations du catalogue Ahead depuis le même écran (filtre "Ahead").

**Pour tester en tant qu'Ahead (`super_admin`)** : il n'existe pas de flux d'auto-inscription pour ce rôle par design (il ne doit jamais être ouvert au public). Pour l'obtenir sur un compte de test, mettre à jour manuellement sa ligne dans la table `users` (Supabase → Table Editor) : `role = 'super_admin'`. Donne accès à `/admin` (catalogue global de formations et gestion des entreprises clientes).

**Pour tester en tant qu'apprenant** : accepter une invitation envoyée depuis `/org/apprenants` par un `admin_tenant`, ou s'inscrire via `/sign-up` en rejoignant une Organization existante plutôt qu'en créer une nouvelle.

## Structure du projet

```
app/
  (auth)/           → /sign-in, /sign-up, /create-organization
  (dashboard)/
    admin/          → super_admin : catalogue global, gestion des entreprises clientes
    apprenant/      → apprenant : mes formations, une formation, progression
    tuteur/         → tuteur : suivi des apprenants
  (org)/org/        → admin_tenant / tuteur : tableau de bord, formations, apprenants, abonnement
  api/              → toutes les routes API (formations, webhooks, agent RAG, admin...)
  pricing/          → page publique des offres
  proxy.ts          → middleware Clerk : protection des routes par rôle

components/         → composants partagés (éditeur de blocs, rendu de leçon, chat agent...)
lib/                → logique métier (IA, RAG, Stripe, Supabase, embeddings...)
supabase/migrations/ → schéma de base de données, dans l'ordre chronologique
```

## Scripts disponibles

```bash
npm run dev            # serveur de développement (Turbopack)
npm run build           # build de production
npm run start           # lance le build de production
npm run lint             # ESLint
npm run format           # Prettier — réécrit les fichiers
npm run format:check     # Prettier — vérifie sans modifier
```

## Vérifications avant de livrer une modification

```bash
npx tsc --noEmit    # vérification des types TypeScript
npm run lint         # ESLint
npm run build        # build complet (uniquement si le serveur dev n'est pas déjà lancé sur le même port)
```

Ce projet a été développé avec une discipline systématique de test sur de **vraies données** plutôt que par simulation (scripts temporaires créant de vrais tenants/apprenants/formations en base, vérifiés puis supprimés) — voir les scripts déjà exécutés au fil du projet pour des exemples de ce pattern si vous ajoutez une fonctionnalité touchant à l'isolation multi-tenant ou à la sécurité.

## Déploiement

Déploiement cible : Vercel. Procédure complète (variables d'environnement, migrations, webhooks, checklist de vérification post-déploiement) dans [DEPLOYMENT.md](DEPLOYMENT.md).

## Documentation complémentaire

- [ARCHITECTURE.md](ARCHITECTURE.md) — architecture générale, modèle multi-tenant, pipeline RAG complet (avec schéma), guide pour ajouter un nouveau format de document supporté.
- [DEPLOYMENT.md](DEPLOYMENT.md) — procédure de déploiement, pièges connus, checklist post-déploiement.

---

Projet réalisé par **Mehdi Safraoui** dans le cadre d'un stage chez **Ahead Digital**.
