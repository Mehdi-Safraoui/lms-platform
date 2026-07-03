/**
 * Route Handler — Webhook Clerk
 * Synchronise les Organizations et Organization Memberships Clerk vers Supabase
 * (tables tenants et users), qui font office de source de vérité pour la RLS.
 *
 * IMPORTANT : cette route doit être publique (non protégée par Clerk).
 * La vérification d'authenticité se fait via la signature Svix (verifyWebhook).
 */
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";
import { mapClerkOrgRoleToAppRole } from "@/lib/clerk";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch {
    return new NextResponse("Signature invalide", { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();

  switch (evt.type) {
    case "organization.created":
    case "organization.updated": {
      const org = evt.data;
      const { error } = await supabase.from("tenants").upsert(
        {
          clerk_org_id: org.id,
          name: org.name,
          slug: org.slug,
        },
        { onConflict: "clerk_org_id" }
      );
      if (error) {
        return new NextResponse(error.message, { status: 500 });
      }
      break;
    }

    case "organizationMembership.created":
    case "organizationMembership.updated": {
      const membership = evt.data;
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("id")
        .eq("clerk_org_id", membership.organization.id)
        .single();

      if (tenantError || !tenant) {
        return new NextResponse("Tenant introuvable pour cette Organization", { status: 404 });
      }

      const { error } = await supabase.from("users").upsert(
        {
          clerk_user_id: membership.public_user_data.user_id,
          tenant_id: tenant.id,
          role: mapClerkOrgRoleToAppRole(membership.role),
          email: membership.public_user_data.identifier,
          full_name:
            [membership.public_user_data.first_name, membership.public_user_data.last_name]
              .filter(Boolean)
              .join(" ") || null,
          avatar_url: membership.public_user_data.image_url,
        },
        { onConflict: "clerk_user_id" }
      );
      if (error) {
        return new NextResponse(error.message, { status: 500 });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
