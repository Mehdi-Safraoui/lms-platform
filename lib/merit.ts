import type { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

/** Objectif au mérite d'une formation pour une entreprise (table formation_rewards). */
export interface FormationReward {
  minScorePct: number;
  /** Ce qui est obtenu, tel qu'affiché à l'apprenant : « licence Copilot ». */
  rewardLabel: string;
}

export const DEFAULT_REWARD_LABEL = "licence Copilot";

/**
 * eligible : tous les quiz faits, score ≥ minimum ; below : tous faits, score
 * en dessous ; pending : une partie des quiz faits ; not_started : aucun.
 */
export type MeritStatus = "eligible" | "below" | "pending" | "not_started";

export const MERIT_LABEL: Record<MeritStatus, string> = {
  eligible: "Éligible",
  below: "Sous le seuil",
  pending: "Quiz en cours",
  not_started: "Quiz pas commencés",
};

export interface Merit {
  /** Score des premières tentatives, pondéré par les points des questions (null = aucun quiz fait). */
  scorePct: number | null;
  quizzesTaken: number;
  totalQuizzes: number;
  /** null si la formation n'a pas d'objectif ou pas de quiz. */
  status: MeritStatus | null;
}

export interface QuizAttempt {
  quiz_id: string;
  score: number;
  max_score: number;
  attempted_at: string;
}

/**
 * Score au mérite d'un apprenant : seule la première tentative de chaque quiz
 * compte, pour mesurer ce qu'il savait plutôt que sa persévérance (les quiz
 * peuvent être refaits sans limite). Les quiz pèsent selon leurs points.
 */
export function computeMerit(attempts: QuizAttempt[], quizIds: string[], minScorePct: number | null): Merit {
  const quizSet = new Set(quizIds);
  const firstByQuiz = new Map<string, QuizAttempt>();
  for (const a of attempts) {
    if (!quizSet.has(a.quiz_id)) continue;
    const prev = firstByQuiz.get(a.quiz_id);
    if (!prev || a.attempted_at < prev.attempted_at) firstByQuiz.set(a.quiz_id, a);
  }
  const firsts = [...firstByQuiz.values()];
  const score = firsts.reduce((s, a) => s + a.score, 0);
  const max = firsts.reduce((s, a) => s + a.max_score, 0);
  const scorePct = firsts.length && max > 0 ? Math.round((score / max) * 100) : firsts.length ? 0 : null;
  const totalQuizzes = quizSet.size;

  let status: MeritStatus | null = null;
  if (minScorePct !== null && totalQuizzes > 0) {
    if (firsts.length === 0) status = "not_started";
    else if (firsts.length < totalQuizzes) status = "pending";
    else status = (scorePct ?? 0) >= minScorePct ? "eligible" : "below";
  }
  return { scorePct, quizzesTaken: firsts.length, totalQuizzes, status };
}

export async function loadFormationReward(supabase: Supabase, tenantId: string, formationId: string): Promise<FormationReward | null> {
  const { data } = await supabase
    .from("formation_rewards")
    .select("min_score_pct, reward_label")
    .eq("tenant_id", tenantId)
    .eq("formation_id", formationId)
    .maybeSingle();
  return data ? { minScorePct: data.min_score_pct, rewardLabel: data.reward_label } : null;
}

/**
 * Objectif et score au mérite d'un apprenant sur une formation (pages
 * apprenant). null si son entreprise n'a pas fixé d'objectif.
 */
export async function loadLearnerMerit(
  supabase: Supabase,
  { userId, tenantId, formationId }: { userId: string; tenantId: string; formationId: string }
): Promise<{ reward: FormationReward; merit: Merit; firstScoreByQuiz: Record<string, number> } | null> {
  const reward = await loadFormationReward(supabase, tenantId, formationId);
  if (!reward) return null;

  const { data: modules } = await supabase.from("modules").select("lecons(quizzes(id))").eq("formation_id", formationId);
  type Raw = { lecons: { quizzes: { id: string } | { id: string }[] | null }[] | null };
  const quizIds = ((modules ?? []) as Raw[]).flatMap((m) =>
    (m.lecons ?? []).flatMap((l) => (Array.isArray(l.quizzes) ? l.quizzes : l.quizzes ? [l.quizzes] : []).map((q) => q.id))
  );
  const { data: attempts } = quizIds.length
    ? await supabase.from("quiz_results").select("quiz_id, score, max_score, attempted_at").eq("user_id", userId).in("quiz_id", quizIds)
    : { data: [] as QuizAttempt[] };

  const merit = computeMerit(attempts ?? [], quizIds, reward.minScorePct);
  // Score de la première tentative de chaque quiz déjà fait (affiché sur la page du quiz).
  const firstScoreByQuiz: Record<string, number> = {};
  const firsts = new Map<string, QuizAttempt>();
  for (const a of attempts ?? []) {
    const prev = firsts.get(a.quiz_id);
    if (!prev || a.attempted_at < prev.attempted_at) firsts.set(a.quiz_id, a);
  }
  for (const [id, a] of firsts) firstScoreByQuiz[id] = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0;

  return { reward, merit, firstScoreByQuiz };
}
