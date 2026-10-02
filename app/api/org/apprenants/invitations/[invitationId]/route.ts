import { NextResponse } from "next/server";
import { invitationRedirectUrl, requireInviter, toPendingInvitation } from "@/lib/orgInvitations";

type Params = { params: Promise<{ invitationId: string }> };

/**
 * Renvoyer une invitation en attente. Clerk ne sait pas renvoyer l'email d'une
 * invitation existante : on la révoque puis on en recrée une pour la même
 * adresse, ce qui envoie un nouvel email avec un nouveau lien. La place
 * occupée dans la limite de l'offre ne change pas (une pour une).
 */
export async function POST(_req: Request, { params }: Params) {
  const ctx = await requireInviter();
  if (ctx instanceof NextResponse) return ctx;
  const { invitationId } = await params;
  const { client, clerkOrgId: organizationId } = ctx;

  try {
    // Lue dans l'Organization du tenant : une invitation d'une autre entreprise est introuvable ici.
    const current = await client.organizations.getOrganizationInvitation({ organizationId, invitationId });
    if (current.status !== "pending") {
      return NextResponse.json({ error: "Cette invitation n'est plus en attente." }, { status: 409 });
    }
    await client.organizations.revokeOrganizationInvitation({ organizationId, invitationId });
    const fresh = await client.organizations.createOrganizationInvitation({
      organizationId,
      emailAddress: current.emailAddress,
      role: "org:member",
      redirectUrl: invitationRedirectUrl(),
    });
    return NextResponse.json({ ok: true, invitation: toPendingInvitation(fresh) });
  } catch (err) {
    console.error("[org/apprenants/invitations] resend error:", err);
    return NextResponse.json({ error: "Impossible de renvoyer l'invitation." }, { status: 500 });
  }
}

/** Annuler une invitation en attente : le lien reçu par email ne fonctionne plus. */
export async function DELETE(_req: Request, { params }: Params) {
  const ctx = await requireInviter();
  if (ctx instanceof NextResponse) return ctx;
  const { invitationId } = await params;

  try {
    await ctx.client.organizations.revokeOrganizationInvitation({ organizationId: ctx.clerkOrgId, invitationId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[org/apprenants/invitations] revoke error:", err);
    return NextResponse.json({ error: "Impossible d'annuler l'invitation." }, { status: 500 });
  }
}
