-- Migration de rattrapage : aligne le dépôt sur la base de production.
--
-- Plusieurs changements ont été faits directement dans Supabase (SQL Editor /
-- Table Editor) sans migration correspondante. Une base neuve montée depuis
-- supabase/migrations/ ne faisait donc pas tourner l'app :
--   - table tenant_formations absente (activation d'une formation du catalogue
--     Ahead par un tenant — lue par les pages apprenant, /org, l'agent RAG...)
--   - progress.user_id / quiz_results.user_id absents (les routes progress/*
--     écrivent par user_id, avec upsert onConflict "user_id,lecon_id")
--   - progress.enrollment_id / quiz_results.enrollment_id encore NOT NULL alors
--     que le code ne les renseigne plus
--   - users.tenant_id encore NOT NULL alors que le super_admin n'a pas de tenant
--
-- Écrite pour être IDEMPOTENTE : sur la production (déjà dans cet état), elle ne
-- change rien ; sur une base neuve, elle ajoute ce qui manque. Schéma relevé sur
-- la base de prod le 2026-09-30 (via l'API PostgREST, sans accès pg_dump) — les
-- comportements ON DELETE des clés étrangères ci-dessous n'ont pas pu être lus
-- et sont donc ceux du reste du schéma (CASCADE).
--
-- Non repris ici : la fonction public.rls_auto_enable() présente en prod, créée
-- par l'option Supabase "activer automatiquement la RLS", pas par l'app.

-- =====================================================
-- tenant_formations : formations du catalogue global activées par un tenant
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tenant_formations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now()
);

-- Unicité (tenant_id, formation_id) : app/api/org/catalogue/route.ts ignore
-- volontairement l'erreur 23505 d'un double clic sur "activer".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'tenant_formations'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%(tenant_id, formation_id)%'
  ) THEN
    CREATE UNIQUE INDEX tenant_formations_tenant_formation_key
      ON public.tenant_formations (tenant_id, formation_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tenant_formations_tenant_id_idx ON public.tenant_formations(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_formations_formation_id_idx ON public.tenant_formations(formation_id);

ALTER TABLE public.tenant_formations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant_formations'
      AND policyname = 'tenant_formations_select_own_tenant'
  ) THEN
    CREATE POLICY "tenant_formations_select_own_tenant" ON public.tenant_formations
      FOR SELECT
      USING (tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')));
  END IF;
END $$;

GRANT SELECT, INSERT, DELETE ON public.tenant_formations TO service_role;
GRANT SELECT ON public.tenant_formations TO authenticated;

-- =====================================================
-- progress / quiz_results : suivi par user_id (et non plus par enrollment_id)
-- =====================================================
ALTER TABLE public.progress
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.progress
  ALTER COLUMN enrollment_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS progress_user_id_idx ON public.progress(user_id);

-- Cible des upsert onConflict "user_id,lecon_id" (app/api/progress/*).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'progress'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%(user_id, lecon_id)%'
  ) THEN
    CREATE UNIQUE INDEX progress_user_id_lecon_id_key
      ON public.progress (user_id, lecon_id);
  END IF;
END $$;

ALTER TABLE public.quiz_results
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.quiz_results
  ALTER COLUMN enrollment_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS quiz_results_user_id_idx ON public.quiz_results(user_id);

-- =====================================================
-- users : le super_admin (Ahead) n'appartient à aucun tenant
-- =====================================================
ALTER TABLE public.users
  ALTER COLUMN tenant_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
