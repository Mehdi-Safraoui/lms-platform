-- Vérifie ET consomme le quota de génération IA en une seule opération
-- atomique (verrou de ligne FOR UPDATE) — un simple "lire puis écrire" côté
-- application serait sujet à une condition de course si deux générations
-- démarraient en même temps pour le même tenant (deux onglets, double-clic).
-- quota NULL = illimité, jamais bloqué.
CREATE OR REPLACE FUNCTION public.consume_ai_generation_quota(p_tenant_id uuid)
RETURNS TABLE(allowed boolean, used integer, quota integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_quota integer;
  v_used integer;
BEGIN
  SELECT ai_generation_quota, ai_generation_used INTO v_quota, v_used
  FROM public.tenants WHERE id = p_tenant_id FOR UPDATE;

  IF v_quota IS NOT NULL AND v_used >= v_quota THEN
    RETURN QUERY SELECT false, v_used, v_quota;
    RETURN;
  END IF;

  UPDATE public.tenants SET ai_generation_used = ai_generation_used + 1
  WHERE id = p_tenant_id
  RETURNING ai_generation_used INTO v_used;

  RETURN QUERY SELECT true, v_used, v_quota;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_ai_generation_quota(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
