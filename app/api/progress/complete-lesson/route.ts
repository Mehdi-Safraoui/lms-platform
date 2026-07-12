import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/require-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const POINTS_LESSON = 10;

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { lecon_id } = await req.json();
  if (!lecon_id) return NextResponse.json({ error: "lecon_id requis" }, { status: 400 });

  const supabase = createServiceRoleSupabaseClient();
  const { userId, tenantId } = guard;

  // Vérifier si déjà complétée
  const { data: existing } = await supabase
    .from("progress")
    .select("id, status")
    .eq("user_id", userId)
    .eq("lecon_id", lecon_id)
    .single();

  if (existing?.status === "completed") {
    return NextResponse.json({ already_completed: true, points_awarded: 0 });
  }

  // Marquer comme terminée
  const { error: progressError } = await supabase.from("progress").upsert(
    {
      user_id: userId,
      lecon_id,
      tenant_id: tenantId,
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lecon_id" }
  );

  if (progressError) {
    console.error("[complete-lesson] progress error:", progressError);
    return NextResponse.json({ error: progressError.message }, { status: 500 });
  }

  // Créditer les points
  const { data: userRow } = await supabase
    .from("users")
    .select("total_points")
    .eq("id", userId)
    .single();

  await supabase
    .from("users")
    .update({ total_points: (userRow?.total_points ?? 0) + POINTS_LESSON })
    .eq("id", userId);

  return NextResponse.json({ already_completed: false, points_awarded: POINTS_LESSON });
}
