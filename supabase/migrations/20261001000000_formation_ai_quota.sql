-- Quota de création par IA compté en FORMATIONS par mois, et non plus en
-- générations de leçon : une formation de 45 leçons consommait 45 unités,
-- soit plus que tout le quota de l'offre Création (30) pour une seule
-- formation. Désormais une formation est comptée une fois, à la première
-- génération de sa structure (consume_formation_ai) ; toutes ses leçons et
-- régénérations sont ensuite incluses, avec un plafond anti-abus par
-- formation (ai_generation_count).
--
-- tenants.ai_generation_quota change de sens : nombre de formations IA par
-- mois calendaire (heure de Paris), NULL = illimité. ai_generation_used et
-- consume_ai_generation_quota() ne sont plus utilisés par l'app (conservés
-- le temps que l'ancien code ne soit plus déployé nulle part).

BEGIN;

ALTER TABLE public.formations
  ADD COLUMN IF NOT EXISTS ai_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_generation_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS formations_tenant_ai_started_idx
  ON public.formations (tenant_id, ai_started_at)
  WHERE ai_started_at IS NOT NULL;

-- Formations d'entreprise déjà commencées par IA (structure générée) :
-- comptées à leur date de création, pour ne pas consommer le quota du mois
-- en cours à leur prochaine génération.
UPDATE public.formations f
SET ai_started_at = f.created_at
WHERE f.tenant_id IS NOT NULL
  AND f.ai_started_at IS NULL
  AND EXISTS (SELECT 1 FROM public.formation_structure s WHERE s.formation_id = f.id);

-- Nouvelles valeurs par offre (voir QUOTA_BY_PLAN, app/api/webhooks/stripe/route.ts).
UPDATE public.tenants SET ai_generation_quota = 0 WHERE subscription_plan = 'decouverte';
UPDATE public.tenants SET ai_generation_quota = 3 WHERE subscription_plan = 'creation';
UPDATE public.tenants SET ai_generation_quota = 10 WHERE subscription_plan = 'entreprise';

-- Vérifie ET consomme, de façon atomique (verrou sur la ligne du tenant, comme
-- consume_ai_generation_quota) :
--   - formation pas encore comptée : refus si le quota du mois est atteint,
--     sinon elle est comptée (ai_started_at = now()) ;
--   - dans tous les cas : refus au-delà de p_max_per_formation générations
--     pour cette formation, sinon le compteur est incrémenté.
-- reason : 'quota' | 'formation_cap' | NULL si autorisé.
CREATE OR REPLACE FUNCTION public.consume_formation_ai(
  p_tenant_id uuid,
  p_formation_id uuid,
  p_max_per_formation integer
)
RETURNS TABLE(allowed boolean, reason text, used integer, quota integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_quota integer;
  v_started timestamptz;
  v_count integer;
  v_used integer;
  v_month_start timestamptz := date_trunc('month', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris';
BEGIN
  SELECT t.ai_generation_quota INTO v_quota FROM public.tenants t WHERE t.id = p_tenant_id FOR UPDATE;

  SELECT f.ai_started_at, f.ai_generation_count INTO v_started, v_count
  FROM public.formations f
  WHERE f.id = p_formation_id AND f.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found'::text, 0, v_quota;
    RETURN;
  END IF;

  SELECT count(*)::integer INTO v_used
  FROM public.formations f
  WHERE f.tenant_id = p_tenant_id AND f.ai_started_at >= v_month_start;

  IF v_count >= p_max_per_formation THEN
    RETURN QUERY SELECT false, 'formation_cap'::text, v_used, v_quota;
    RETURN;
  END IF;

  IF v_started IS NULL THEN
    IF v_quota IS NOT NULL AND v_used >= v_quota THEN
      RETURN QUERY SELECT false, 'quota'::text, v_used, v_quota;
      RETURN;
    END IF;
    UPDATE public.formations SET ai_started_at = now() WHERE id = p_formation_id;
    v_used := v_used + 1;
  END IF;

  UPDATE public.formations SET ai_generation_count = ai_generation_count + 1 WHERE id = p_formation_id;
  RETURN QUERY SELECT true, NULL::text, v_used, v_quota;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_formation_ai(uuid, uuid, integer) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
