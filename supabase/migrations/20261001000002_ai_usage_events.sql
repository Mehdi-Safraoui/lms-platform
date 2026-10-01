-- Suivi du coût IA réel par entreprise : une ligne par appel facturé (OpenAI
-- ou Voyage AI), avec les tokens exacts renvoyés par l'API (champ usage de la
-- réponse). Le coût n'est PAS stocké : il est calculé à la lecture à partir
-- des tarifs de lib/aiPricing.ts, ce qui permet de corriger un tarif après
-- coup sans réécrire l'historique.
--
-- tenant_id NULL = catalogue Ahead (formations créées par le super_admin).
-- Les tentatives relancées après une sortie invalide sont des appels facturés
-- à part entière : elles ont chacune leur ligne.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  formation_id uuid REFERENCES public.formations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- sources (indexation des documents), cadrage, structure, lecons (contenu
  -- et quiz), indexation_lecons (chat), chat (questions des apprenants),
  -- non_attribue (appel hors d'une route instrumentée).
  feature text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('openai', 'voyage')),
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  cached_input_tokens integer NOT NULL DEFAULT 0,
  cache_write_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  reasoning_tokens integer NOT NULL DEFAULT 0,
  -- Requête au-delà de 272 000 tokens d'entrée : tarif « long contexte » OpenAI
  -- pour toute la requête.
  long_context boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ai_usage_events_tenant_created_idx ON public.ai_usage_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS ai_usage_events_created_idx ON public.ai_usage_events(created_at);

-- Écriture et lecture uniquement côté serveur (client service_role).
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.ai_usage_events TO service_role;

-- Agrégat pour les vues super_admin : tokens cumulés par entreprise, mois
-- (heure de Paris), poste, formation et modèle. Le coût en dollars est
-- calculé ensuite côté serveur, modèle par modèle.
CREATE OR REPLACE FUNCTION public.ai_usage_summary(p_since timestamptz, p_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(
  tenant_id uuid,
  month text,
  feature text,
  formation_id uuid,
  provider text,
  model text,
  long_context boolean,
  calls bigint,
  input_tokens bigint,
  cached_input_tokens bigint,
  cache_write_tokens bigint,
  output_tokens bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.tenant_id,
    to_char(e.created_at AT TIME ZONE 'Europe/Paris', 'YYYY-MM') AS month,
    e.feature,
    e.formation_id,
    e.provider,
    e.model,
    e.long_context,
    count(*) AS calls,
    sum(e.input_tokens) AS input_tokens,
    sum(e.cached_input_tokens) AS cached_input_tokens,
    sum(e.cache_write_tokens) AS cache_write_tokens,
    sum(e.output_tokens) AS output_tokens
  FROM public.ai_usage_events e
  WHERE e.created_at >= p_since
    AND (p_tenant_id IS NULL OR e.tenant_id = p_tenant_id)
  GROUP BY 1, 2, 3, 4, 5, 6, 7;
$$;

GRANT EXECUTE ON FUNCTION public.ai_usage_summary(timestamptz, uuid) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
