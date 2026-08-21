/**
 * Route Handler — Webhook Clerk
 * Synchronise les Organizations et Organization Memberships Clerk vers Supabase
 * (tables tenants et users), qui font office de source de vérité pour la RLS.
 *
 * IMPORTANT : cette route doit être publique (non protégée par Clerk).
 * La vérification d'authenticité se fait via la signature Svix (verifyWebhook).
 */
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { mapClerkOrgRoleToAppRole } from "@/lib/clerk";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

/**
 * Upsert le tenant à partir de l'état actuel de l'Organization chez Clerk (pas
 * du contenu figé d'un event — Svix ne garantit pas l'ordre de livraison, voir
 * plus bas) et renvoie son id interne Supabase.
 */
async function upsertTenant(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  organizationId: string
): Promise<{ id: string } | null> {
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId });

  const { data, error } = await supabase
    .from("tenants")
    .upsert(
      {
        clerk_org_id: org.id,
        name: org.name,
        slug: org.slug,
        // hasImage distingue un vrai logo uploadé de l'avatar par défaut que
        // Clerk génère (initiales) — imageUrl est toujours renseigné même sans
        // upload réel, donc on ne le garde que quand hasImage est vrai.
        logo_url: org.hasImage ? (org.imageUrl ?? null) : null,
      },
      { onConflict: "clerk_org_id" }
    )
    .select("id")
    .single();

  if (error || !data) return null;
  return data;
}

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
      const tenant = await upsertTenant(supabase, evt.data.id);
      if (!tenant) {
        return new NextResponse("Échec de synchronisation du tenant", { status: 500 });
      }
      break;
    }

    case "organizationMembership.created":
    case "organizationMembership.updated": {
      const membership = evt.data;
      let { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("clerk_org_id", membership.organization.id)
        .single();

      // organizationMembership.created arrive parfois avant que
      // organization.created n'ait fini d'être traité (Svix ne garantit pas
      // l'ordre) — plutôt que d'échouer et de dépendre du retry de Svix (délai
      // potentiellement long, > à la fenêtre d'attente client de WaitForSync),
      // on crée le tenant à la volée à partir de Clerk dans ce même appel.
      if (!tenant) {
        tenant = await upsertTenant(supabase, membership.organization.id);
      }
      if (!tenant) {
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
