import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

// Plafond de lignes renvoyées par requête PostgREST (réglage par défaut de
// Supabase) — les chunks sont donc lus par pages.
const PAGE_SIZE = 1000;

interface ChunkRow {
  knowledge_source_id: string;
  content: string;
  metadata: { position?: number } | null;
}

/**
 * Retire du début de `next` le chevauchement avec la fin de `prev` : deux
 * chunks consécutifs partagent volontairement leurs dernières/premières
 * phrases (~50 tokens, voir lib/chunking.ts), utiles pour la recherche
 * vectorielle mais redondantes quand on recolle le document entier. Les
 * phrases d'un chunk sont jointes par une espace et se terminent par . ! ou ?
 * (découpage de lib/chunking.ts), donc le chevauchement est un préfixe de
 * `next` qui finit par une ponctuation de fin de phrase, juste avant une
 * espace — ce qui évite de retirer une simple coïncidence de quelques mots.
 */
function stripOverlap(prev: string, next: string): string {
  const maxLength = Math.min(prev.length, next.length - 1);
  for (let end = next.lastIndexOf(" ", maxLength); end > 0; end = next.lastIndexOf(" ", end - 1)) {
    const candidate = next.slice(0, end);
    if (/[.!?]$/.test(candidate) && prev.endsWith(candidate)) return next.slice(end + 1);
  }
  return next;
}

/**
 * Texte complet des documents source d'une formation, reconstitué à partir de
 * ses chunks-documents : documents dans leur ordre d'ajout, chunks dans leur
 * ordre d'origine (metadata.position), chevauchements retirés. Sert aux étapes
 * qui ont besoin d'une vue d'ensemble (proposition de structure, synthèse pour
 * le cadrage) — par opposition à la génération d'une leçon, qui ne lit que
 * les chunks les plus pertinents (searchChunks).
 */
export async function loadSourceDocumentsText(
  supabase: Supabase,
  formationId: string
): Promise<{ text: string; sourceIds: string[] }> {
  const { data: sources, error: sourcesError } = await supabase
    .from("knowledge_sources")
    .select("id, file_name")
    .eq("formation_id", formationId)
    .eq("ingestion_status", "terminee")
    .order("uploaded_at", { ascending: true });
  if (sourcesError) throw new Error(sourcesError.message);
  if (!sources?.length) return { text: "", sourceIds: [] };

  const sourceIds = sources.map((s) => s.id);
  const rows: ChunkRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("chunks")
      .select("knowledge_source_id, content, metadata")
      .eq("formation_id", formationId)
      .in("knowledge_source_id", sourceIds)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as ChunkRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const documents = sources
    .map((source) => {
      const chunks = rows
        .filter((r) => r.knowledge_source_id === source.id)
        .sort((a, b) => (a.metadata?.position ?? 0) - (b.metadata?.position ?? 0));
      const parts: string[] = [];
      chunks.forEach((chunk, i) => {
        parts.push(i === 0 ? chunk.content : stripOverlap(chunks[i - 1].content, chunk.content));
      });
      const body = parts.filter(Boolean).join("\n");
      return body ? `### Document : ${source.file_name}\n\n${body}` : "";
    })
    .filter(Boolean);

  return { text: documents.join("\n\n"), sourceIds };
}
