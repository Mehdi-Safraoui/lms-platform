import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";
import { hasActiveSubscription } from "@/lib/subscription";
import { isFormationAccessibleToTenant } from "@/lib/formationTenantAccess";
import { buildLessonLine, type LineSourceModule } from "@/lib/lessonLine";
import type { ContentBlock } from "@/lib/ai/contentBlocks";
import MetroLine from "@/components/learner/MetroLine";
import LessonView from "./LessonView";
import NotifyAdminButton from "./NotifyAdminButton";
import styles from "./lesson.module.css";

type Props = { params: Promise<{ formationId: string; lessonId: string }> };

const FREE_PREVIEW_LESSON_COUNT = 2;

interface SourceLesson {
  id: string;
  title: string;
  order_index: number;
  content_type: string;
  content_blocks: ContentBlock[] | null;
  content_markdown: string | null;
  // Un seul quiz par leçon : PostgREST le renvoie en objet (clé unique) ou en tableau.
  quizzes: { quiz_questions: { id: string }[] } | { quiz_questions: { id: string }[] }[] | null;
}

export default async function ApprenantLessonPage({ params }: Props) {
  const { formationId, lessonId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  // Toute la ligne en une requête : leçons de chaque module, avec de quoi
  // estimer leur durée (blocs, nombre de questions des quiz).
  const [{ data: formation }, { data: lecon }, { data: allModules }, dbUser] = await Promise.all([
    supabase.from("formations").select("id, title, is_published, tenant_id, attestation_threshold_pct").eq("id", formationId).single(),
    supabase.from("lecons").select("id, title, content_type, content_markdown, content_blocks, video_url").eq("id", lessonId).single(),
    supabase
      .from("modules")
      .select("id, title, order_index, lecons(id, title, order_index, content_type, content_blocks, content_markdown, quizzes(quiz_questions(id)))")
      .eq("formation_id", formationId)
      .order("order_index"),
    getCurrentUser(),
  ]);

  if (!formation || !formation.is_published || !lecon) notFound();

  const sourceModules: LineSourceModule[] = (allModules ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    order_index: m.order_index,
    lecons: ((m.lecons ?? []) as unknown as SourceLesson[]).map((l) => ({
      ...l,
      quiz_question_count: (Array.isArray(l.quizzes) ? l.quizzes[0] : l.quizzes)?.quiz_questions?.length ?? 0,
    })),
  }));
  const orderedLessonIds = [...sourceModules]
    .sort((a, b) => a.order_index - b.order_index)
    .flatMap((m) => [...m.lecons].sort((a, b) => a.order_index - b.order_index).map((l) => l.id));

  const currentIdx = orderedLessonIds.indexOf(lessonId);
  // La leçon doit appartenir à la formation de l'URL (sinon une leçon d'une
  // autre formation serait lisible via une formation accessible).
  if (currentIdx === -1) notFound();

  // Accès, abonnement, quiz et progression : lectures indépendantes, en parallèle.
  const [accessible, tenantHasSubscription, quizResult, progressResult] = await Promise.all([
    isFormationAccessibleToTenant(supabase, dbUser?.tenant_id ?? null, formation),
    dbUser?.tenant_id ? hasActiveSubscription(dbUser.tenant_id) : false,
    lecon.content_type === "quiz"
      ? supabase
          .from("quizzes")
          .select("id, title, pass_score, quiz_questions(id, question_text, options, order_index, points)")
          .eq("lecon_id", lessonId)
          .single()
      : { data: null },
    dbUser?.id
      ? supabase.from("progress").select("lecon_id, status").eq("user_id", dbUser.id)
      : { data: [] as { lecon_id: string; status: string }[] },
  ]);
  if (!accessible) notFound();

  const progressRows = progressResult.data ?? [];
  const completedLessonIds = new Set(progressRows.filter((p) => p.status === "completed").map((p) => p.lecon_id));

  const line = buildLessonLine({
    formationId,
    formationTitle: formation.title,
    thresholdPct: formation.attestation_threshold_pct ?? 80,
    modules: sourceModules,
    currentLessonId: lessonId,
    completedLessonIds,
  });

  if (!tenantHasSubscription && currentIdx >= FREE_PREVIEW_LESSON_COUNT) {
    return (
      <div className={styles.shell}>
        <MetroLine line={line} />
        <div className={styles.page}>
          <Link href={`/apprenant/${formationId}`} className={styles.back}>
            <ChevronLeft size={16} />
            {formation.title}
          </Link>
          <div className={styles.lockedWall}>
            <div className={styles.lockedIcon}>
              <Lock size={22} strokeWidth={1.75} />
            </div>
            <h2 className={styles.lockedTitle}>Accès limité</h2>
            <p className={styles.lockedText}>
              Vous visualisez un aperçu gratuit de cette formation.
              <br />
              Pour accéder au contenu complet, votre entreprise doit souscrire à un abonnement.
            </p>
            <p className={styles.lockedContact}>Contactez votre administrateur.</p>
            <NotifyAdminButton />
          </div>
        </div>
      </div>
    );
  }

  let quizData = null;
  if (lecon.content_type === "quiz") {
    const data = quizResult.data;
    // Sans les bonnes réponses : la correction est faite et renvoyée par le
    // serveur à la soumission (POST /api/progress/quiz-passed).
    quizData = data
      ? {
          ...data,
          quiz_questions: (data.quiz_questions as { id: string; question_text: string; options: { text: string }[]; order_index: number; points: number }[]).map(
            (q) => ({ ...q, options: q.options.map((o) => ({ text: o.text })) })
          ),
        }
      : null;
  }

  return (
    <div className={styles.shell}>
      <MetroLine line={line} />
      <LessonView
        lessonId={lessonId}
        lessonTitle={lecon.title}
        contentType={lecon.content_type}
        contentMarkdown={lecon.content_markdown}
        contentBlocks={lecon.content_blocks}
        videoUrl={lecon.video_url}
        quizData={quizData}
        line={line}
        initiallyCompleted={completedLessonIds.has(lessonId)}
        learnerName={dbUser?.full_name || dbUser?.email || null}
      />
    </div>
  );
}
