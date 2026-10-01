/**
 * Limites de chaque offre — source unique, utilisée par le webhook Stripe
 * (quota écrit sur le tenant à l'activation / au changement d'offre),
 * l'invitation des apprenants et la page Tarifs (lib/stripe/index.ts).
 * null = illimité.
 */
export type PlanKey = "decouverte" | "creation" | "entreprise";

/** Formations créées par IA par mois calendaire (voir lib/aiGenerationQuota.ts). */
export const AI_FORMATIONS_PER_MONTH: Record<PlanKey, number | null> = {
  decouverte: 0,
  creation: 3,
  entreprise: 10,
};

/** Apprenants par entreprise (inscrits + invitations en attente). */
export const LEARNER_LIMIT: Record<PlanKey, number | null> = {
  decouverte: 5,
  creation: 30,
  entreprise: null,
};

export function learnerLimitFor(plan: string | null | undefined): number | null {
  return plan && plan in LEARNER_LIMIT ? LEARNER_LIMIT[plan as PlanKey] : 0;
}
