import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { extractKnowledgeSourceText, type KnowledgeSourceFormat } from "@/lib/documentExtraction";
import { embedAndInsertChunks } from "@/lib/ingestChunks";

/**
 * Traite une knowledge_source de bout en bout : téléchargement (ou fetch pour une
 * URL web) → extraction du texte → chunking → embeddings → insertion dans `chunks`.
 * Met à jour `ingestion_status` à chaque étape : en_cours pendant le traitement,
 * terminee si des chunks ont bien été produits, erreur sinon (avec le message
 * d'erreur conservé dans metadata pour diagnostic).
 *
 * Non branché automatiquement sur l'upload pour l'instant — fonction appelable
 * indépendamment (script, route dédiée, job...), pas encore de déclenchement auto.
 */
export async function processKnowledgeSource(knowledgeSourceId: string): Promise<{ chunkCount: number }> {
  const supabase = createServiceRoleSupabaseClient();

  const { data: source, error: fetchError } = await supabase
    .from("knowledge_sources")
    .select("id, tenant_id, formation_id, file_name, format, storage_url")
    .eq("id", knowledgeSourceId)
    .single();

  if (fetchError || !source) {
    throw new Error(`knowledge_source introuvable : ${knowledgeSourceId}`);
  }

  await supabase
    .from("knowledge_sources")
    .update({ ingestion_status: "en_cours", error_message: null })
    .eq("id", knowledgeSourceId);

  try {
    const text = await extractSourceText(supabase, source);

    const chunkCount = await embedAndInsertChunks(text, {
      tenantId: source.tenant_id,
      formationId: source.formation_id,
      knowledgeSourceId: source.id,
    });

    if (chunkCount === 0) {
      throw new Error("Aucun contenu exploitable trouvé dans ce document (0 chunk produit).");
    }

    await supabase
      .from("knowledge_sources")
      .update({ ingestion_status: "terminee" })
      .eq("id", knowledgeSourceId);

    return { chunkCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue lors du traitement.";
    await supabase
      .from("knowledge_sources")
      .update({ ingestion_status: "erreur", error_message: message })
      .eq("id", knowledgeSourceId);
    throw new Error(message);
  }
}

async function extractSourceText(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  source: { format: string; storage_url: string | null; file_name: string }
): Promise<string> {
  if (source.format === "web") {
    if (!source.storage_url) throw new Error("URL manquante pour cette source web.");
    return extractKnowledgeSourceText({ format: "web", url: source.storage_url });
  }

  if (!source.storage_url) throw new Error("Chemin de stockage manquant pour ce fichier.");

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("knowledge-sources")
    .download(source.storage_url);

  if (downloadError || !fileBlob) {
    throw new Error(`Échec du téléchargement du fichier : ${downloadError?.message ?? "inconnu"}`);
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  return extractKnowledgeSourceText({
    format: source.format as Exclude<KnowledgeSourceFormat, "web">,
    buffer,
    filename: source.file_name,
  });
}
