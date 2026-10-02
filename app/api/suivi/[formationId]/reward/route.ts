import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api/require-auth";
import { resolveAnalyticsScope } from "@/lib/api/require-analytics-viewer";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ formationId: string }> };

/**
 * Objectif au mérite d'une formation pour l'entreprise de l'appelant
 * (table formation_rewards). Réservé à l'admin entreprise : c'est lui qui
 * décide de l'attribution des licences ; le tuteur voit l'objectif.
 */
async function requireRewardEditor(formationId: string) {
  const supabase = createServiceRoleSupabaseClient();
  const [scope, guard] = await Promise.all([resolveAnalyticsScope(supabase, formationId), requireAuth()]);
  if (guard instanceof NextResponse) return guard;
  if (!scope || scope.tenantId === null || scope.role !== "admin_tenant") {
    return NextResponse.json({ error: "Seul l'administrateur de l'entreprise peut fixer l'objectif." }, { status: 403 });
  }
  return { supabase, tenantId: scope.tenantId, userId: guard.userId };
}

// PUT /api/suivi/[formationId]/reward — { minScorePct: 1-100, rewardLabel }
export async function PUT(req: NextRequest, { params }: Params) {
  const { formationId } = await params;
  const ctx = await requireRewardEditor(formationId);
  if (ctx instanceof NextResponse) return ctx;

  const body = await req.json().catch(() => null);
  const minScorePct = Number(body?.minScorePct);
  const rewardLabel = typeof body?.rewardLabel === "string" ? body.rewardLabel.trim() : "";
  if (!Number.isInteger(minScorePct) || minScorePct < 1 || minScorePct > 100) {
    return NextResponse.json({ error: "Le score minimum doit être un nombre entier entre 1 et 100." }, { status: 400 });
  }
  if (!rewardLabel || rewardLabel.length > 80) {
    return NextResponse.json({ error: "Indiquez ce que les apprenants obtiennent (80 caractères au plus)." }, { status: 400 });
  }

  const { error } = await ctx.supabase.from("formation_rewards").upsert(
    {
      tenant_id: ctx.tenantId,
      formation_id: formationId,
      min_score_pct: minScorePct,
      reward_label: rewardLabel,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,formation_id" }
  );
  if (error) {
    console.error("[suivi/reward] upsert error:", error);
    return NextResponse.json({ error: "Impossible d'enregistrer l'objectif." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/suivi/[formationId]/reward — retire l'objectif.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { formationId } = await params;
  const ctx = await requireRewardEditor(formationId);
  if (ctx instanceof NextResponse) return ctx;

  const { error } = await ctx.supabase.from("formation_rewards").delete().eq("tenant_id", ctx.tenantId).eq("formation_id", formationId);
  if (error) {
    console.error("[suivi/reward] delete error:", error);
    return NextResponse.json({ error: "Impossible de retirer l'objectif." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
