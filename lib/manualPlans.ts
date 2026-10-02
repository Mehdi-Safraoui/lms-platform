import { AI_FORMATIONS_PER_MONTH, type PlanKey } from "@/lib/planLimits";

/**
 * Offres attribuées par Ahead Digital depuis l'espace super admin
 * (plan_source "manual", voir supabase/migrations/20261002000001_manual_plans.sql).
 * Le webhook Stripe ne modifie jamais ces entreprises.
 */
export const PLAN_KEYS: PlanKey[] = ["decouverte", "creation", "entreprise"];

export const PLAN_LABEL: Record<PlanKey, string> = {
  decouverte: "Découverte",
  creation: "Création",
  entreprise: "Entreprise",
};

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && (PLAN_KEYS as string[]).includes(value);
}

/**
 * Lit { plan, endsAt } envoyés par l'interface. plan null = retirer l'offre
 * (l'entreprise repasse en libre-service). endsAt : date "AAAA-MM-JJ",
 * l'accès court jusqu'à la fin de ce jour (heure de Paris approchée à 23:59 UTC+1).
 */
export function parseManualPlan(body: unknown): { plan: PlanKey | null; endsAt: string | null } | { error: string } {
  const b = (body ?? {}) as { plan?: unknown; endsAt?: unknown };
  const plan = b.plan === null || b.plan === "" || b.plan === undefined ? null : b.plan;
  if (plan !== null && !isPlanKey(plan)) return { error: "Offre inconnue." };

  let endsAt: string | null = null;
  if (typeof b.endsAt === "string" && b.endsAt.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.endsAt)) return { error: "Date de fin invalide." };
    const end = new Date(`${b.endsAt}T23:59:59+01:00`);
    if (Number.isNaN(end.getTime())) return { error: "Date de fin invalide." };
    if (end <= new Date()) return { error: "La date de fin doit être dans le futur." };
    endsAt = end.toISOString();
  }
  return { plan, endsAt: plan ? endsAt : null };
}

/** Colonnes tenants à écrire pour attribuer (ou retirer) une offre. */
export function manualPlanColumns(plan: PlanKey | null, endsAt: string | null) {
  return plan
    ? {
        subscription_plan: plan,
        subscription_status: "active",
        plan_source: "manual" as const,
        plan_ends_at: endsAt,
        cancel_at_period_end: false,
        ai_generation_quota: AI_FORMATIONS_PER_MONTH[plan],
      }
    : {
        subscription_plan: null,
        subscription_status: null,
        plan_source: "stripe" as const,
        plan_ends_at: null,
        cancel_at_period_end: false,
        ai_generation_quota: null,
      };
}
