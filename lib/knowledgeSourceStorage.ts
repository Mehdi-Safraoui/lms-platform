import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

/**
 * Supprime du bucket "knowledge-sources" les fichiers uploadés pour une
 * formation. Les lignes knowledge_sources cascadent au niveau base avec la
 * formation, mais pas les fichiers de Supabase Storage — à appeler AVANT de
 * supprimer la formation, tant que les chemins sont encore lisibles.
 */
export async function deleteUploadedDocuments(supabase: Supabase, formationId: string): Promise<void> {
  const { data: sources } = await supabase.from("knowledge_sources").select("storage_url, format").eq("formation_id", formationId);
  const paths = (sources ?? []).filter((s) => s.format !== "web" && s.storage_url).map((s) => s.storage_url as string);
  if (paths.length > 0) {
    await supabase.storage.from("knowledge-sources").remove(paths);
  }
}
