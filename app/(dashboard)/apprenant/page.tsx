import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";
import { computeGamification, detectAndPersistNewBadges } from "@/lib/badges";
import { buildLessonLine, type LineSourceModule } from "@/lib/lessonLine";
import type { ContentBlock } from "@/lib/ai/contentBlocks";
import LearnerDashboard, { type DashboardLine, type NewLine } from "./LearnerDashboard";
import BadgeUnlockToasts from "./BadgeUnlockToasts";

const POINTS_PER_LEVEL = 500;

interface SourceLesson {
  id: string;
  title: string;
  order_index: number;
  content_type: string;
  content_blocks: ContentBlock[] | null;
  content_markdown: string | null;
  quizzes: { quiz_questions: { id: string }[] } | { quiz_questions: { id: string }[] }[] | null;
}

export default async function ApprenantPage() {
  const dbUser = await getCurrentUser();
  const supabase = createServiceRoleSupabaseClient();

  // Formations activées par le tenant de l'apprenant, ses inscriptions et sa progression.
  const [{ data: tenantEnrollments }, { data: userEnrollments }, { data: progressRows }] = await Promise.all([
    dbUser?.tenant_id
      ? supabase.from("tenant_formations").select("formation_id").eq("tenant_id", dbUser.tenant_id)
      : { data: [] as { formation_id: string }[] },
    dbUser ? supabase.from("user_enrollments").select("formation_id").eq("user_id", dbUser.id) : { data: null },
    dbUser ? supabase.from("progress").select("lecon_id, status").eq("user_id", dbUser.id) : { data: [] as { lecon_id: string; status: string }[] },
  ]);
  const tenantFormationIds = (tenantEnrollments ?? []).map((e) => e.formation_id);

  // Formations publiées avec leur ligne complète, et badges (calculés en direct).
  const [{ data: formations }, { data: modules }, gamification] = await Promise.all([
    tenantFormationIds.length > 0
      ? supabase
          .from("formations")
          .select("id, title, estimated_duration_minutes, attestation_threshold_pct")
          .eq("is_published", true)
          .in("id", tenantFormationIds)
          .order("created_at", { ascending: false })
      : { data: [] as { id: string; title: string; estimated_duration_minutes: number | null; attestation_threshold_pct: number | null }[] },
    tenantFormationIds.length > 0
      ? supabase
          .from("modules")
          .select("id, formation_id, title, order_index, lecons(id, title, order_index, content_type, content_blocks, content_markdown, quizzes(quiz_questions(id)))")
          .in("formation_id", tenantFormationIds)
      : { data: [] as { id: string; formation_id: string; title: string; order_index: number; lecons: unknown }[] },
    dbUser ? computeGamification(dbUser.id, tenantFormationIds) : null,
  ]);

  const enrolledIds = new Set((userEnrollments ?? []).map((e) => e.formation_id));
  const completedLessonIds = new Set((progressRows ?? []).filter((p) => p.status === "completed").map((p) => p.lecon_id));

  const lines: DashboardLine[] = [];
  const newLines: NewLine[] = [];
  for (const f of formations ?? []) {
    const sourceModules: LineSourceModule[] = (modules ?? [])
      .filter((m) => m.formation_id === f.id)
      .map((m) => ({
        id: m.id,
        title: m.title,
        order_index: m.order_index,
        lecons: ((m.lecons ?? []) as unknown as SourceLesson[]).map((l) => ({
          ...l,
          quiz_question_count: (Array.isArray(l.quizzes) ? l.quizzes[0] : l.quizzes)?.quiz_questions?.length ?? 0,
        })),
      }));
    const ordered = [...sourceModules]
      .sort((a, b) => a.order_index - b.order_index)
      .flatMap((m) => [...m.lecons].sort((a, b) => a.order_index - b.order_index));

    if (!enrolledIds.has(f.id)) {
      const minutes = buildLessonLine({
        formationId: f.id, formationTitle: f.title, thresholdPct: 80, modules: sourceModules, currentLessonId: "", completedLessonIds: new Set(),
      }).modules.reduce((sum, m) => sum + m.stations.reduce((s, st) => s + (st.minutes ?? 0), 0), 0);
      newLines.push({ formationId: f.id, title: f.title, moduleCount: sourceModules.length, minutes: minutes || f.estimated_duration_minutes });
      continue;
    }

    const resume = ordered.find((l) => !completedLessonIds.has(l.id)) ?? null;
    lines.push({
      formationId: f.id,
      line: buildLessonLine({
        formationId: f.id,
        formationTitle: f.title,
        thresholdPct: f.attestation_threshold_pct ?? 80,
        modules: sourceModules,
        currentLessonId: resume?.id ?? "",
        completedLessonIds,
      }),
    });
  }

  const totalPoints = dbUser?.total_points ?? 0;
  const badges = gamification?.badges ?? [];
  const newlyUnlocked = dbUser && gamification
    ? await detectAndPersistNewBadges(dbUser.id, [
        ...badges,
        ...gamification.competences.map((c) => ({ id: c.id, label: `Compétence · ${c.label}`, earned: c.earned })),
      ])
    : [];

  return (
    <>
      <BadgeUnlockToasts newlyUnlocked={newlyUnlocked} />
      <LearnerDashboard
        firstName={dbUser?.full_name?.split(/\s+/)[0] ?? null}
        streak={gamification?.streak ?? null}
        level={Math.floor(totalPoints / POINTS_PER_LEVEL) + 1}
        points={totalPoints}
        lines={lines}
        newLines={newLines}
        badges={badges}
      />
    </>
  );
}
