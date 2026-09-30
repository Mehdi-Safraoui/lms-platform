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

/** Bucket public des images de leçon (bloc "image_text"), voir .../media/route.ts. */
export const LESSON_MEDIA_BUCKET = "lesson-media";

/**
 * Supprime les images de leçon d'une formation ({formationId}/…) — même
 * raison que deleteUploadedDocuments : la cascade base ne couvre pas le
 * Storage. Une image retirée d'une leçon sans supprimer la formation reste en
 * revanche stockée (pas de suivi des références bloc par bloc).
 */
export async function deleteLessonMedia(supabase: Supabase, formationId: string): Promise<void> {
  const { data: files } = await supabase.storage.from(LESSON_MEDIA_BUCKET).list(formationId, { limit: 1000 });
  const paths = (files ?? []).map((f) => `${formationId}/${f.name}`);
  if (paths.length > 0) {
    await supabase.storage.from(LESSON_MEDIA_BUCKET).remove(paths);
  }
}
