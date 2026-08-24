import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/require-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { isLeconAccessibleToTenant } from "@/lib/formationTenantAccess";

export async function POST(req: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { lecon_id, seconds } = await req.json();
  if (!lecon_id || typeof seconds !== "number" || seconds <= 0) {
    return NextResponse.json({ error: "lecon_id et seconds requis" }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();

  if (!(await isLeconAccessibleToTenant(supabase, guard.tenantId, lecon_id))) {
    return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("progress")
    .select("time_spent_seconds")
    .eq("user_id", guard.userId)
    .eq("lecon_id", lecon_id)
    .single();

  if (existing) {
    await supabase
      .from("progress")
      .update({ time_spent_seconds: (existing.time_spent_seconds ?? 0) + seconds })
      .eq("user_id", guard.userId)
      .eq("lecon_id", lecon_id);
  }

  return NextResponse.json({ ok: true });
}
