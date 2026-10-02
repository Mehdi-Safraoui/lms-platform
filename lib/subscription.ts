import { getTenant } from "@/lib/currentUser";

// Ligne tenants lue via getTenant (React cache) : déjà chargée par le layout
// org dans la même requête, pas de nouvelle lecture en base.

/**
 * Abonnement actif : statut Stripe actif ou en essai, ou offre attribuée par
 * Ahead (plan_source "manual") dont la date de fin n'est pas passée.
 */
export function isTenantActive(
  tenant: { subscription_status?: string | null; plan_ends_at?: unknown } | null | undefined,
  now: Date = new Date()
): boolean {
  if (!tenant) return false;
  const activeStatus = tenant.subscription_status === "active" || tenant.subscription_status === "trialing";
  const endsAt = typeof tenant.plan_ends_at === "string" ? new Date(tenant.plan_ends_at) : null;
  return activeStatus && (!endsAt || endsAt > now);
}

export async function hasActiveSubscription(tenantId: string): Promise<boolean> {
  return isTenantActive(await getTenant(tenantId));
}

/**
 * V2 — Création : offres Création et Entreprise seulement (pas Découverte).
 * Voir memory project_ai_formation_generation pour le détail des 3 offres.
 */
export async function canCreateFormationByAi(tenantId: string): Promise<boolean> {
  const tenant = await getTenant(tenantId);

  const activeStatus = isTenantActive(tenant);
  const eligiblePlan = tenant?.subscription_plan === "creation" || tenant?.subscription_plan === "entreprise";
  return activeStatus && eligiblePlan;
}

/**
 * Éligibilité au flow de création par IA pour un FormationAuthorGuard :
 * tenantId null = super_admin sur le catalogue global Ahead, jamais soumis à
 * un abonnement.
 */
export async function canAuthorFormationByAi(tenantId: string | null): Promise<boolean> {
  if (tenantId === null) return true;
  return canCreateFormationByAi(tenantId);
}
