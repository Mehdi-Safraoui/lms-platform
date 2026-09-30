-- Création de formation par IA côté super_admin (catalogue global Ahead) +
-- séparation des deux populations de chunks dans la recherche vectorielle.
--
-- Rétrocompatible avec le code déjà déployé : la colonne rendue nullable et le
-- nouveau paramètre optionnel de match_chunks ne changent rien pour les appels
-- existants. À appliquer AVANT de déployer le code qui s'en sert.

BEGIN;

-- =====================================================
-- knowledge_sources : une formation du catalogue global (tenant_id NULL) a
-- désormais ses propres documents source, uploadés par le super_admin.
-- Chemin de stockage correspondant : catalogue/{knowledge_source_id}/{file_name}
-- (voir app/api/org/formations/[id]/knowledge-sources/route.ts).
-- =====================================================
ALTER TABLE public.knowledge_sources
  ALTER COLUMN tenant_id DROP NOT NULL;

-- =====================================================
-- match_chunks : filtre optionnel sur l'origine des chunks.
--   'document' → chunks issus des documents source (knowledge_source_id) :
--                utilisé par la génération des leçons/quiz, qui doit s'appuyer
--                sur les sources et non sur des leçons déjà générées.
--   'lesson'   → chunks issus du contenu validé des leçons (lesson_id) :
--                utilisé par le chat apprenant, qui doit répondre à partir de
--                ce que l'apprenant voit réellement.
--   NULL       → les deux (comportement historique, conservé par défaut).
--
-- L'ancienne signature à 3 arguments est retirée : garder les deux rendrait
-- l'appel RPC ambigu pour PostgREST. Les appels existants à 3 arguments
-- nommés continuent de fonctionner grâce au DEFAULT NULL.
-- =====================================================
DROP FUNCTION IF EXISTS match_chunks(vector, uuid, int);

CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1024),
  match_formation_id uuid,
  match_count int DEFAULT 5,
  match_source text DEFAULT NULL
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
    AND (
      match_source IS NULL
      OR (match_source = 'document' AND chunks.knowledge_source_id IS NOT NULL)
      OR (match_source = 'lesson' AND chunks.lesson_id IS NOT NULL)
    )
  ORDER BY chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_chunks(vector, uuid, int, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
