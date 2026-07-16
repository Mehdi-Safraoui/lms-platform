import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/require-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { lecon_id } = await req.json();
  if (!lecon_id) return NextResponse.json({ error: "lecon_id requis" }, { status: 400 });

  const supabase = createServiceRoleSupabaseClient();

  // N'écrase pas le statut "completed" si la leçon est déjà terminée
  const { data: existing } = await supabase
    .from("progress")
    .select("status")
    .eq("user_id", guard.userId)
    .eq("lecon_id", lecon_id)
    .single();

  if (existing?.status === "completed") {
    return NextResponse.json({ status: "completed" });
  }

  await supabase.from("progress").upsert(
    { user_id: guard.userId, lecon_id, tenant_id: guard.tenantId, status: "in_progress" },
    { onConflict: "user_id,lecon_id" }
  );

  return NextResponse.json({ status: "in_progress" });
}
