import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Layers, Clock, FileText, Video, ClipboardList, CheckCircle2, Circle } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { hasActiveSubscription } from "@/lib/subscription";
import { formatDuration } from "@/lib/utils";
import { getVideoEmbedUrl } from "@/lib/video";
import BlockRenderer from "@/components/lessons/BlockRenderer";
import MarkdownView from "@/components/lessons/MarkdownView";
import type { ContentBlock } from "@/lib/ai/contentBlocks";
import CatalogueToggle from "../CatalogueToggle";
import styles from "./preview.module.css";

const NIVEAU_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

interface QuizOption { text: string; is_correct: boolean; }
interface QuizQuestion { id: string; question_text: string; options: QuizOption[]; order_index: number; }
interface Lesson {
  id: string;
  title: string;
  content_type: string;
  content_markdown: string | null;
  content_blocks: ContentBlock[] | null;
  video_url: string | null;
  order_index: number;
}

type Props = { params: Promise<{ id: string }> };

export default async function CatalogueFormationPreviewPage({ params }: Props) {
  const { id: formationId } = await params;
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) notFound();

  const supabase = createServiceRoleSupabaseClient();

  const { data: dbUser } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("clerk_user_id", clerkUserId)
    .single();
  if (!dbUser?.tenant_id) notFound();
  if (!(await hasActiveSubscription(dbUser.tenant_id))) redirect("/pricing");

  const [{ data: formation }, { data: tenantFormation }] = await Promise.all([
    supabase
      .from("formations")
      .select("id, title, description, niveau, estimated_duration_minutes")
      .eq("id", formationId)
      .eq("is_published", true)
      .is("tenant_id", null)
      .single(),
    supabase
      .from("tenant_formations")
      .select("formation_id")
      .eq("tenant_id", dbUser.tenant_id)
      .eq("formation_id", formationId)
      .maybeSingle(),
  ]);
  if (!formation) notFound();
  const enabled = !!tenantFormation;

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, order_index")
    .eq("formation_id", formationId)
    .order("order_index");

  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: allLecons } = moduleIds.length > 0
    ? await supabase
        .from("lecons")
        .select("id, module_id, title, content_type, content_markdown, content_blocks, video_url, order_index")
        .in("module_id", moduleIds)
        .order("order_index")
    : { data: [] as (Lesson & { module_id: string })[] };

  const leconsByModule: Record<string, Lesson[]> = {};
  (allLecons ?? []).forEach((l) => {
    leconsByModule[l.module_id] = [...(leconsByModule[l.module_id] ?? []), l];
  });

  const quizLeconIds = (allLecons ?? []).filter((l) => l.content_type === "quiz").map((l) => l.id);
  const { data: quizzes } = quizLeconIds.length > 0
    ? await supabase
        .from("quizzes")
        .select("lecon_id, title, pass_score, quiz_questions(id, question_text, options, order_index)")
        .in("lecon_id", quizLeconIds)
    : { data: [] as { lecon_id: string; title: string; pass_score: number; quiz_questions: QuizQuestion[] }[] };

  const quizByLecon: Record<string, { title: string; pass_score: number; quiz_questions: QuizQuestion[] }> = {};
  (quizzes ?? []).forEach((q) => { quizByLecon[q.lecon_id] = q; });

  const totalLessons = (allLecons ?? []).length;

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.toc}>
          <Link href="/org/catalogue" className={styles.back}>
            <ChevronLeft size={15} />
            Catalogue
          </Link>
          <span className={styles.tocLabel}>Sommaire</span>
          <nav className={styles.tocList}>
            {(modules ?? []).map((mod, mi) => (
              <div key={mod.id} className={styles.tocModule}>
                <a href={`#module-${mod.id}`} className={styles.tocModuleLink}>
                  {String(mi + 1).padStart(2, "0")} · {mod.title}
                </a>
                {(leconsByModule[mod.id] ?? []).map((lesson) => (
                  <a key={lesson.id} href={`#lesson-${lesson.id}`} className={styles.tocLessonLink}>
                    {lesson.title}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <main className={styles.main}>
          <div className={styles.eyebrow}>
            <span className={styles.dot} />
            {formation.niveau ? NIVEAU_LABEL[formation.niveau] ?? formation.niveau : "Formation"}
          </div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{formation.title}</h1>
            <CatalogueToggle formationId={formation.id} enabled={enabled} />
          </div>
          {formation.description && <p className={styles.desc}>{formation.description}</p>}

          <div className={styles.metaRow}>
            <span className={styles.metaItem}>
              <Layers size={14} />
              {modules?.length ?? 0} module{(modules?.length ?? 0) > 1 ? "s" : ""}
            </span>
            <span className={styles.metaItem}>
              <FileText size={14} />
              {totalLessons} leçon{totalLessons > 1 ? "s" : ""}
            </span>
            {formation.estimated_duration_minutes && (
              <span className={styles.metaItem}>
                <Clock size={14} />
                {formatDuration(formation.estimated_duration_minutes)}
              </span>
            )}
          </div>

          {(modules ?? []).map((mod, mi) => (
            <section key={mod.id} id={`module-${mod.id}`} className={styles.module}>
              <div className={styles.moduleHeader}>
                <span className={styles.moduleNumber}>{String(mi + 1).padStart(2, "0")}</span>
                <h2 className={styles.moduleTitle}>{mod.title}</h2>
              </div>

              {(leconsByModule[mod.id] ?? []).length === 0 && (
                <p className={styles.emptyLesson}>Aucune leçon dans ce module.</p>
              )}

              {(leconsByModule[mod.id] ?? []).map((lesson, li) => {
                const embedUrl = lesson.content_type === "video" && lesson.video_url ? getVideoEmbedUrl(lesson.video_url) : null;
                const quiz = quizByLecon[lesson.id];
                return (
                  <div key={lesson.id} id={`lesson-${lesson.id}`} className={styles.lesson}>
                    <div className={styles.lessonHeader}>
                      <span className={styles.lessonIcon}>
                        {lesson.content_type === "video" ? <Video size={14} /> :
                         lesson.content_type === "quiz" ? <ClipboardList size={14} /> :
                         <FileText size={14} />}
                      </span>
                      <span className={styles.lessonIndex}>Leçon {li + 1}</span>
                      <h3 className={styles.lessonTitle}>{lesson.title}</h3>
                    </div>

                    <div className={styles.lessonBody}>
                      {lesson.content_type === "markdown" && lesson.content_markdown && (
                        <MarkdownView source={lesson.content_markdown} />
                      )}
                      {lesson.content_type === "rich" && lesson.content_blocks && lesson.content_blocks.length > 0 && (
                        <BlockRenderer blocks={lesson.content_blocks} />
                      )}
                      {lesson.content_type === "video" && embedUrl && (
                        <div className={styles.videoWrapper}>
                          <iframe src={embedUrl} allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                        </div>
                      )}
                      {lesson.content_type === "video" && !embedUrl && (
                        <p className={styles.emptyLesson}>Aucune vidéo renseignée.</p>
                      )}
                      {lesson.content_type === "quiz" && quiz && (
                        <div className={styles.quizPreview}>
                          <span className={styles.quizMeta}>
                            {quiz.quiz_questions.length} question{quiz.quiz_questions.length > 1 ? "s" : ""} · Seuil de réussite : {quiz.pass_score}%
                          </span>
                          {[...quiz.quiz_questions].sort((a, b) => a.order_index - b.order_index).map((q, qi) => (
                            <div key={q.id} className={styles.quizQuestion}>
                              <p className={styles.quizQuestionText}>{qi + 1}. {q.question_text}</p>
                              <div className={styles.quizOptions}>
                                {q.options.map((o, oi) => (
                                  <div key={oi} className={`${styles.quizOption} ${o.is_correct ? styles.quizOptionCorrect : ""}`}>
                                    {o.is_correct ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                                    {o.text}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {lesson.content_type === "quiz" && !quiz && (
                        <p className={styles.emptyLesson}>Ce quiz n&apos;a pas encore été configuré.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </main>
      </div>
    </div>
  );
}
