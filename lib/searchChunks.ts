import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/embeddings";

export interface ChunkSearchResult {
  id: string;
  content: string;
  lessonId: string | null;
  metadata: {
    position: number;
    char_start: number;
    char_end: number;
    token_count: number;
  };
  similarity: number;
}

/**
 * Recherche les chunks les plus pertinents pour une question, isolés par
 * formation (voir fonction SQL match_chunks — un chunk d'une autre formation
 * ne peut jamais remonter, peu importe sa proximité vectorielle). L'isolation
 * par tenant n'est pas refaite ici : elle est déjà garantie en amont par la
 * vérification d'accès à cette formation précise (tenant propriétaire OU
 * abonnement via tenant_formations pour une formation du catalogue global —
 * voir app/api/agent/[formationId]/route.ts), avant même l'appel à cette
 * fonction.
 */
export async function searchChunks(
  query: string,
  formationId: string,
  topK: number = 5
): Promise<ChunkSearchResult[]> {
  const queryEmbedding = await generateEmbedding(query, "query");

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    match_formation_id: formationId,
    match_count: topK,
  });

  if (error) {
    throw new Error(`Échec de la recherche vectorielle : ${error.message}`);
  }

  return ((data ?? []) as { id: string; content: string; lesson_id: string | null; metadata: ChunkSearchResult["metadata"]; similarity: number }[]).map(
    (row) => ({
      id: row.id,
      content: row.content,
      lessonId: row.lesson_id,
      metadata: row.metadata,
      similarity: row.similarity,
    })
  );
}
