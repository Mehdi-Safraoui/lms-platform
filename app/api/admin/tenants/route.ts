import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getTenantsUsageSummary } from "@/lib/tenantUsage";
import { getAiCostsOverview } from "@/lib/aiCosts";
import { manualPlanColumns, parseManualPlan } from "@/lib/manualPlans";
import { invitationRedirectUrl } from "@/lib/orgInvitations";

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const supabase = createServiceRoleSupabaseClient();
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, name, slug, subscription_status, subscription_plan, plan_source, plan_ends_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const [usage, aiCosts] = await Promise.all([
    getTenantsUsageSummary(supabase, (tenants ?? []).map((t) => t.id)),
    getAiCostsOverview(supabase),
  ]);

  const tenantsWithStats = await Promise.all(
    (tenants ?? []).map(async (tenant) => {
      const [{ data: progressRows }, { count: followedFormationCount }] = await Promise.all([
        supabase.from("progress").select("user_id").eq("tenant_id", tenant.id),
        supabase
          .from("tenant_formations")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant.id),
      ]);

      const activeApprenantCount = new Set((progressRows ?? []).map((p) => p.user_id)).size;

      return {
        ...tenant,
        activeApprenantCount,
        followedFormationCount: followedFormationCount ?? 0,
        usage: usage.get(tenant.id) ?? null,
        aiCostThisMonthUsd: aiCosts.byTenant.get(tenant.id) ?? 0,
      };
    })
  );

  return NextResponse.json({
    tenants: tenantsWithStats,
    aiCosts: {
      totalUsd: aiCosts.totalUsd,
      catalogueUsd: aiCosts.catalogueUsd,
      unattributedUsd: aiCosts.unattributedUsd,
      unpricedModels: aiCosts.unpricedModels,
    },
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const companyName: string | undefined = body?.companyName;
  const adminEmail: string | undefined = body?.adminEmail;

  if (!companyName?.trim() || !adminEmail?.trim()) {
    return NextResponse.json(
      { error: "Nom de l'entreprise et email de l'administrateur requis" },
      { status: 400 }
    );
  }
  // Offre facultative, attribuée par Ahead dès la création (sinon : libre-service via Stripe).
  const manualPlan = parseManualPlan(body);
  if ("error" in manualPlan) return NextResponse.json({ error: manualPlan.error }, { status: 400 });

  const client = await clerkClient();

  let organization;
  try {
    organization = await client.organizations.createOrganization({ name: companyName.trim() });
  } catch (err) {
    console.error("[admin/tenants] createOrganization error:", err);
    return NextResponse.json({ error: "Impossible de créer l'entreprise (nom déjà utilisé ?)" }, { status: 500 });
  }

  // La ligne tenants est créée ici, sans attendre le webhook organization.created
  // (qui fera ensuite le même upsert sur clerk_org_id sans toucher à l'offre),
  // pour pouvoir y écrire l'offre attribuée tout de suite.
  const supabase = createServiceRoleSupabaseClient();
  const { error: tenantError } = await supabase.from("tenants").upsert(
    {
      clerk_org_id: organization.id,
      name: organization.name,
      slug: organization.slug,
      ...(manualPlan.plan ? manualPlanColumns(manualPlan.plan, manualPlan.endsAt) : {}),
    },
    { onConflict: "clerk_org_id" }
  );
  if (tenantError) {
    console.error("[admin/tenants] tenant upsert error:", tenantError);
    return NextResponse.json({ error: "Entreprise créée dans Clerk mais pas dans l'app. Réessayez." }, { status: 500 });
  }

  try {
    // redirectUrl obligatoire : sans lui, l'invité atterrit sur les pages hébergées
    // par défaut de Clerk au lieu du formulaire /sign-up de l'app — même correctif
    // que app/api/org/apprenants/invite/route.ts.
    await client.organizations.createOrganizationInvitation({
      organizationId: organization.id,
      emailAddress: adminEmail.trim(),
      role: "org:admin",
      redirectUrl: invitationRedirectUrl(),
    });
  } catch (err) {
    console.error("[admin/tenants] createOrganizationInvitation error:", err);
    return NextResponse.json(
      { error: "Entreprise créée mais l'invitation n'a pas pu être envoyée. Réessayez depuis Clerk." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, organizationId: organization.id });
}
