import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string; invitationId: string }> };

/** DELETE — annule une invitation en attente d'une entreprise (vue super admin). */
export async function DELETE(_req: Request, { params }: Props) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id, invitationId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  const { data: tenant } = await supabase.from("tenants").select("clerk_org_id").eq("id", id).single();
  if (!tenant?.clerk_org_id) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });

  try {
    const client = await clerkClient();
    await client.organizations.revokeOrganizationInvitation({ organizationId: tenant.clerk_org_id, invitationId });
  } catch (err) {
    console.error("[admin/tenants/:id/invitations/:invitationId] revoke error:", err);
    return NextResponse.json({ error: "Impossible d'annuler l'invitation." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
