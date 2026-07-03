import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createUserSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return NextResponse.json({ error: "Non authentifié ou pas d'organisation active" }, { status: 401 });
  }

  const supabase = await createUserSupabaseClient();

  const { data: tenants, error: tenantsError } = await supabase.from("tenants").select("*");
  const { data: users, error: usersError } = await supabase.from("users").select("*");

  return NextResponse.json({
    clerk: { userId, orgId },
    tenants: tenantsError ? { error: tenantsError.message } : tenants,
    users: usersError ? { error: usersError.message } : users,
  });
}
