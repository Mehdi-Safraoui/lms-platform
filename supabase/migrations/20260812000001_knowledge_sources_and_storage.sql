-- V2 : table knowledge_sources + bucket Storage cloisonné par tenant

CREATE TABLE public.knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  format text NOT NULL CHECK (format IN ('pdf', 'word', 'ppt', 'texte', 'web')),
  storage_url text,
  ingestion_status text NOT NULL DEFAULT 'en_attente'
    CHECK (ingestion_status IN ('en_attente', 'en_cours', 'terminee', 'erreur')),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_sources_tenant_id_idx ON public.knowledge_sources(tenant_id);
CREATE INDEX knowledge_sources_formation_id_idx ON public.knowledge_sources(formation_id);

-- Boucle la FK laissée en suspens dans la migration précédente (chunks a été
-- créée avant knowledge_sources — ordre imposé par le board Trello).
ALTER TABLE public.chunks
  ADD CONSTRAINT chunks_knowledge_source_id_fkey
  FOREIGN KEY (knowledge_source_id) REFERENCES public.knowledge_sources(id) ON DELETE CASCADE;

ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_sources_select_own_tenant" ON public.knowledge_sources
  FOR SELECT
  USING (tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')));

GRANT SELECT, INSERT, UPDATE ON public.knowledge_sources TO service_role;
GRANT SELECT ON public.knowledge_sources TO authenticated;

-- =====================================================
-- Bucket Storage : fichiers sources uploadés par les Formateurs/admin_tenant
-- Convention de chemin : {tenant_id}/{knowledge_source_id}/{file_name}
-- Bucket privé (pas d'accès public direct) — accès via URL signée uniquement.
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-sources', 'knowledge-sources', false)
ON CONFLICT (id) DO NOTHING;

-- L'app utilise le client service_role pour l'upload (bypass RLS, comme le
-- reste du projet — voir ARCHITECTURE.md). Ces policies sont un filet de
-- sécurité si jamais un accès authentifié direct est utilisé plus tard :
-- le premier segment du chemin doit correspondre au tenant_id de l'utilisateur.
CREATE POLICY "knowledge_sources_storage_select_own_tenant"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'knowledge-sources'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')
    )
  );

CREATE POLICY "knowledge_sources_storage_insert_own_tenant"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'knowledge-sources'
    AND (storage.foldername(name))[1] = (
      SELECT id::text FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')
    )
  );

NOTIFY pgrst, 'reload schema';
