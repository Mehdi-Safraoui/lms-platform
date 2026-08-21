import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import OrgShell from "./OrgShell";

/**
 * Filet de sécurité pour le logo tenant : on ne dépend plus uniquement du
 * webhook Clerk (organization.created/updated) pour tenir logo_url à jour —
 * si un event se perd ou arrive dans le désordre pour une raison qu'on n'a
 * pas encore identifiée, plus rien ne le rattrape jamais tout seul. Ici, si
 * logo_url est vide en base, on va vérifier une fois auprès de Clerk (source
 * de vérité) et on corrige Supabase à la volée si un logo existe réellement —
 * auto-guérison au prochain chargement du dashboard, sans intervention manuelle.
 */
async function resolveTenantLogoUrl(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  tenant: { id: string; clerk_org_id: string | null; logo_url: string | null }
): Promise<string | null> {
  if (tenant.logo_url) return tenant.logo_url;
  if (!tenant.clerk_org_id) return null;

  try {
    const client = await clerkClient();
    const org = await client.organizations.getOrganization({ organizationId: tenant.clerk_org_id });
    if (!org.hasImage || !org.imageUrl) return null;

    await supabase.from("tenants").update({ logo_url: org.imageUrl }).eq("id", tenant.id);
    return org.imageUrl;
  } catch {
    // Clerk indisponible ou org introuvable : on n'empêche pas le rendu du
    // dashboard pour autant, on retombe simplement sur le fallback initiales.
    return null;
  }
}

export default async function OrgLayout({ children }: { children: React.ReactNode }) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const supabase = createServiceRoleSupabaseClient();
  const { data: user } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  const tenantId = user?.tenant_id ?? null;
  const { data: tenant } = tenantId
    ? await supabase
        .from("tenants")
        .select("name, subscription_status, logo_url, clerk_org_id")
        .eq("id", tenantId)
        .single()
    : { data: null };

  const tenantLogoUrl =
    tenant && tenantId ? await resolveTenantLogoUrl(supabase, { ...tenant, id: tenantId }) : null;

  const hasSubscription = tenant?.subscription_status === "active" || tenant?.subscription_status === "trialing";

  return (
    <>
      <OrgShell
        tenantName={tenant?.name ?? "Mon espace"}
        tenantLogoUrl={tenantLogoUrl}
        userRole={user?.role ?? ""}
        hasSubscription={hasSubscription}
      >
        {children}
      </OrgShell>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            fontFamily: "var(--font-jakarta), sans-serif",
            fontSize: "14px",
            fontWeight: "500",
            borderRadius: "12px",
            background: "#191738",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(11,10,34,0.35)",
          },
          duration: 3500,
        }}
      />
    </>
  );
}
