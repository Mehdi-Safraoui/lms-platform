import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { invitationRedirectUrl } from "@/lib/orgInvitations";

type Props = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/tenants/[id]/invitations — { email, role: "admin" | "apprenant" }.
 * Le super admin invite quelqu'un dans une entreprise (le premier admin, par
 * exemple). Pas de contrôle de la limite d'apprenants de l'offre : c'est une
 * décision d'Ahead ; le plafond de membres de Clerk s'applique toujours.
 */
export async function POST(req: Request, { params }: Props) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const role = body?.role === "admin" ? "org:admin" : body?.role === "apprenant" ? "org:member" : null;
  if (!email || !role) {
    return NextResponse.json({ error: "Email et rôle requis." }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data: tenant } = await supabase.from("tenants").select("clerk_org_id").eq("id", id).single();
  if (!tenant?.clerk_org_id) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });

  try {
    const client = await clerkClient();
    await client.organizations.createOrganizationInvitation({
      organizationId: tenant.clerk_org_id,
      emailAddress: email,
      role,
      redirectUrl: invitationRedirectUrl(),
    });
  } catch (err) {
    console.error("[admin/tenants/:id/invitations] create error:", err);
    const detail = (err as { errors?: { longMessage?: string; message?: string }[] }).errors?.[0];
    return NextResponse.json(
      { error: detail?.longMessage ?? detail?.message ?? "Impossible d'envoyer l'invitation." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
