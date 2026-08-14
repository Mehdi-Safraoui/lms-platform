import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function hasActiveSubscription(tenantId: string): Promise<boolean> {
  const supabase = createServiceRoleSupabaseClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("subscription_status")
    .eq("id", tenantId)
    .single();

  return tenant?.subscription_status === "active" || tenant?.subscription_status === "trialing";
}

/**
 * V2 — Création : offres Création et Entreprise seulement (pas Découverte).
 * Voir memory project_ai_formation_generation pour le détail des 3 offres.
 */
export async function canCreateFormationByAi(tenantId: string): Promise<boolean> {
  const supabase = createServiceRoleSupabaseClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("subscription_status, subscription_plan")
    .eq("id", tenantId)
    .single();

  const activeStatus = tenant?.subscription_status === "active" || tenant?.subscription_status === "trialing";
  const eligiblePlan = tenant?.subscription_plan === "creation" || tenant?.subscription_plan === "entreprise";
  return activeStatus && eligiblePlan;
}
