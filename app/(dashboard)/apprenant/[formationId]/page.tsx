import { notFound } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";
import { hasActiveSubscription } from "@/lib/subscription";
import { isFormationAccessibleToTenant } from "@/lib/formationTenantAccess";
import { buildLessonLine, type LineSourceModule } from "@/lib/lessonLine";
import type { ContentBlock } from "@/lib/ai/contentBlocks";
import { getOrIssueCertificate } from "@/lib/certificates";
import FormationOverview from "./FormationOverview";

type Props = { params: Promise<{ formationId: string }> };

const FREE_PREVIEW_LESSON_COUNT = 2;

interface SourceLesson {
  id: string;
  title: string;
  order_index: number;
  content_type: string;
  content_blocks: ContentBlock[] | null;
  content_markdown: string | null;
  quizzes: { quiz_questions: { id: string }[] } | { quiz_questions: { id: string }[] }[] | null;
}

export default async function FormationDetailPage({ params }: Props) {
  const { formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  // Toute la ligne en une requête : leçons de chaque module, avec de quoi
  // estimer leur durée (blocs, nombre de questions des quiz).
  const [{ data: formation }, { data: modules }, dbUser] = await Promise.all([
    supabase
      .from("formations")
      .select("id, title, description, niveau, estimated_duration_minutes, attestation_threshold_pct, videos, tenant_id")
      .eq("id", formationId)
      .eq("is_published", true)
      .single(),
    supabase
      .from("modules")
      .select("id, title, order_index, lecons(id, title, order_index, content_type, content_blocks, content_markdown, quizzes(quiz_questions(id)))")
      .eq("formation_id", formationId)
      .order("order_index"),
    getCurrentUser(),
  ]);

  if (!formation) notFound();

  // Accès, abonnement, inscription et progression : lectures indépendantes, en parallèle.
  const [accessible, tenantHasSubscription, { data: enrollment }, { data: progressRows }] = await Promise.all([
    isFormationAccessibleToTenant(supabase, dbUser?.tenant_id ?? null, formation),
    dbUser?.tenant_id ? hasActiveSubscription(dbUser.tenant_id) : false,
    dbUser
      ? supabase.from("user_enrollments").select("id").eq("user_id", dbUser.id).eq("formation_id", formationId).maybeSingle()
      : { data: null },
    dbUser ? supabase.from("progress").select("lecon_id, status").eq("user_id", dbUser.id) : { data: [] as { lecon_id: string; status: string }[] },
  ]);
  if (!accessible) notFound();
  const isEnrolled = !!enrollment;

  const sourceModules: LineSourceModule[] = (modules ?? []).map((m) => ({
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
  const completedLessonIds = new Set(
    isEnrolled ? (progressRows ?? []).filter((p) => p.status === "completed").map((p) => p.lecon_id) : []
  );

  // La station où reprendre : la première leçon non terminée du parcours.
  const resume = ordered.find((l) => !completedLessonIds.has(l.id)) ?? null;
  const line = buildLessonLine({
    formationId,
    formationTitle: formation.title,
    thresholdPct: formation.attestation_threshold_pct ?? 80,
    modules: sourceModules,
    currentLessonId: isEnrolled && resume ? resume.id : "",
    completedLessonIds,
  });
  const lockedIds = new Set(tenantHasSubscription ? [] : ordered.slice(FREE_PREVIEW_LESSON_COUNT).map((l) => l.id));

  const certificateStatus = dbUser && isEnrolled ? await getOrIssueCertificate(supabase, dbUser.id, formationId) : null;

  return (
    <FormationOverview
      formationId={formationId}
      formation={formation}
      line={line}
      isEnrolled={isEnrolled}
      lockedIds={[...lockedIds]}
      certificate={certificateStatus?.certificate ?? null}
    />
  );
}
