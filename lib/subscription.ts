import { getTenant } from "@/lib/currentUser";

// Ligne tenants lue via getTenant (React cache) : déjà chargée par le layout
// org dans la même requête, pas de nouvelle lecture en base.

export async function hasActiveSubscription(tenantId: string): Promise<boolean> {
  const tenant = await getTenant(tenantId);

  return tenant?.subscription_status === "active" || tenant?.subscription_status === "trialing";
}

/**
 * V2 — Création : offres Création et Entreprise seulement (pas Découverte).
 * Voir memory project_ai_formation_generation pour le détail des 3 offres.
 */
export async function canCreateFormationByAi(tenantId: string): Promise<boolean> {
  const tenant = await getTenant(tenantId);

  const activeStatus = tenant?.subscription_status === "active" || tenant?.subscription_status === "trialing";
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
