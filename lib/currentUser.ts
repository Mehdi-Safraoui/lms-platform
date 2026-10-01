import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

/**
 * Utilisateur connecté et son entreprise, lus une seule fois par rendu :
 * React cache() partage le résultat entre le layout, la page et les helpers
 * (lib/subscription.ts) d'une même requête, au lieu d'une lecture en base à
 * chaque appel. Hors d'un rendu React (routes API), chaque appel relit la base.
 */
export interface CurrentUser {
  id: string;
  role: string;
  tenant_id: string | null;
  email: string | null;
  full_name: string | null;
  total_points: number | null;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;
  const { data } = await createServiceRoleSupabaseClient()
    .from("users")
    .select("id, role, tenant_id, email, full_name, total_points")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  return (data as CurrentUser | null) ?? null;
});

export interface TenantRow {
  id: string;
  name: string;
  clerk_org_id: string | null;
  logo_url: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  ai_generation_quota: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  cancel_at_period_end: boolean | null;
  [column: string]: unknown;
}

export const getTenant = cache(async (tenantId: string): Promise<TenantRow | null> => {
  const { data } = await createServiceRoleSupabaseClient().from("tenants").select("*").eq("id", tenantId).maybeSingle();
  return (data as TenantRow | null) ?? null;
});
