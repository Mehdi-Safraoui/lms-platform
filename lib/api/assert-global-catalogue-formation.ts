import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createServiceRoleSupabaseClient>;

/**
 * Vérifie qu'une formation appartient au catalogue global Ahead (tenant_id
 * null) — jamais à un tenant. Toutes les routes /api/formations/[id]/... sont
 * réservées au super_admin pour gérer CE catalogue ; sans ce garde-fou, elles
 * opèrent sur n'importe quelle formation par id, y compris une formation
 * privée générée par un Formateur pour son entreprise (V2), avec lecture,
 * écriture ET suppression possibles — trouvé après qu'un vrai tenant a généré
 * sa première formation (invisible tant qu'aucune formation avec tenant_id
 * non nul n'existait).
 */
export async function assertGlobalCatalogueFormation(supabase: SupabaseClient, formationId: string): Promise<boolean> {
  const { data } = await supabase.from("formations").select("id, tenant_id").eq("id", formationId).single();
  return !!data && data.tenant_id === null;
}
