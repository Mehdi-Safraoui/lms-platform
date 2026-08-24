-- Carte Trello "Ajouter les champs ai_generation_quota et ai_generation_used
-- sur la table subscriptions" — adapté à la table réelle : ce projet n'a
-- jamais eu de table `subscriptions` séparée, l'état d'abonnement (plan,
-- statut) vit directement sur `tenants` (voir subscription_plan/status,
-- migration initiale) ; ces deux champs suivent donc la même convention.
--
-- ai_generation_quota nullable = illimité (pas utilisé aujourd'hui, mais
-- évite d'avoir à choisir une valeur arbitraire "infinie"). Pas de mécanisme
-- de remise à zéro périodique : ai_generation_used s'accumule tant qu'aucun
-- job de reset mensuel n'existe (aucun équivalent ailleurs dans ce projet à
-- ce jour) — à ajouter séparément si le besoin métier se confirme.
ALTER TABLE public.tenants
  ADD COLUMN ai_generation_quota integer,
  ADD COLUMN ai_generation_used integer NOT NULL DEFAULT 0;

-- Quotas de départ par offre — valeurs raisonnables pour le stage, à ajuster
-- avec l'encadrant si des chiffres précis sont donnés par le cahier des charges.
UPDATE public.tenants SET ai_generation_quota = 0 WHERE subscription_plan = 'decouverte';
UPDATE public.tenants SET ai_generation_quota = 30 WHERE subscription_plan = 'creation';
UPDATE public.tenants SET ai_generation_quota = 100 WHERE subscription_plan = 'entreprise';

NOTIFY pgrst, 'reload schema';
