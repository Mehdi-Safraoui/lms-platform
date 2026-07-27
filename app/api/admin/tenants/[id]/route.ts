import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const supabase = createServiceRoleSupabaseClient();

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, name, slug, clerk_org_id, subscription_status, subscription_plan, created_at")
    .eq("id", id)
    .single();

  if (error || !tenant) {
    return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });
  }

  const { data: members } = await supabase
    .from("users")
    .select("id, email, full_name, role, created_at")
    .eq("tenant_id", id)
    .order("created_at", { ascending: true });

  const apprenantIds = (members ?? []).filter((m) => m.role === "apprenant").map((m) => m.id);

  const { data: tenantFormations } = await supabase
    .from("tenant_formations")
    .select("formation_id")
    .eq("tenant_id", id);

  const formationIds = (tenantFormations ?? []).map((tf) => tf.formation_id);

  let formationProgress: {
    formationId: string;
    title: string;
    apprenantCount: number;
    avgCompletionPct: number;
  }[] = [];

  if (formationIds.length > 0) {
    const [{ data: formations }, { data: modules }] = await Promise.all([
      supabase.from("formations").select("id, title").in("id", formationIds),
      supabase.from("modules").select("id, formation_id, lecons(id)").in("formation_id", formationIds),
    ]);

    const allLessonIds = (modules ?? []).flatMap(
      (m) => (m.lecons as { id: string }[] ?? []).map((l) => l.id)
    );

    const { data: completedProgress } = allLessonIds.length > 0 && apprenantIds.length > 0
      ? await supabase
          .from("progress")
          .select("user_id, lecon_id")
          .eq("tenant_id", id)
          .eq("status", "completed")
          .in("lecon_id", allLessonIds)
      : { data: [] as { user_id: string; lecon_id: string }[] };

    formationProgress = (formations ?? []).map((f) => {
      const lessonIds = (modules ?? [])
        .filter((m) => m.formation_id === f.id)
        .flatMap((m) => (m.lecons as { id: string }[] ?? []).map((l) => l.id));

      if (lessonIds.length === 0 || apprenantIds.length === 0) {
        return { formationId: f.id, title: f.title, apprenantCount: apprenantIds.length, avgCompletionPct: 0 };
      }

      const perApprenantPct = apprenantIds.map((userId) => {
        const completedCount = (completedProgress ?? []).filter(
          (p) => p.user_id === userId && lessonIds.includes(p.lecon_id)
        ).length;
        return (completedCount / lessonIds.length) * 100;
      });

      const avgCompletionPct = Math.round(
        perApprenantPct.reduce((sum, pct) => sum + pct, 0) / perApprenantPct.length
      );

      return { formationId: f.id, title: f.title, apprenantCount: apprenantIds.length, avgCompletionPct };
    });
  }

  let pendingInvitations: { id: string; emailAddress: string; role: string }[] = [];
  try {
    const client = await clerkClient();
    const { data: invitations } = await client.organizations.getOrganizationInvitationList({
      organizationId: tenant.clerk_org_id,
      status: ["pending"],
    });
    pendingInvitations = invitations.map((inv) => ({
      id: inv.id,
      emailAddress: inv.emailAddress,
      role: inv.role,
    }));
  } catch (err) {
    console.error("[admin/tenants/:id] getOrganizationInvitationList error:", err);
  }

  return NextResponse.json({
    tenant,
    members: members ?? [],
    pendingInvitations,
    formationProgress,
  });
}
