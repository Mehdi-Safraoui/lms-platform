import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const supabase = createServiceRoleSupabaseClient();
  const { data: tenants, error } = await supabase
    .from("tenants")
    .select("id, name, slug, subscription_status, subscription_plan, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
      };
    })
  );

  return NextResponse.json({ tenants: tenantsWithStats });
}

export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { companyName, adminEmail } = await req.json();

  if (!companyName?.trim() || !adminEmail?.trim()) {
    return NextResponse.json(
      { error: "Nom de l'entreprise et email de l'administrateur requis" },
      { status: 400 }
    );
  }

  const client = await clerkClient();

  let organization;
  try {
    organization = await client.organizations.createOrganization({ name: companyName.trim() });
  } catch (err) {
    console.error("[admin/tenants] createOrganization error:", err);
    return NextResponse.json({ error: "Impossible de créer l'entreprise (nom déjà utilisé ?)" }, { status: 500 });
  }

  try {
    await client.organizations.createOrganizationInvitation({
      organizationId: organization.id,
      emailAddress: adminEmail.trim(),
      role: "org:admin",
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
