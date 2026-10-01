import { auth } from "@clerk/nextjs/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { isFormationAccessibleToTenant } from "@/lib/formationTenantAccess";

type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

/**
 * Qui peut voir le suivi d'une formation, et pour quels apprenants :
 * - admin_tenant / tuteur : une formation accessible à son entreprise
 *   (catalogue activé ou formation privée), apprenants de son entreprise ;
 * - super_admin : une formation du catalogue global, apprenants de toutes
 *   les entreprises (tenantId null).
 * null = accès refusé (l'appelant répond 403/404).
 */
export async function resolveAnalyticsScope(
  supabase: Supabase,
  formationId: string
): Promise<{ tenantId: string | null; role: "super_admin" | "admin_tenant" | "tuteur" } | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const [{ data: user }, { data: formation }] = await Promise.all([
    supabase.from("users").select("role, tenant_id").eq("clerk_user_id", clerkUserId).single(),
    supabase.from("formations").select("id, tenant_id").eq("id", formationId).maybeSingle(),
  ]);
  if (!user || !formation) return null;

  if (user.role === "super_admin") {
    return formation.tenant_id === null ? { tenantId: null, role: "super_admin" } : null;
  }
  if ((user.role === "admin_tenant" || user.role === "tuteur") && user.tenant_id) {
    return (await isFormationAccessibleToTenant(supabase, user.tenant_id, formation))
      ? { tenantId: user.tenant_id, role: user.role }
      : null;
  }
  return null;
}
