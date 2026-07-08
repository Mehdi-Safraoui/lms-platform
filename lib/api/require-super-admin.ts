import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type SuperAdminGuard = { userId: string };

export async function requireSuperAdmin(): Promise<SuperAdminGuard | NextResponse> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, role")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Accès refusé — rôle super_admin requis" }, { status: 403 });
  }

  return { userId: user.id };
}
