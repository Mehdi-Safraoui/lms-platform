import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/require-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { formationId } = await req.json();
  if (!formationId) return NextResponse.json({ error: "formationId requis" }, { status: 400 });

  const supabase = createServiceRoleSupabaseClient();

  const { error } = await supabase.from("user_enrollments").insert({
    user_id: guard.userId,
    formation_id: formationId,
    tenant_id: guard.tenantId,
  });

  if (error) {
    if (error.code === "23505") return NextResponse.json({ already_enrolled: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ already_enrolled: false });
}
