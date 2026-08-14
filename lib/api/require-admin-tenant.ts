import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type AdminTenantGuard = { userId: string; tenantId: string };

/**
 * Réservé aux admin_tenant (V2 : création de formation par IA — "Formateur"
 * temporairement porté par ce rôle, voir memory project_ai_formation_generation).
 */
export async function requireAdminTenant(): Promise<AdminTenantGuard | NextResponse> {
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

  if (!user || user.role !== "admin_tenant" || !user.tenant_id) {
    return NextResponse.json({ error: "Accès refusé — rôle admin_tenant requis" }, { status: 403 });
  }

  return { userId: user.id, tenantId: user.tenant_id };
}
