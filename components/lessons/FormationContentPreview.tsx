import Link from "next/link";
import { ChevronLeft, Layers, Clock, FileText, Video, ClipboardList, CheckCircle2, Circle } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { getVideoEmbedUrl } from "@/lib/video";
import BlockRenderer from "@/components/lessons/BlockRenderer";
import MarkdownView from "@/components/lessons/MarkdownView";
import type { ContentBlock } from "@/lib/ai/contentBlocks";
import styles from "./formationContentPreview.module.css";

const NIVEAU_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export interface PreviewQuizQuestion {
  id: string;
  question_text: string;
  options: { text: string; is_correct: boolean }[];
  order_index: number;
}

export interface PreviewQuiz {
  title: string;
  pass_score: number;
  quiz_questions: PreviewQuizQuestion[];
}

export interface PreviewLesson {
  id: string;
  title: string;
  content_type: string;
  content_markdown: string | null;
  content_blocks: ContentBlock[] | null;
  video_url: string | null;
}

export interface PreviewModule {
  id: string;
  title: string;
}

/**
 * Vue de lecture seule du contenu complet d'une formation (sommaire + rendu
 * module par module), utilisée à la fois pour le catalogue global
 * (app/(org)/org/catalogue/[id]) et pour "Mes formations" côté admin_tenant
 * (app/(org)/org/formations/[id]/apercu) — chaque page ne fait que
 * l'authentification + la récupération des données, propres à son propre
 * modèle d'accès (catalogue global vs formation du tenant), et délègue tout le
 * rendu ici pour ne jamais faire diverger les deux vues.
 */
export default function FormationContentPreview({
  backHref,
  backLabel,
  title,
  description,
  niveau,
  estimatedDurationMinutes,
  modules,
  leconsByModule,
  quizByLecon,
  headerRight,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  description: string | null;
  niveau: string | null;
  estimatedDurationMinutes: number | null;
  modules: PreviewModule[];
  leconsByModule: Record<string, PreviewLesson[]>;
  quizByLecon: Record<string, PreviewQuiz>;
  headerRight?: React.ReactNode;
}) {
  const totalLessons = Object.values(leconsByModule).reduce((sum, lecons) => sum + lecons.length, 0);

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <aside className={styles.toc}>
          <Link href={backHref} className={styles.back}>
            <ChevronLeft size={15} />
            {backLabel}
          </Link>
          <span className={styles.tocLabel}>Sommaire</span>
          <nav className={styles.tocList}>
            {modules.map((mod, mi) => (
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
            {niveau ? NIVEAU_LABEL[niveau] ?? niveau : "Formation"}
          </div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {headerRight}
          </div>
          {description && <p className={styles.desc}>{description}</p>}

          <div className={styles.metaRow}>
            <span className={styles.metaItem}>
              <Layers size={14} />
              {modules.length} module{modules.length > 1 ? "s" : ""}
            </span>
            <span className={styles.metaItem}>
              <FileText size={14} />
              {totalLessons} leçon{totalLessons > 1 ? "s" : ""}
            </span>
            {estimatedDurationMinutes && (
              <span className={styles.metaItem}>
                <Clock size={14} />
                {formatDuration(estimatedDurationMinutes)}
              </span>
            )}
          </div>

          {modules.map((mod, mi) => (
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
                      {(lesson.content_type === "markdown") && lesson.content_markdown && (
                        <MarkdownView source={lesson.content_markdown} />
                      )}
                      {(lesson.content_type === "rich") && lesson.content_blocks && lesson.content_blocks.length > 0 && (
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
                      {lesson.content_type === "rich" && (!lesson.content_blocks || lesson.content_blocks.length === 0) && (
                        <p className={styles.emptyLesson}>Aucun contenu généré pour cette leçon pour l&apos;instant.</p>
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

          {modules.length === 0 && (
            <p className={styles.emptyLesson} style={{ marginTop: 24 }}>
              Aucun module pour l&apos;instant.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
