import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createServiceRoleSupabaseClient>;

/**
 * Vérifie qu'une formation existe et appartient bien au tenant de l'admin_tenant
 * courant (ou, avec tenantId null, qu'elle fait partie du catalogue global du
 * super_admin — voir requireFormationAuthor) — utilisé par toutes les routes du flow de création de formation par
 * IA (sources, cadrage, structure, génération...) qui reçoivent un formationId
 * dans l'URL sans autre garantie qu'il appartient à l'appelant.
 */
export async function assertOwnFormation(
  supabase: SupabaseClient,
  formationId: string,
  tenantId: string | null
): Promise<boolean> {
  const { data } = await supabase.from("formations").select("id, tenant_id").eq("id", formationId).single();
  return !!data && data.tenant_id === tenantId;
}
