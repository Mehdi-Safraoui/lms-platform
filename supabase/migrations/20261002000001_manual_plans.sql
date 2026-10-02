-- Offres attribuées par Ahead Digital depuis l'espace super admin, à côté des
-- abonnements payés en ligne via Stripe.
--
-- plan_source : 'stripe' (libre-service, piloté par le webhook Stripe) ou
-- 'manual' (attribuée par le super admin ; le webhook Stripe n'y touche pas).
-- plan_ends_at : fin d'une offre attribuée (pilote, essai) ; NULL = sans fin.
-- Passé cette date, l'entreprise est traitée comme sans abonnement actif
-- (lib/subscription.ts), sans tâche planifiée.
BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS plan_source text NOT NULL DEFAULT 'stripe' CHECK (plan_source IN ('stripe', 'manual')),
  ADD COLUMN IF NOT EXISTS plan_ends_at timestamptz;

COMMIT;
