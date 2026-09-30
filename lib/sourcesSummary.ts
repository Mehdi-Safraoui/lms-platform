import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { loadSourceDocumentsText } from "@/lib/sourceDocumentsText";
import { summarizeSources } from "@/lib/ai/summarizeSources";

type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Fiche de synthèse des documents source d'une formation (table
 * formation_sources_summary) : relue si elle a été produite à partir des mêmes
 * documents, sinon (re)générée à partir de leur texte complet puis
 * enregistrée. Renvoie null si aucun document n'est encore indexé.
 */
export async function getOrCreateSourcesSummary(supabase: Supabase, formationId: string): Promise<string | null> {
  const { data: readySources, error: sourcesError } = await supabase
    .from("knowledge_sources")
    .select("id")
    .eq("formation_id", formationId)
    .eq("ingestion_status", "terminee")
    .order("uploaded_at", { ascending: true });
  if (sourcesError) throw new Error(sourcesError.message);
  const readyIds = (readySources ?? []).map((s) => s.id);
  if (readyIds.length === 0) return null;

  const { data: cached } = await supabase
    .from("formation_sources_summary")
    .select("summary, source_ids")
    .eq("formation_id", formationId)
    .maybeSingle();
  if (cached && sameIds(cached.source_ids ?? [], readyIds)) return cached.summary;

  const { text, sourceIds } = await loadSourceDocumentsText(supabase, formationId);
  if (!text) return null;

  const summary = await summarizeSources(text);
  const { error } = await supabase.from("formation_sources_summary").upsert(
    { formation_id: formationId, summary, source_ids: sourceIds, updated_at: new Date().toISOString() },
    { onConflict: "formation_id" }
  );
  // La synthèse reste utilisable même si l'enregistrement échoue : elle sera
  // simplement régénérée au prochain appel.
  if (error) console.error(`[sourcesSummary] Enregistrement impossible pour ${formationId}:`, error.message);

  return summary;
}
