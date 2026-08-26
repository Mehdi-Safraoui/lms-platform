import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

/**
 * Marque une formation comme modifiée maintenant — formations.updated_at
 * n'est jamais mis à jour automatiquement (ni trigger Postgres, ni valeur par
 * défaut réévaluée), donc chaque route qui change réellement la structure ou
 * le contenu d'une formation doit l'appeler explicitement. Utilisé par
 * FormationRow.tsx pour afficher "Modifiée le" plutôt que "Créée le" dès que
 * la formation a réellement bougé depuis sa création.
 */
export async function touchFormation(supabase: Supabase, formationId: string): Promise<void> {
  await supabase.from("formations").update({ updated_at: new Date().toISOString() }).eq("id", formationId);
}
