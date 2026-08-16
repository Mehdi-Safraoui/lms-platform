import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { buildChunkRecords } from "@/lib/chunking";
import { generateEmbeddings } from "@/lib/embeddings";

export interface IngestContext {
  tenantId: string;
  formationId: string;
  knowledgeSourceId: string;
}

/**
 * Découpe un texte en chunks, génère leurs embeddings (Voyage AI, par batchs — voir
 * lib/embeddings.ts) et les insère dans la table `chunks` en un seul insert group​é.
 *
 * Retourne le nombre de chunks insérés.
 */
export async function embedAndInsertChunks(text: string, context: IngestContext): Promise<number> {
  const records = buildChunkRecords(text, {
    tenantId: context.tenantId,
    formationId: context.formationId,
    knowledgeSourceId: context.knowledgeSourceId,
  });

  if (records.length === 0) return 0;

  const embeddings = await generateEmbeddings(
    records.map((r) => r.content),
    "document"
  );

  const rows = records.map((record, i) => ({
    tenant_id: record.tenant_id,
    formation_id: record.formation_id,
    knowledge_source_id: record.knowledge_source_id,
    content: record.content,
    embedding: embeddings[i],
    metadata: record.metadata,
  }));

  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("chunks").insert(rows);
  if (error) {
    throw new Error(`Échec insertion des chunks : ${error.message}`);
  }

  return records.length;
}
