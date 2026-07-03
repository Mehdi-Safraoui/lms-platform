-- =====================================================
-- Étape 1 : Activer RLS sur toutes les tables
-- =====================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecons ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- Étape 2 : Politiques d'isolation tenant
-- auth.jwt() ->> 'org_id' = l'org Clerk de l'utilisateur connecté
-- Ces politiques s'activent pleinement après l'intégration JWT Clerk (tâche 3)
-- =====================================================

-- tenants : chaque utilisateur ne voit que son propre tenant
CREATE POLICY "tenants_select_own" ON tenants
  FOR SELECT
  USING (clerk_org_id = (auth.jwt() ->> 'org_id'));

-- users : chaque utilisateur ne voit que les membres de son tenant
CREATE POLICY "users_select_own_tenant" ON users
  FOR SELECT
  USING (
    tenant_id = (
      SELECT id FROM tenants
      WHERE clerk_org_id = (auth.jwt() ->> 'org_id')
    )
  );

-- =====================================================
-- Catalogue global : formations, modules, lecons
-- Créés uniquement par Ahead (super_admin via service_role — bypass RLS)
-- Lecture ouverte à tout utilisateur avec un JWT valide
-- =====================================================

CREATE POLICY "formations_select_authenticated" ON formations
  FOR SELECT
  USING (auth.jwt() IS NOT NULL);

CREATE POLICY "modules_select_authenticated" ON modules
  FOR SELECT
  USING (auth.jwt() IS NOT NULL);

CREATE POLICY "lecons_select_authenticated" ON lecons
  FOR SELECT
  USING (auth.jwt() IS NOT NULL);
