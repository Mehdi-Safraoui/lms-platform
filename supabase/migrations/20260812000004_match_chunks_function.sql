-- Fonction de recherche vectorielle : la query builder Supabase/PostgREST classique
-- ne permet pas d'exprimer un ORDER BY embedding <=> query_embedding. Une fonction
-- SQL appelée via .rpc() est le moyen standard de faire une vraie recherche pgvector.
--
-- Isolation stricte : tenant_id ET formation_id sont dans la clause WHERE, pas
-- optionnels — un chunk d'un autre tenant ou d'une autre formation ne peut
-- structurellement jamais remonter, peu importe sa proximité vectorielle.
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1024),
  match_tenant_id uuid,
  match_formation_id uuid,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    chunks.id,
    chunks.content,
    chunks.metadata,
    1 - (chunks.embedding <=> query_embedding) AS similarity
  FROM chunks
  WHERE chunks.tenant_id = match_tenant_id
    AND chunks.formation_id = match_formation_id
  ORDER BY chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_chunks TO service_role;

NOTIFY pgrst, 'reload schema';
