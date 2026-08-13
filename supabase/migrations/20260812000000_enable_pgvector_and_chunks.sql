-- V2 : pipeline RAG — activer pgvector + table chunks (isolation tenant/formation)

CREATE EXTENSION IF NOT EXISTS vector;

-- Dimension 1024 = voyage-3 (confirmé le 2026-08-12). Si le modèle change un jour,
-- cette colonne devra être recréée (impossible de changer la dimension d'un
-- vector existant sans DROP/ADD de colonne).
--
-- Pas de FK vers knowledge_sources pour l'instant : cette table sera créée dans
-- une migration suivante ("Table knowledge_sources + upload de fichiers").
-- La contrainte FK sera ajoutée à ce moment-là.
CREATE TABLE public.chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  formation_id uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  knowledge_source_id uuid NOT NULL,
  content text NOT NULL,
  embedding vector(1024) NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chunks_tenant_id_idx ON public.chunks(tenant_id);
CREATE INDEX chunks_formation_id_idx ON public.chunks(formation_id);
CREATE INDEX chunks_knowledge_source_id_idx ON public.chunks(knowledge_source_id);

-- Index vectoriel HNSW (similarité cosinus) : contrairement à IVFFlat, pas besoin
-- de données existantes pour "entraîner" l'index — adapté à une table qui démarre vide.
CREATE INDEX chunks_embedding_hnsw_idx ON public.chunks
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;

-- Même politique que les autres tables tenant-scoped du projet (filtrage par
-- tenant_id via le JWT Clerk). Le filtrage strict par formation_id en plus se
-- fait au niveau applicatif (fonction searchChunks(query, tenant_id, formation_id, topK),
-- carte suivante) — la RLS ici est un filet de sécurité, pas le mécanisme principal
-- puisque l'app utilise le client service_role qui bypass la RLS.
CREATE POLICY "chunks_select_own_tenant" ON public.chunks
  FOR SELECT
  USING (tenant_id = (SELECT id FROM tenants WHERE clerk_org_id = (auth.jwt() ->> 'org_id')));

GRANT SELECT, INSERT ON public.chunks TO service_role;
GRANT SELECT ON public.chunks TO authenticated;

NOTIFY pgrst, 'reload schema';
