import { NextRequest, NextResponse } from "next/server";
import { requireAdminTenant } from "@/lib/api/require-admin-tenant";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/org/formations/[id] — formation du tenant (créée par l'admin_tenant lui-même)
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("formations")
    .select("id, title, tenant_id, is_published")
    .eq("id", id)
    .single();

  if (error || !data || data.tenant_id !== guard.tenantId) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data });
}
