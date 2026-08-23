-- Le Customer Portal Stripe est configuré en mode "at_period_end" (annulation
-- programmée pour la fin de période payée, pas immédiate) — vérifié via
-- stripe.billingPortal.configurations.list(). L'abonnement reste "active"
-- jusqu'à cette échéance : subscription_status seul ne suffit donc pas à
-- distinguer "actif, renouvellement normal" de "actif, mais ne se renouvellera
-- pas". Ce champ, synchronisé par le webhook customer.subscription.updated,
-- permet d'afficher cette distinction à l'admin_tenant.
ALTER TABLE public.tenants
  ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false;

-- customer.subscription.updated peut désormais écrire subscription_status
-- directement depuis Stripe (voir app/api/webhooks/stripe/route.ts) — la
-- contrainte doit couvrir tous les statuts Stripe possibles, pas seulement
-- ceux qu'on traitait explicitement jusqu'ici (incomplete/incomplete_expired
-- surviennent avant confirmation du premier paiement, paused via "pause
-- collection").
ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_subscription_status_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_subscription_status_check CHECK (
    subscription_status IN (
      'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused'
    )
  );

NOTIFY pgrst, 'reload schema';
