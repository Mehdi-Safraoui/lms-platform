import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/embeddings";

export interface ChunkSearchResult {
  id: string;
  content: string;
  metadata: {
    position: number;
    char_start: number;
    char_end: number;
    token_count: number;
  };
  similarity: number;
}

/**
 * Recherche les chunks les plus pertinents pour une question, strictement isolés
 * par tenant ET par formation (voir fonction SQL match_chunks — un chunk d'un autre
 * tenant ou d'une autre formation ne peut jamais remonter, peu importe sa proximité
 * vectorielle avec la question).
 */
export async function searchChunks(
  query: string,
  tenantId: string,
  formationId: string,
  topK: number = 5
): Promise<ChunkSearchResult[]> {
  const queryEmbedding = await generateEmbedding(query, "query");

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_tenant_id: tenantId,
    match_formation_id: formationId,
    match_count: topK,
  });

  if (error) {
    throw new Error(`Échec de la recherche vectorielle : ${error.message}`);
  }

  return (data ?? []) as ChunkSearchResult[];
}
