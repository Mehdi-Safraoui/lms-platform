import { clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser, getTenant } from "@/lib/currentUser";
import { hasActiveSubscription } from "@/lib/subscription";
import { learnerLimitFor } from "@/lib/planLimits";
import { toPendingInvitation } from "@/lib/orgInvitations";
import ApprenantTable from "./ApprenantTable";

export default async function ApprenantPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/sign-in");

  const supabase = createServiceRoleSupabaseClient();

  if (!currentUser?.tenant_id || !["admin_tenant", "tuteur"].includes(currentUser.role)) {
    redirect("/org");
  }

  const tenantId = currentUser.tenant_id;

  const [subscribed, tenant] = await Promise.all([hasActiveSubscription(tenantId), getTenant(tenantId)]);
  if (!subscribed) redirect("/pricing");

  // Lectures indépendantes, lancées en parallèle : invitations en attente
  // (comptées dans la limite de l'offre, voir app/api/org/apprenants/invite/route.ts),
  // apprenants du tenant, formations publiées avec leurs leçons, progression.
  const learnerLimit = learnerLimitFor(tenant?.subscription_plan);
  const clerkOrgId = tenant?.clerk_org_id;
  const [pending, { data: apprenants }, { data: formations }, { data: progressRecords }] = await Promise.all([
    clerkOrgId
      ? clerkClient()
          .then((client) =>
            client.organizations.getOrganizationInvitationList({ organizationId: clerkOrgId, status: ["pending"], limit: 100 })
          )
          .then((res) => ({ count: res.totalCount, invitations: res.data.map(toPendingInvitation).sort((a, b) => b.createdAt - a.createdAt) }))
          .catch(() => ({ count: 0, invitations: [] }))
      : { count: 0, invitations: [] },
    supabase
      .from("users")
      .select("id, email, full_name, created_at, total_points")
      .eq("tenant_id", tenantId)
      .eq("role", "apprenant")
      .order("created_at"),
    supabase
      .from("formations")
      .select("id, title, modules(lecons(id))")
      .eq("is_published", true)
      .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`),
    supabase.from("progress").select("user_id, lecon_id, status, updated_at").eq("tenant_id", tenantId),
  ]);

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
      pendingCount={pending.count}
      pendingInvitations={pending.invitations}
    />
  );
}
