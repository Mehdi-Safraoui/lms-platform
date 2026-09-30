import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/require-auth";
import { hasActiveSubscription } from "@/lib/subscription";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  if (!guard.tenantId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (!(await hasActiveSubscription(guard.tenantId))) {
    return NextResponse.json({ error: "Abonnement requis" }, { status: 403 });
  }

  const { formationId, enabled } = await req.json();
  if (!formationId || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "formationId et enabled requis" }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();

  if (enabled) {
    // Seule une formation publiée du catalogue global peut être activée — pas
    // un brouillon en cours de création par le super_admin, ni la formation
    // privée d'un autre tenant.
    const { data: formation } = await supabase
      .from("formations")
      .select("tenant_id, is_published")
      .eq("id", formationId)
      .maybeSingle();
    if (!formation || formation.tenant_id !== null || !formation.is_published) {
      return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
    }


    const { error } = await supabase.from("tenant_formations").insert({
      tenant_id: guard.tenantId,
      formation_id: formationId,
    });
    if (error && error.code !== "23505") {
      console.error("[catalogue] INSERT error:", error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("tenant_formations")
      .delete()
      .eq("tenant_id", guard.tenantId)
      .eq("formation_id", formationId);
    if (error) {
      console.error("[catalogue] DELETE error:", error);
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
