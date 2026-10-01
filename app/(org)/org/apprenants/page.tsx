import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import { learnerLimitFor } from "@/lib/planLimits";
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

  // Limite de l'offre et invitations en attente (comptées dans la limite, voir
  // app/api/org/apprenants/invite/route.ts).
  const { data: tenant } = await supabase.from("tenants").select("clerk_org_id, subscription_plan").eq("id", tenantId).single();
  const learnerLimit = learnerLimitFor(tenant?.subscription_plan);
  const pendingInvitations = tenant?.clerk_org_id
    ? await clerkClient()
        .then((client) => client.organizations.getOrganizationInvitationList({ organizationId: tenant.clerk_org_id, status: ["pending"], limit: 1 }))
        .then((res) => res.totalCount)
        .catch(() => 0)
    : 0;

  // Tous les apprenants du tenant
  const { data: apprenants } = await supabase
    .from("users")
    .select("id, email, full_name, created_at, total_points")
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
      learnerLimit={learnerLimit}
      pendingInvitations={pendingInvitations}
    />
  );
}
