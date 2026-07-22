import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/require-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const supabase = createServiceRoleSupabaseClient();

  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, message, is_read, created_at")
      .eq("recipient_user_id", guard.userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_user_id", guard.userId)
      .eq("is_read", false),
  ]);

  return NextResponse.json({
    notifications: notifications ?? [],
    unreadCount: unreadCount ?? 0,
  });
}
