-- =====================================================
-- Correction : enrollment au niveau utilisateur (user-level)
-- Les tables progress, quiz_results, attestations pointent
-- désormais vers enrollment_id plutôt que user_id directement.
-- =====================================================

-- Drop dans l'ordre inverse des dépendances
DROP TABLE IF EXISTS attestations;
DROP TABLE IF EXISTS quiz_results;
DROP TABLE IF EXISTS progress;
DROP TABLE IF EXISTS enrollments;

-- =====================================================
-- enrollments : un utilisateur est inscrit à une formation
-- tenant_id conservé pour la RLS (isolation multi-tenant)
-- =====================================================
CREATE TABLE enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  is_trial boolean NOT NULL DEFAULT false,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, formation_id)
);

-- =====================================================
-- progress : avancement d'un enrollment sur une leçon
-- =====================================================
CREATE TABLE progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lecon_id uuid NOT NULL REFERENCES lecons(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status progress_status NOT NULL DEFAULT 'not_started',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id, lecon_id)
);

-- =====================================================
-- quiz_results : résultat d'un quiz pour un enrollment
-- =====================================================
CREATE TABLE quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  score integer NOT NULL,
  max_score integer NOT NULL,
  passed boolean NOT NULL,
  answers jsonb,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- attestations : certificat de complétion par enrollment
-- =====================================================
CREATE TABLE attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL UNIQUE REFERENCES enrollments(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  certificate_url text
);

-- =====================================================
-- Index
-- =====================================================
CREATE INDEX enrollments_user_id_idx ON enrollments(user_id);
CREATE INDEX enrollments_formation_id_idx ON enrollments(formation_id);
CREATE INDEX enrollments_tenant_id_idx ON enrollments(tenant_id);
CREATE INDEX progress_enrollment_id_idx ON progress(enrollment_id);
CREATE INDEX progress_tenant_id_idx ON progress(tenant_id);
CREATE INDEX quiz_results_enrollment_id_idx ON quiz_results(enrollment_id);
CREATE INDEX quiz_results_tenant_id_idx ON quiz_results(tenant_id);
CREATE INDEX attestations_tenant_id_idx ON attestations(tenant_id);

-- =====================================================
-- GRANTs (réappliqués après DROP/CREATE)
-- =====================================================
GRANT SELECT ON enrollments TO authenticated;
GRANT SELECT ON progress TO authenticated;
GRANT SELECT ON quiz_results TO authenticated;
GRANT SELECT ON attestations TO authenticated;

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE attestations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "enrollments_select_own_tenant" ON enrollments
  FOR SELECT
  USING (tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')));

CREATE POLICY "progress_select_own_tenant" ON progress
  FOR SELECT
  USING (tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')));

CREATE POLICY "quiz_results_select_own_tenant" ON quiz_results
  FOR SELECT
  USING (tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')));

CREATE POLICY "attestations_select_own_tenant" ON attestations
  FOR SELECT
  USING (tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')));
