-- =====================================================
-- Énumérations PostgreSQL
-- =====================================================
CREATE TYPE media_type AS ENUM ('video', 'image', 'document', 'audio');
CREATE TYPE progress_status AS ENUM ('not_started', 'in_progress', 'completed');

-- =====================================================
-- formations : ajout tenant_id
-- NULL  = formation globale Ahead (visible par tous les tenants)
-- value = formation privée visible uniquement par ce tenant
-- =====================================================
ALTER TABLE formations ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- =====================================================
-- subscriptions : historique des abonnements Stripe par tenant
-- =====================================================
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_subscription_id text NOT NULL UNIQUE,
  plan text NOT NULL CHECK (plan IN ('decouverte', 'creation', 'entreprise')),
  status text NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  current_period_start timestamptz NOT NULL,
  current_period_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- medias : bibliothèque de fichiers (vidéos, images, documents)
-- tenant_id NULL = global (uploadé par Ahead)
-- tenant_id value = propre au tenant
-- =====================================================
CREATE TABLE medias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  type media_type NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  storage_path text,
  size_bytes bigint,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- quizzes : quiz attaché à une leçon (leçon de type 'quiz')
-- =====================================================
CREATE TABLE quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecon_id uuid NOT NULL UNIQUE REFERENCES lecons(id) ON DELETE CASCADE,
  title text NOT NULL,
  pass_score integer NOT NULL DEFAULT 70,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- quiz_questions : questions d'un quiz
-- options: [{"text": "...", "is_correct": true/false}, ...]
-- =====================================================
CREATE TABLE quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- enrollments : accès d'un tenant à une formation globale
-- Pour les formations tenant-spécifiques, l'accès est implicite via formations.tenant_id
-- =====================================================
CREATE TABLE enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, formation_id)
);

-- =====================================================
-- progress : avancement d'un utilisateur dans une leçon
-- =====================================================
CREATE TABLE progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lecon_id uuid NOT NULL REFERENCES lecons(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status progress_status NOT NULL DEFAULT 'not_started',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lecon_id)
);

-- =====================================================
-- quiz_results : résultat d'une tentative de quiz
-- answers: [{"question_id": "...", "selected_option_index": 0}, ...]
-- =====================================================
CREATE TABLE quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  score integer NOT NULL,
  max_score integer NOT NULL,
  passed boolean NOT NULL,
  answers jsonb,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- attestations : certificat de complétion d'une formation
-- =====================================================
CREATE TABLE attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  certificate_url text,
  UNIQUE(user_id, formation_id)
);

-- =====================================================
-- Index
-- =====================================================
CREATE INDEX formations_tenant_id_idx ON formations(tenant_id);
CREATE INDEX subscriptions_tenant_id_idx ON subscriptions(tenant_id);
CREATE INDEX medias_tenant_id_idx ON medias(tenant_id);
CREATE INDEX quiz_questions_quiz_id_idx ON quiz_questions(quiz_id);
CREATE INDEX enrollments_tenant_id_idx ON enrollments(tenant_id);
CREATE INDEX enrollments_formation_id_idx ON enrollments(formation_id);
CREATE INDEX progress_user_id_idx ON progress(user_id);
CREATE INDEX progress_tenant_id_idx ON progress(tenant_id);
CREATE INDEX quiz_results_user_id_idx ON quiz_results(user_id);
CREATE INDEX quiz_results_tenant_id_idx ON quiz_results(tenant_id);
CREATE INDEX attestations_user_id_idx ON attestations(user_id);
CREATE INDEX attestations_tenant_id_idx ON attestations(tenant_id);

-- =====================================================
-- GRANTs pour le rôle authenticated
-- =====================================================
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON medias TO authenticated;
GRANT SELECT ON quizzes TO authenticated;
GRANT SELECT ON quiz_questions TO authenticated;
GRANT SELECT ON enrollments TO authenticated;
GRANT SELECT ON progress TO authenticated;
GRANT SELECT ON quiz_results TO authenticated;
GRANT SELECT ON attestations TO authenticated;
