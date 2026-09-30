import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

/**
 * tenantId = tenant propriétaire des formations que cet utilisateur peut
 * construire par IA : celui de l'admin_tenant, ou null pour le super_admin
 * (catalogue global Ahead, formations.tenant_id IS NULL).
 */
export type FormationAuthorGuard = { userId: string; tenantId: string | null };

/**
 * Réservé aux deux rôles qui construisent des formations par IA (flow
 * sources → cadrage → structure → génération) : admin_tenant pour son propre
 * tenant, super_admin pour le catalogue global. À combiner avec
 * assertOwnFormation(supabase, formationId, guard.tenantId), qui compare
 * formations.tenant_id à guard.tenantId — null === null pour le super_admin,
 * donc il n'atteint jamais une formation privée d'un tenant, et un
 * admin_tenant n'atteint jamais le catalogue global.
 */
export async function requireFormationAuthor(): Promise<FormationAuthorGuard | NextResponse> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, role, tenant_id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (user?.role === "super_admin") {
    return { userId: user.id, tenantId: null };
  }
  // tenant_id obligatoire : un admin_tenant sans tenant obtiendrait sinon
  // tenantId null, c'est-à-dire l'accès au catalogue global.
  if (user?.role === "admin_tenant" && user.tenant_id) {
    return { userId: user.id, tenantId: user.tenant_id };
  }

  return NextResponse.json({ error: "Accès refusé — rôle admin_tenant ou super_admin requis" }, { status: 403 });
}
