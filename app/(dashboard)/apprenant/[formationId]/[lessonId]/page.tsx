import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ChevronLeft, Lock } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import LessonView from "./LessonView";
import NotifyAdminButton from "./NotifyAdminButton";
import styles from "./lesson.module.css";

type Props = { params: Promise<{ formationId: string; lessonId: string }> };

const FREE_PREVIEW_LESSON_COUNT = 2;

export default async function ApprenantLessonPage({ params }: Props) {
  const { formationId, lessonId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  const { userId: clerkUserId } = await auth();

  const [{ data: formation }, { data: lecon }, { data: allModules }, { data: dbUser }] = await Promise.all([
    supabase.from("formations").select("id, title, is_published").eq("id", formationId).single(),
    supabase.from("lecons").select("id, title, content_type, content_markdown, video_url").eq("id", lessonId).single(),
    supabase.from("modules").select("id, title, order_index, lecons(id, title, order_index)").eq("formation_id", formationId).order("order_index"),
    clerkUserId
      ? supabase.from("users").select("id, tenant_id").eq("clerk_user_id", clerkUserId).single()
      : { data: null },
  ]);

  if (!formation || !formation.is_published || !lecon) notFound();

  const sortedModules = (allModules ?? []).sort((a, b) => a.order_index - b.order_index);
  const allLessons = sortedModules.flatMap((m) =>
    [...((m.lecons as { id: string; title: string; order_index: number }[]) ?? [])].sort((a, b) => a.order_index - b.order_index)
  );

  const currentIdx = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  let currentModuleTitle = "";
  let moduleNumber = 1;
  let lessonIndexInModule = 1;
  let lessonsInModule = 1;
  sortedModules.forEach((m, moduleIdx) => {
    const lecons = [...((m.lecons as { id: string; title: string; order_index: number }[]) ?? [])].sort(
      (a, b) => a.order_index - b.order_index
    );
    const posInModule = lecons.findIndex((l) => l.id === lessonId);
    if (posInModule !== -1) {
      currentModuleTitle = m.title;
      moduleNumber = moduleIdx + 1;
      lessonIndexInModule = posInModule + 1;
      lessonsInModule = lecons.length;
    }
  });

  const tenantHasSubscription = dbUser?.tenant_id ? await hasActiveSubscription(dbUser.tenant_id) : false;

  if (!tenantHasSubscription && currentIdx >= FREE_PREVIEW_LESSON_COUNT) {
    return (
      <div className={styles.page}>
        <Link href={`/apprenant/${formationId}`} className={styles.back}>
          <ChevronLeft size={15} />
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
    );
  }

  let quizData = null;
  if (lecon.content_type === "quiz") {
    const { data } = await supabase
      .from("quizzes")
      .select("id, title, pass_score, quiz_questions(*)")
      .eq("lecon_id", lessonId)
      .single();
    quizData = data ?? null;
  }

  let completedInFormation = 0;
  if (dbUser?.id && allLessons.length > 0) {
    const { data: progressRows } = await supabase
      .from("progress")
      .select("lecon_id")
      .eq("user_id", dbUser.id)
      .eq("status", "completed")
      .in("lecon_id", allLessons.map((l) => l.id));
    completedInFormation = progressRows?.length ?? 0;
  }

  return (
    <LessonView
      lessonId={lessonId}
      formationId={formationId}
      formationTitle={formation.title}
      lessonTitle={lecon.title}
      contentType={lecon.content_type}
      contentMarkdown={lecon.content_markdown}
      videoUrl={lecon.video_url}
      quizData={quizData}
      prevLesson={prevLesson}
      nextLesson={nextLesson}
      moduleTitle={currentModuleTitle}
      moduleNumber={moduleNumber}
      lessonIndexInModule={lessonIndexInModule}
      lessonsInModule={lessonsInModule}
      totalInFormation={allLessons.length}
      completedInFormation={completedInFormation}
    />
  );
}
