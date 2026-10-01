import { clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser, getTenant } from "@/lib/currentUser";
import OrgShell from "./OrgShell";

/**
 * Filet de sécurité pour le logo tenant : on ne dépend plus uniquement du
 * webhook Clerk (organization.created/updated) pour tenir logo_url à jour —
 * si un event se perd ou arrive dans le désordre pour une raison qu'on n'a
 * pas encore identifiée, plus rien ne le rattrape jamais tout seul. Ici, si
 * logo_url est vide en base, on va vérifier une fois auprès de Clerk (source
 * de vérité) et on corrige Supabase à la volée si un logo existe réellement —
 * auto-guérison au prochain chargement du dashboard, sans intervention manuelle.
 *
 * Une entreprise sans logo n'est revérifiée qu'au plus toutes les 10 minutes
 * (par instance serveur) : sinon chaque page ajoutait un appel à l'API Clerk.
 */
const LOGO_RECHECK_MS = 10 * 60 * 1000;
const logoCheckedAt = new Map<string, number>();

async function resolveTenantLogoUrl(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  tenant: { id: string; clerk_org_id: string | null; logo_url: string | null }
): Promise<string | null> {
  if (tenant.logo_url) return tenant.logo_url;
  if (!tenant.clerk_org_id) return null;
  const lastCheck = logoCheckedAt.get(tenant.id);
  if (lastCheck && Date.now() - lastCheck < LOGO_RECHECK_MS) return null;
  logoCheckedAt.set(tenant.id, Date.now());

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
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const tenantId = user.tenant_id;
  const tenant = tenantId ? await getTenant(tenantId) : null;

  const tenantLogoUrl = tenant ? await resolveTenantLogoUrl(createServiceRoleSupabaseClient(), tenant) : null;

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
            fontFamily: "var(--font-text), sans-serif",
            fontSize: "14px",
            fontWeight: "500",
            borderRadius: "12px",
            background: "#17183b",
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
