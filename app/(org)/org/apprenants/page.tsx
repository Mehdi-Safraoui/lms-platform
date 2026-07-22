import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import ApprenantTable from "./ApprenantTable";

export default async function ApprenantPage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const supabase = createServiceRoleSupabaseClient();
  const { data: currentUser } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (!currentUser?.tenant_id || !["admin_tenant", "tuteur"].includes(currentUser.role)) {
    redirect("/org");
  }

  const tenantId = currentUser.tenant_id;

  if (!(await hasActiveSubscription(tenantId))) redirect("/pricing");

  // Tous les apprenants du tenant
  const { data: apprenants } = await supabase
    .from("users")
    .select("id, email, full_name, created_at")
    .eq("tenant_id", tenantId)
    .eq("role", "apprenant")
    .order("created_at");

  // Toutes les formations publiées avec leurs leçons
  const { data: formations } = await supabase
    .from("formations")
    .select("id, title, modules(lecons(id))")
    .eq("is_published", true)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);

  // Tous les records de progression pour ce tenant
  const { data: progressRecords } = await supabase
    .from("progress")
    .select("user_id, lecon_id, status, updated_at")
    .eq("tenant_id", tenantId);

  // Formatage des données formations pour le client
  const formationsWithLessons = (formations ?? []).map((f) => ({
    id: f.id,
    title: f.title,
    lessonIds: (f.modules ?? []).flatMap((m: { lecons: { id: string }[] }) => (m.lecons ?? []).map((l) => l.id)),
  }));

  return (
    <ApprenantTable
      apprenants={apprenants ?? []}
      formations={formationsWithLessons}
      progressRecords={progressRecords ?? []}
    />
  );
}
