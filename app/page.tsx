import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import WaitForSync from "./WaitForSync";

export default async function Home() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) return redirect("/sign-in");

  const supabase = createServiceRoleSupabaseClient();
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (user?.role === "super_admin") redirect("/admin/catalog");
  if (user?.role === "admin_tenant" || user?.role === "tuteur") redirect("/org");
  if (user?.role === "apprenant") redirect("/apprenant");

  // User not in DB yet (webhook en cours) → retry automatique
  return <WaitForSync />;
}
