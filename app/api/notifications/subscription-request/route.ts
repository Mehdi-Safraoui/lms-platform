import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/require-auth";
import { notifyAdminsOfSubscriptionRequest } from "@/lib/notifications";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  if (!guard.tenantId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data: sender } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", guard.userId)
    .single();

  const senderName = sender?.full_name || sender?.email || "Un apprenant";

  const result = await notifyAdminsOfSubscriptionRequest(guard.tenantId, guard.userId, senderName);

  return NextResponse.json(result);
}
