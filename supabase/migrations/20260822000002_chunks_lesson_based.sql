-- Bascule du RAG : les chunks viennent désormais du contenu des LEÇONS
-- générées (lecons.content_blocks), pas du document brut uploadé. Deux
-- raisons : (1) knowledge_sources n'existe que pour le flux V2 admin_tenant,
-- alors que le catalogue V1 (super_admin) n'a jamais rien persisté de
-- chunkable ; (2) les chunks basés sur le document original se périment dès
-- qu'une leçon est éditée manuellement après génération — l'agent pourrait
-- alors citer une version différente de ce que l'apprenant voit réellement.
-- Table vide en production à ce jour (vérifié) — pas de backfill nécessaire.
ALTER TABLE public.chunks
  ADD COLUMN lesson_id uuid REFERENCES public.lecons(id) ON DELETE CASCADE;

CREATE INDEX chunks_lesson_id_idx ON public.chunks(lesson_id);

-- knowledge_source_id n'est plus renseigné par le nouveau pipeline (le
-- document reste seulement une trace de ce qui a été uploadé) — la colonne
-- reste pour ne pas casser processKnowledgeSource si on le réactive un jour,
-- mais ne peut plus être NOT NULL puisque les nouveaux chunks n'en ont pas.
ALTER TABLE public.chunks
  ALTER COLUMN knowledge_source_id DROP NOT NULL;

-- tenant_id doit devenir nullable : les formations du catalogue global
-- (créées par le super_admin, V1) ont elles-mêmes tenant_id = null — un
-- tenant y accède via la table tenant_formations, pas par propriété directe.
-- Sans ce changement, aucune formation du catalogue global (l'essentiel du
-- contenu réel aujourd'hui) ne pourrait jamais avoir de chunks.
ALTER TABLE public.chunks
  ALTER COLUMN tenant_id DROP NOT NULL;

-- match_chunks filtrait jusqu'ici sur tenant_id ET formation_id. Avec
-- tenant_id désormais nullable pour les formations globales, ce filtre
-- exclurait à tort leurs chunks (chunks.tenant_id IS NULL != l'UUID réel du
-- tenant appelant). formation_id seul suffit à l'isolation : un chunk
-- appartient à exactement une formation, et l'autorisation d'accéder à
-- cette formation précise (tenant propriétaire OU abonnement via
-- tenant_formations) est déjà vérifiée en amont, avant l'appel à
-- searchChunks (voir app/api/agent/[formationId]/route.ts) — match_chunks
-- n'a donc pas besoin de revérifier le tenant lui-même.
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1024),
  match_formation_id uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  lesson_id uuid,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    chunks.id,
    chunks.content,
    chunks.lesson_id,
    chunks.metadata,
    1 - (chunks.embedding <=> query_embedding) AS similarity
  FROM chunks
  WHERE chunks.formation_id = match_formation_id
  ORDER BY chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_chunks(vector, uuid, int) TO service_role;

-- L'ancienne signature (avec match_tenant_id) devient orpheline — on la
-- retire pour ne pas laisser deux fonctions match_chunks ambiguës.
DROP FUNCTION IF EXISTS match_chunks(vector(1024), uuid, uuid, int);

NOTIFY pgrst, 'reload schema';
