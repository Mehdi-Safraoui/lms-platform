-- Comme les autres tables du projet, cette politique n'est aujourd'hui jamais
-- réellement sollicitée : toutes les routes de l'app passent par le client
-- service_role (qui bypass la RLS), le seul consommateur du client respectant
-- la RLS étant la route de diagnostic /api/test-rls. C'est donc un filet de
-- sécurité de plus, pas le mécanisme d'isolation principal — celui-ci reste
-- l'ensemble des vérifications explicites côté route (voir
-- app/api/agent/[formationId]/route.ts : rôle, formation, inscription).
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_messages_select_own_tenant" ON public.agent_messages
  FOR SELECT
  USING (tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')));

GRANT SELECT ON public.agent_messages TO authenticated;

NOTIFY pgrst, 'reload schema';
