import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

// Plafond de lignes par requête PostgREST (réglage par défaut de Supabase) :
// progress / quiz_results sont lus par pages.
const PAGE_SIZE = 1000;

export type LearnerStatus = "not_started" | "in_progress" | "completed";

export interface LearnerRow {
  userId: string;
  name: string;
  email: string;
  /** Renseigné seulement dans la vue super_admin (tous les tenants). */
  tenantName: string | null;
  completedLessons: number;
  totalLessons: number;
  progressPct: number;
  timeMinutes: number;
  /** Moyenne des meilleurs scores obtenus aux quiz tentés (null = aucun quiz tenté). */
  quizAvgPct: number | null;
  quizzesPassed: number;
  lastActivity: string | null;
  status: LearnerStatus;
  /** lessonId → date de fin, pour l'export détaillé. */
  completedAt: Record<string, string>;
}

export interface LessonFunnelRow {
  lessonId: string;
  title: string;
  moduleTitle: string;
  isQuiz: boolean;
  completedCount: number;
  completedPct: number;
  avgTimeMinutes: number;
}

export interface QuestionStat {
  questionId: string;
  text: string;
  answered: number;
  correctPct: number | null;
  /** Mauvaise réponse la plus choisie (si au moins une erreur). */
  topWrongAnswer: { text: string; pct: number } | null;
}

export interface QuizStat {
  quizId: string;
  lessonTitle: string;
  moduleTitle: string;
  attempts: number;
  learnersAttempted: number;
  /** Apprenants ayant réussi au moins une fois / apprenants l'ayant tenté. */
  passRatePct: number | null;
  /** Réussite dès la première tentative. */
  firstTryPassRatePct: number | null;
  avgFirstScorePct: number | null;
  questions: QuestionStat[];
}

export interface FormationAnalytics {
  formation: { id: string; title: string };
  totalLessons: number;
  kpis: {
    learners: number;
    started: number;
    completed: number;
    completionRatePct: number | null;
    avgProgressPct: number | null;
    avgTimeMinutes: number | null;
    avgQuizPct: number | null;
  };
  funnel: LessonFunnelRow[];
  quizzes: QuizStat[];
  learners: LearnerRow[];
}

async function selectAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);
const avg = (values: number[]) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);

/**
 * Statistiques de suivi d'une formation. tenantId = entreprise dont on
 * regarde les apprenants ; null = tous les tenants (vue super_admin d'une
 * formation du catalogue). Le contrôle d'accès à la formation est fait par
 * l'appelant.
 */
export async function loadFormationAnalytics(supabase: Supabase, formationId: string, tenantId: string | null): Promise<FormationAnalytics | null> {
  const { data: formation } = await supabase
    .from("formations")
    .select("id, title, modules(id, title, order_index, lecons(id, title, content_type, order_index))")
    .eq("id", formationId)
    .single();
  if (!formation) return null;

  type RawModule = { id: string; title: string; order_index: number; lecons: { id: string; title: string; content_type: string; order_index: number }[] };
  const lessons = ((formation.modules ?? []) as RawModule[])
    .sort((a, b) => a.order_index - b.order_index)
    .flatMap((m) =>
      [...(m.lecons ?? [])]
        .sort((a, b) => a.order_index - b.order_index)
        .map((l) => ({ id: l.id, title: l.title, moduleTitle: m.title, isQuiz: l.content_type === "quiz" }))
    );
  const lessonIds = lessons.map((l) => l.id);

  const { data: quizzes } = lessonIds.length
    ? await supabase.from("quizzes").select("id, lecon_id, quiz_questions(id, question_text, options, order_index)").in("lecon_id", lessonIds)
    : { data: [] };
  const quizIds = (quizzes ?? []).map((q) => q.id);

  // Apprenants : inscrits à la formation, ou ayant déjà une progression dessus.
  const enrollments = await selectAll<{ user_id: string }>((from, to) => {
    let q = supabase.from("user_enrollments").select("user_id").eq("formation_id", formationId);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    return q.range(from, to);
  });
  const progress = lessonIds.length
    ? await selectAll<{ user_id: string; lecon_id: string; status: string; completed_at: string | null; updated_at: string; time_spent_seconds: number }>((from, to) => {
        let q = supabase.from("progress").select("user_id, lecon_id, status, completed_at, updated_at, time_spent_seconds").in("lecon_id", lessonIds);
        if (tenantId) q = q.eq("tenant_id", tenantId);
        return q.range(from, to);
      })
    : [];
  const results = quizIds.length
    ? await selectAll<{ user_id: string; quiz_id: string; score: number; max_score: number; passed: boolean; answers: { question_id: string; option_index: number; correct: boolean }[] | null; attempted_at: string }>((from, to) => {
        let q = supabase.from("quiz_results").select("user_id, quiz_id, score, max_score, passed, answers, attempted_at").in("quiz_id", quizIds).order("attempted_at");
        if (tenantId) q = q.eq("tenant_id", tenantId);
        return q.range(from, to);
      })
    : [];

  const userIds = [...new Set([...enrollments.map((e) => e.user_id), ...progress.map((p) => p.user_id).filter(Boolean)])];
  const { data: users } = userIds.length
    ? await supabase.from("users").select("id, full_name, email, tenant_id, role").in("id", userIds)
    : { data: [] };
  // Seuls les apprenants comptent (un admin qui prévisualise n'est pas un apprenant).
  const learnerUsers = (users ?? []).filter((u) => u.role === "apprenant");
  const tenantNames = new Map<string, string>();
  if (!tenantId) {
    const ids = [...new Set(learnerUsers.map((u) => u.tenant_id).filter(Boolean))] as string[];
    const { data: tenants } = ids.length ? await supabase.from("tenants").select("id, name").in("id", ids) : { data: [] };
    for (const t of tenants ?? []) tenantNames.set(t.id, t.name);
  }

  const lessonIdSet = new Set(lessonIds);
  const learners: LearnerRow[] = learnerUsers.map((u) => {
    const own = progress.filter((p) => p.user_id === u.id && lessonIdSet.has(p.lecon_id));
    const done = own.filter((p) => p.status === "completed");
    const ownResults = results.filter((r) => r.user_id === u.id);
    const bestByQuiz = new Map<string, number>();
    for (const r of ownResults) {
      const score = pct(r.score, r.max_score);
      bestByQuiz.set(r.quiz_id, Math.max(bestByQuiz.get(r.quiz_id) ?? 0, score));
    }
    const activity = [...own.map((p) => p.updated_at), ...ownResults.map((r) => r.attempted_at)].sort();
    const progressPct = pct(done.length, lessons.length);
    return {
      userId: u.id,
      name: u.full_name || u.email,
      email: u.email,
      tenantName: tenantId ? null : (tenantNames.get(u.tenant_id) ?? null),
      completedLessons: done.length,
      totalLessons: lessons.length,
      progressPct,
      timeMinutes: Math.round(own.reduce((sum, p) => sum + (p.time_spent_seconds ?? 0), 0) / 60),
      quizAvgPct: avg([...bestByQuiz.values()]),
      quizzesPassed: new Set(ownResults.filter((r) => r.passed).map((r) => r.quiz_id)).size,
      lastActivity: activity.at(-1) ?? null,
      status: progressPct === 100 ? "completed" : own.length > 0 || ownResults.length > 0 ? "in_progress" : "not_started",
      completedAt: Object.fromEntries(done.map((p) => [p.lecon_id, p.completed_at ?? p.updated_at])),
    };
  });

  const learnerIds = new Set(learners.map((l) => l.userId));
  const funnel: LessonFunnelRow[] = lessons.map((l) => {
    const rows = progress.filter((p) => p.lecon_id === l.id && learnerIds.has(p.user_id));
    const completedCount = rows.filter((p) => p.status === "completed").length;
    const times = rows.map((p) => p.time_spent_seconds ?? 0).filter((s) => s > 0);
    return {
      lessonId: l.id,
      title: l.title,
      moduleTitle: l.moduleTitle,
      isQuiz: l.isQuiz,
      completedCount,
      completedPct: pct(completedCount, learners.length),
      avgTimeMinutes: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 60) : 0,
    };
  });

  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const quizStats: QuizStat[] = (quizzes ?? [])
    .map((quiz) => {
      const lesson = lessonById.get(quiz.lecon_id);
      const attempts = results.filter((r) => r.quiz_id === quiz.id && learnerIds.has(r.user_id));
      const byLearner = new Map<string, typeof attempts>();
      for (const a of attempts) byLearner.set(a.user_id, [...(byLearner.get(a.user_id) ?? []), a]);
      const firsts = [...byLearner.values()].map((list) => list[0]);
      const questions = ((quiz.quiz_questions ?? []) as { id: string; question_text: string; options: { text: string; is_correct: boolean }[]; order_index: number }[])
        .sort((a, b) => a.order_index - b.order_index)
        .map((q): QuestionStat => {
          const answers = attempts.flatMap((a) => (a.answers ?? []).filter((x) => x.question_id === q.id));
          const correct = answers.filter((x) => x.correct).length;
          const wrong = answers.filter((x) => !x.correct && x.option_index >= 0);
          const wrongCounts = new Map<number, number>();
          for (const w of wrong) wrongCounts.set(w.option_index, (wrongCounts.get(w.option_index) ?? 0) + 1);
          const top = [...wrongCounts.entries()].sort((a, b) => b[1] - a[1])[0];
          return {
            questionId: q.id,
            text: q.question_text,
            answered: answers.length,
            correctPct: answers.length ? pct(correct, answers.length) : null,
            topWrongAnswer: top ? { text: q.options[top[0]]?.text ?? "?", pct: pct(top[1], answers.length) } : null,
          };
        });
      return {
        quizId: quiz.id,
        lessonTitle: lesson?.title ?? "Quiz",
        moduleTitle: lesson?.moduleTitle ?? "",
        order: lesson ? lessonIds.indexOf(lesson.id) : 0,
        attempts: attempts.length,
        learnersAttempted: byLearner.size,
        passRatePct: byLearner.size ? pct([...byLearner.values()].filter((list) => list.some((a) => a.passed)).length, byLearner.size) : null,
        firstTryPassRatePct: firsts.length ? pct(firsts.filter((a) => a.passed).length, firsts.length) : null,
        avgFirstScorePct: avg(firsts.map((a) => pct(a.score, a.max_score))),
        questions,
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((q) => ({
      quizId: q.quizId,
      lessonTitle: q.lessonTitle,
      moduleTitle: q.moduleTitle,
      attempts: q.attempts,
      learnersAttempted: q.learnersAttempted,
      passRatePct: q.passRatePct,
      firstTryPassRatePct: q.firstTryPassRatePct,
      avgFirstScorePct: q.avgFirstScorePct,
      questions: q.questions,
    }));

  const started = learners.filter((l) => l.status !== "not_started");
  return {
    formation: { id: formation.id, title: formation.title },
    totalLessons: lessons.length,
    kpis: {
      learners: learners.length,
      started: started.length,
      completed: learners.filter((l) => l.status === "completed").length,
      completionRatePct: learners.length ? pct(learners.filter((l) => l.status === "completed").length, learners.length) : null,
      avgProgressPct: avg(learners.map((l) => l.progressPct)),
      avgTimeMinutes: avg(started.map((l) => l.timeMinutes)),
      avgQuizPct: avg(learners.map((l) => l.quizAvgPct).filter((v): v is number => v !== null)),
    },
    funnel,
    quizzes: quizStats,
    learners: learners.sort((a, b) => b.progressPct - a.progressPct || a.name.localeCompare(b.name)),
  };
}

export interface FormationOverviewRow {
  id: string;
  title: string;
  source: "ahead" | "own";
  learners: number;
  completionRatePct: number | null;
  avgProgressPct: number | null;
}

/**
 * Vue d'ensemble des formations d'un tenant (catalogue Ahead activé +
 * formations publiées de l'entreprise), en quelques requêtes pour tout le
 * tenant plutôt qu'une analyse complète par formation.
 */
export async function loadFormationsOverview(supabase: Supabase, tenantId: string): Promise<FormationOverviewRow[]> {
  const [{ data: activated }, { data: own }] = await Promise.all([
    supabase.from("tenant_formations").select("formation_id").eq("tenant_id", tenantId),
    supabase.from("formations").select("id").eq("tenant_id", tenantId).eq("is_published", true),
  ]);
  const ids = [...new Set([...(activated ?? []).map((a) => a.formation_id), ...(own ?? []).map((f) => f.id)])];
  if (!ids.length) return [];

  const { data: formations } = await supabase
    .from("formations")
    .select("id, title, tenant_id, is_published, modules(lecons(id))")
    .in("id", ids)
    .eq("is_published", true);
  const [enrollments, progress, { data: learners }] = await Promise.all([
    selectAll<{ user_id: string; formation_id: string }>((from, to) =>
      supabase.from("user_enrollments").select("user_id, formation_id").eq("tenant_id", tenantId).in("formation_id", ids).range(from, to)
    ),
    selectAll<{ user_id: string; lecon_id: string; status: string }>((from, to) =>
      supabase.from("progress").select("user_id, lecon_id, status").eq("tenant_id", tenantId).eq("status", "completed").range(from, to)
    ),
    supabase.from("users").select("id").eq("tenant_id", tenantId).eq("role", "apprenant"),
  ]);
  const learnerIds = new Set((learners ?? []).map((u) => u.id));

  return (formations ?? [])
    .map((f) => {
      const lessonIds = new Set(((f.modules ?? []) as { lecons: { id: string }[] }[]).flatMap((m) => (m.lecons ?? []).map((l) => l.id)));
      const enrolled = [...new Set(enrollments.filter((e) => e.formation_id === f.id && learnerIds.has(e.user_id)).map((e) => e.user_id))];
      const progressByUser = enrolled.map((userId) => progress.filter((p) => p.user_id === userId && lessonIds.has(p.lecon_id)).length);
      const progressPcts = progressByUser.map((done) => pct(done, lessonIds.size));
      return {
        id: f.id,
        title: f.title,
        source: (f.tenant_id ? "own" : "ahead") as "own" | "ahead",
        learners: enrolled.length,
        completionRatePct: enrolled.length ? pct(progressPcts.filter((p) => p === 100).length, enrolled.length) : null,
        avgProgressPct: avg(progressPcts),
      };
    })
    .sort((a, b) => b.learners - a.learners || a.title.localeCompare(b.title));
}
