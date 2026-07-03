-- =====================================================
-- Activer RLS sur les nouvelles tables
-- =====================================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medias ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE attestations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Mettre à jour la policy formations pour gérer tenant_id
-- (remplace l'ancienne policy "formations_select_authenticated")
-- =====================================================
DROP POLICY "formations_select_authenticated" ON formations;
CREATE POLICY "formations_select_tenant_aware" ON formations
  FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id'))
  );

-- Idem pour modules et lecons (catalogue global — pas de tenant_id)
-- Pas de changement nécessaire, les policies existantes restent valides.

-- =====================================================
-- Policies : subscriptions (isolation tenant)
-- =====================================================
CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT
  USING (tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')));

-- =====================================================
-- Policies : medias (global ou propre au tenant)
-- =====================================================
CREATE POLICY "medias_select_tenant_aware" ON medias
  FOR SELECT
  USING (
    tenant_id IS NULL
    OR tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id'))
  );

-- =====================================================
-- Policies : quizzes et quiz_questions (catalogue global)
-- =====================================================
CREATE POLICY "quizzes_select_authenticated" ON quizzes
  FOR SELECT USING (auth.jwt() IS NOT NULL);

CREATE POLICY "quiz_questions_select_authenticated" ON quiz_questions
  FOR SELECT USING (auth.jwt() IS NOT NULL);

-- =====================================================
-- Policies : enrollments (isolation tenant)
-- =====================================================
CREATE POLICY "enrollments_select_own" ON enrollments
  FOR SELECT
  USING (tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')));

-- =====================================================
-- Policies : progress (isolation tenant)
-- =====================================================
CREATE POLICY "progress_select_own_tenant" ON progress
  FOR SELECT
  USING (tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')));

-- =====================================================
-- Policies : quiz_results (isolation tenant)
-- =====================================================
CREATE POLICY "quiz_results_select_own_tenant" ON quiz_results
  FOR SELECT
  USING (tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')));

-- =====================================================
-- Policies : attestations (isolation tenant)
-- =====================================================
CREATE POLICY "attestations_select_own_tenant" ON attestations
  FOR SELECT
  USING (tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')));
