import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import type { OrganizationInvitation } from "@clerk/backend";
import { requireAuth } from "@/lib/api/require-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";

/** Invitation en attente telle qu'affichée sur la page Apprenants. */
export interface PendingInvitation {
  id: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  /** Lien d'acceptation Clerk (ticket), à transmettre à la main si l'email n'arrive pas. */
  url: string | null;
}

export function toPendingInvitation(inv: OrganizationInvitation): PendingInvitation {
  return { id: inv.id, email: inv.emailAddress, createdAt: inv.createdAt, expiresAt: inv.expiresAt, url: inv.url };
}

/**
 * Le ticket d'invitation ramène vers /sign-up, qui redirige ensuite vers "/"
 * (voir app/(auth)/sign-up/[[...sign-up]]/page.tsx).
 */
export function invitationRedirectUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/sign-up`;
}

export interface InviterContext {
  userId: string;
  tenantId: string;
  clerkOrgId: string;
  subscriptionPlan: string | null;
  client: Awaited<ReturnType<typeof clerkClient>>;
}

/**
 * Garde commune aux routes d'invitation : admin entreprise ou tuteur, abonnement
 * actif, Organization Clerk connue. Renvoie une réponse d'erreur sinon.
 */
export async function requireInviter(): Promise<InviterContext | NextResponse> {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const supabase = createServiceRoleSupabaseClient();
  const [{ data: user }, { data: tenant }, subscribed] = await Promise.all([
    supabase.from("users").select("role").eq("id", guard.userId).single(),
    supabase.from("tenants").select("clerk_org_id, subscription_plan").eq("id", guard.tenantId).single(),
    hasActiveSubscription(guard.tenantId),
  ]);

  if (!user || !["admin_tenant", "tuteur"].includes(user.role)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }
  if (!subscribed) {
    return NextResponse.json({ error: "Un abonnement actif est requis pour inviter des apprenants." }, { status: 403 });
  }
  if (!tenant?.clerk_org_id) {
    return NextResponse.json({ error: "Organisation introuvable." }, { status: 404 });
  }

  return {
    userId: guard.userId,
    tenantId: guard.tenantId,
    clerkOrgId: tenant.clerk_org_id,
    subscriptionPlan: tenant.subscription_plan,
    client: await clerkClient(),
  };
}
