import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAuth } from "@/lib/api/require-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";

/**
 * Invite des apprenants dans l'Organization Clerk du tenant de l'appelant.
 *
 * Remplace l'appel client `organization.inviteMembers()` (SDK frontend) : celui-ci
 * n'accepte pas de redirectUrl, donc l'apprenant invité finissait sur les pages
 * hébergées par défaut de Clerk (accounts.dev/default-redirect) au lieu de revenir
 * dans l'app après avoir accepté l'invitation. Seule l'API backend Clerk
 * (createOrganizationInvitationBulk) permet de spécifier ce redirectUrl — vérifié en
 * conditions réelles (le JWT du ticket contient bien "rurl": redirectUrl).
 *
 * Voir aussi app/(auth)/sign-up/[[...sign-up]]/page.tsx : le ticket ramène vers
 * /sign-up, qui doit alors rediriger vers "/" (et non /create-organization) puisque
 * l'apprenant rejoint une Organization existante plutôt que d'en créer une.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const supabase = createServiceRoleSupabaseClient();

  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", guard.userId)
    .single();

  if (!user || !["admin_tenant", "tuteur"].includes(user.role)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  if (!(await hasActiveSubscription(guard.tenantId))) {
    return NextResponse.json({ error: "Un abonnement actif est requis pour inviter des apprenants." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const emailAddresses: string[] = Array.isArray(body?.emails)
    ? body.emails.map((e: unknown) => String(e).trim()).filter(Boolean)
    : [];

  if (emailAddresses.length === 0) {
    return NextResponse.json({ error: "Au moins une adresse email est requise." }, { status: 400 });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("clerk_org_id")
    .eq("id", guard.tenantId)
    .single();

  if (!tenant?.clerk_org_id) {
    return NextResponse.json({ error: "Organisation introuvable." }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const client = await clerkClient();

  try {
    await client.organizations.createOrganizationInvitationBulk(
      tenant.clerk_org_id,
      emailAddresses.map((emailAddress) => ({
        emailAddress,
        role: "org:member" as const,
        redirectUrl: `${appUrl}/sign-up`,
      }))
    );
  } catch (err) {
    console.error("[org/apprenants/invite] createOrganizationInvitationBulk error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Impossible d'envoyer les invitations." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, count: emailAddresses.length });
}
