-- Objectif au mérite d'une formation, propre à chaque entreprise : les
-- apprenants qui atteignent le score minimum aux quiz obtiennent la récompense
-- (par exemple une licence Copilot). Le score retenu est celui de la première
-- tentative de chaque quiz (voir lib/merit.ts) : refaire un quiz permet de
-- s'entraîner sans changer le résultat.
--
-- Une ligne par (entreprise, formation) ; pas de ligne = pas d'objectif.
BEGIN;

CREATE TABLE IF NOT EXISTS public.formation_rewards (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  min_score_pct smallint NOT NULL CHECK (min_score_pct BETWEEN 1 AND 100),
  -- Ce qui est obtenu, tel qu'affiché à l'apprenant : « licence Copilot ».
  reward_label text NOT NULL CHECK (char_length(reward_label) BETWEEN 1 AND 80),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, formation_id)
);

-- Lecture et écriture uniquement côté serveur (client service_role).
ALTER TABLE public.formation_rewards ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formation_rewards TO service_role;

COMMIT;
