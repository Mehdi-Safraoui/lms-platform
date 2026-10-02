import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getTenantUsage } from "@/lib/tenantUsage";
import { getTenantAiCosts } from "@/lib/aiCosts";
import { manualPlanColumns, parseManualPlan } from "@/lib/manualPlans";

type Props = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Props) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const supabase = createServiceRoleSupabaseClient();

  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id, name, slug, clerk_org_id, subscription_status, subscription_plan, plan_source, plan_ends_at, stripe_subscription_id, created_at")
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

  let pendingInvitations: { id: string; emailAddress: string; role: string; createdAt: number; url: string | null }[] = [];
  try {
    const client = await clerkClient();
    const { data: invitations } = await client.organizations.getOrganizationInvitationList({
      organizationId: tenant.clerk_org_id,
      status: ["pending"],
      limit: 100,
    });
    pendingInvitations = invitations.map((inv) => ({
      id: inv.id,
      emailAddress: inv.emailAddress,
      role: inv.role,
      createdAt: inv.createdAt,
      url: inv.url,
    }));
  } catch (err) {
    console.error("[admin/tenants/:id] getOrganizationInvitationList error:", err);
  }

  const { stripe_subscription_id, ...tenantFields } = tenant;
  return NextResponse.json({
    tenant: { ...tenantFields, hasStripeSubscription: !!stripe_subscription_id },
    members: members ?? [],
    pendingInvitations,
    formationProgress,
    usage: await getTenantUsage(supabase, id),
    aiCosts: await getTenantAiCosts(supabase, id),
  });
}

/**
 * PATCH /api/admin/tenants/[id] — { plan, endsAt } : attribue, change ou
 * retire l'offre d'une entreprise (offre « attribuée par Ahead »). Refusé
 * pour une entreprise qui paie en ligne : Stripe écraserait le changement au
 * prochain renouvellement, le changement passe donc par Stripe.
 */
export async function PATCH(req: Request, { params }: Props) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const parsed = parseManualPlan(await req.json().catch(() => null));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createServiceRoleSupabaseClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, plan_source, stripe_subscription_id, subscription_status")
    .eq("id", id)
    .single();
  if (!tenant) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });

  const paysOnline =
    tenant.plan_source !== "manual" &&
    !!tenant.stripe_subscription_id &&
    ["active", "trialing", "past_due"].includes(tenant.subscription_status ?? "");
  if (paysOnline) {
    return NextResponse.json(
      { error: "Cette entreprise paie son abonnement en ligne : son offre se change depuis Stripe." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("tenants").update(manualPlanColumns(parsed.plan, parsed.endsAt)).eq("id", id);
  if (error) {
    console.error("[admin/tenants/:id] plan update error:", error);
    return NextResponse.json({ error: "Impossible de changer l'offre." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
