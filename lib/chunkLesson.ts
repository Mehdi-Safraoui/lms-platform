import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { chunkText } from "@/lib/chunking";
import { generateEmbeddings } from "@/lib/embeddings";

/**
 * Aplatit les blocs structurés d'une leçon (voir lib/ai/contentBlocks.ts) en texte
 * brut, pour le chunking/embedding. Volontairement en duck-typing (pas le type
 * ContentBlock strict) : un bloc au format inattendu (contenu legacy, futur type
 * de bloc pas encore géré ici) est simplement ignoré plutôt que de faire échouer
 * tout le traitement — mieux vaut indexer partiellement une leçon que perdre tout
 * son contenu à cause d'un seul bloc mal formé.
 */
export function extractLessonText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";

  return blocks
    .map((block) => blockToText(block as Record<string, unknown>))
    .filter(Boolean)
    .join("\n\n");
}

function strings(...values: unknown[]): string {
  return values.filter((v): v is string => typeof v === "string").join("\n");
}

function blockToText(block: Record<string, unknown>): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
      return typeof block.text === "string" ? block.text : "";

    case "list":
      return Array.isArray(block.items) ? block.items.filter((i): i is string => typeof i === "string").join("\n") : "";

    case "callout":
    case "highlight":
      return strings(block.title, block.text);

    case "comparison": {
      const columns = Array.isArray(block.columns) ? block.columns : [];
      const columnLines = columns.map((c: Record<string, unknown>) => {
        const items = Array.isArray(c.items) ? c.items.join(", ") : "";
        return typeof c.label === "string" ? `${c.label} : ${items}` : items;
      });
      return [typeof block.title === "string" ? block.title : null, ...columnLines].filter(Boolean).join("\n");
    }

    case "feature_grid": {
      const items = Array.isArray(block.items) ? block.items : [];
      return items
        .map((i: Record<string, unknown>) => {
          const title = typeof i.title === "string" ? i.title : "";
          const description = typeof i.description === "string" ? i.description : "";
          return [title, description].filter(Boolean).join(" : ");
        })
        .join("\n");
    }

    case "exercise":
      return strings(block.prompt, block.answer);

    default:
      return "";
  }
}

/**
 * (Re)chunke et (ré)embedde une leçon dans la table `chunks`, sous `lesson_id`.
 * Remplace systématiquement les chunks existants de cette leçon (delete puis
 * insert) plutôt que d'accumuler — nécessaire pour rester synchronisé quand une
 * leçon est éditée après sa génération initiale (voir la route PUT d'édition de
 * leçon, qui appelle cette même fonction).
 *
 * `tenantId` est nullable : les formations du catalogue global (super_admin, V1)
 * n'ont pas de tenant propriétaire direct — voir migration
 * 20260822000002_chunks_lesson_based.sql.
 *
 * N'appelle jamais l'IA/l'embedding en vain : si la leçon n'a aucun texte
 * exploitable (ex. leçon quiz, ou blocs vides), retourne 0 sans rien insérer.
 */
export async function embedAndInsertLessonChunks(
  lessonId: string,
  formationId: string,
  tenantId: string | null,
  blocks: unknown
): Promise<number> {
  const supabase = createServiceRoleSupabaseClient();

  // Toujours nettoyer d'abord, même si la nouvelle indexation échoue ensuite —
  // mieux vaut ne rien retrouver qu'un contenu périmé remonté par erreur.
  await supabase.from("chunks").delete().eq("lesson_id", lessonId);

  const text = extractLessonText(blocks);
  if (!text.trim()) return 0;

  const textChunks = chunkText(text);
  if (textChunks.length === 0) return 0;

  const embeddings = await generateEmbeddings(
    textChunks.map((c) => c.content),
    "document"
  );

  const rows = textChunks.map((chunk, i) => ({
    tenant_id: tenantId,
    formation_id: formationId,
    lesson_id: lessonId,
    content: chunk.content,
    embedding: embeddings[i],
    metadata: {
      position: chunk.position,
      char_start: chunk.charStart,
      char_end: chunk.charEnd,
      token_count: chunk.tokenCount,
    },
  }));

  const { error } = await supabase.from("chunks").insert(rows);
  if (error) {
    throw new Error(`Échec insertion des chunks (leçon ${lessonId}) : ${error.message}`);
  }

  return rows.length;
}
