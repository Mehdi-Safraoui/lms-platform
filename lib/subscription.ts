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
