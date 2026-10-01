"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowRight, CheckCircle, ClipboardList, TrainFront, Trophy, XCircle } from "lucide-react";
import AccountMenu from "@/components/learner/AccountMenu";
import { toast } from "sonner";
import { getVideoEmbedUrl } from "@/lib/video";
import { formatMinutes } from "@/lib/lessonDuration";
import type { LessonLine } from "@/lib/lessonLine";
import BlockRenderer from "@/components/lessons/BlockRenderer";
import type { ContentBlock } from "@/lib/ai/contentBlocks";
import styles from "./lesson.module.css";

const Markdown = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => ({ default: mod.default.Markdown })),
  { ssr: false }
);

// Pas de is_correct : la correction vient du serveur à la soumission.
interface QuizOption { text: string; }
interface QuizQuestion { id: string; question_text: string; options: QuizOption[]; order_index: number; points: number; }
interface QuizData { id: string; title: string; pass_score: number; quiz_questions: QuizQuestion[]; }

interface Props {
  lessonId: string;
  lessonTitle: string;
  contentType: string;
  contentMarkdown: string | null;
  contentBlocks: ContentBlock[] | null;
  videoUrl: string | null;
  quizData: QuizData | null;
  line: LessonLine;
  initiallyCompleted: boolean;
  learnerName: string | null;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// ── Quiz ─────────────────────────────────────────────────
// Toutes les réponses restent visibles ; la réponse choisie passe au premier
// plan (plaque marine), les autres s'effacent d'un cran.
function QuizPlayer({ quiz }: { quiz: QuizData }) {
  const questions = [...(quiz.quiz_questions ?? [])].sort((a, b) => a.order_index - b.order_index);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [scorePercent, setScorePercent] = useState(0);
  const [passed, setPassed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // question_id → index de la bonne réponse, renvoyé par le serveur.
  const [correction, setCorrection] = useState<Record<string, number>>({});

  const allAnswered = questions.every((_, i) => answers[i] !== undefined);

  function select(qi: number, oi: number) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qi]: oi }));
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/progress/quiz-passed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_id: quiz.id,
          answers: questions.map((q, qi) => ({ question_id: q.id, option_index: answers[qi] ?? -1 })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Impossible d'enregistrer le quiz", { description: data.error });
        return;
      }
      setCorrection(Object.fromEntries((data.correction as { question_id: string; correct_index: number }[]).map((c) => [c.question_id, c.correct_index])));
      setScorePercent(data.percent);
      setPassed(data.passed);
      setSubmitted(true);
      if (data.points_awarded > 0) toast.success(`+${data.points_awarded} points remportés !`);
    } catch {
      toast.error("Erreur réseau : vos réponses n'ont pas été envoyées. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setAnswers({});
    setSubmitted(false);
    setScorePercent(0);
    setPassed(false);
    setCorrection({});
  }

  return (
    <div className={styles.quiz}>
      {submitted && (
        <div className={`${styles.quizResult} ${passed ? styles.quizResultPass : styles.quizResultFail}`} role="status">
          <Trophy size={24} />
          <div>
            <p className={styles.quizResultScore}>{scorePercent} %</p>
            <p className={styles.quizResultLabel}>{passed ? "Quiz validé, la station est franchie." : `Pas encore validé : il faut ${quiz.pass_score} %.`}</p>
          </div>
          <button className={styles.quizRetryBtn} onClick={retry}>Réessayer</button>
        </div>
      )}

      <ol className={styles.quizQuestions}>
        {questions.map((q, qi) => (
          <li key={q.id} className={styles.quizQuestion}>
            <p className={styles.quizQuestionText}>
              <span className={styles.quizQuestionIndex}>{qi + 1}</span>
              {q.question_text}
            </p>
            <div className={styles.quizOptions} role="radiogroup" aria-label={`Question ${qi + 1}`} data-answered={answers[qi] !== undefined || undefined}>
              {q.options.map((o, oi) => {
                const selected = answers[qi] === oi;
                const isCorrect = correction[q.id] === oi;
                const state = submitted
                  ? selected && isCorrect ? "correct" : selected ? "wrong" : isCorrect ? "missed" : "idle"
                  : selected ? "selected" : "idle";
                return (
                  <button
                    key={oi}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={styles.quizOption}
                    data-state={state}
                    onClick={() => select(qi, oi)}
                    disabled={submitted}
                  >
                    <span className={styles.quizOptionLetter}>{String.fromCharCode(65 + oi)}</span>
                    <span>{o.text}</span>
                    {state === "correct" || state === "missed" ? <CheckCircle size={17} className={styles.quizOptionIcon} aria-label="Bonne réponse" /> : null}
                    {state === "wrong" ? <XCircle size={17} className={styles.quizOptionIcon} aria-label="Mauvaise réponse" /> : null}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {!submitted && (
        <button className={styles.quizSubmitBtn} onClick={submit} disabled={!allAnswered || submitting}>
          {submitting ? "Correction…" : "Valider mes réponses"}
        </button>
      )}
    </div>
  );
}

function QuizIntro({ quiz, onStart }: { quiz: QuizData; onStart: () => void }) {
  const count = quiz.quiz_questions.length;
  return (
    <div className={styles.quizIntro}>
      <span className={styles.quizIntroIcon}>
        <ClipboardList size={26} strokeWidth={1.75} />
      </span>
      <div>
        <p className={styles.quizIntroText}>
          Ce quiz vérifie votre compréhension des leçons du module. Lisez bien chaque question avant de répondre.
        </p>
        <p className={styles.quizIntroMeta}>
          {count} question{count > 1 ? "s" : ""} · réussite à partir de {quiz.pass_score} %
        </p>
      </div>
      <button className={styles.quizStartBtn} onClick={onStart}>
        Commencer le quiz
      </button>
    </div>
  );
}

// ── Lesson View ──────────────────────────────────────────
export default function LessonView({
  lessonId,
  lessonTitle,
  contentType,
  contentMarkdown,
  contentBlocks,
  videoUrl,
  quizData,
  line,
  initiallyCompleted,
  learnerName,
}: Props) {
  const router = useRouter();
  const embedUrl = videoUrl ? getVideoEmbedUrl(videoUrl) : null;
  const [quizStarted, setQuizStarted] = useState(false);
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [continuing, setContinuing] = useState(false);
  const startTimeRef = useRef<number>(0);

  const next = line.next[0] ?? null;
  const nextHref = next ? `/apprenant/${line.formationId}/${next.id}` : `/apprenant/${line.formationId}`;
  const lineName = line.formationTitle.replace(/^formation\s+/i, "");

  // Le premier bloc répète souvent le titre de la leçon : déjà affiché en plaque.
  const blocks =
    contentBlocks && contentBlocks[0]?.type === "heading" && normalize(contentBlocks[0].text) === normalize(lessonTitle)
      ? contentBlocks.slice(1)
      : contentBlocks;

  useEffect(() => {
    startTimeRef.current = Date.now();

    // Marquer la leçon comme "en cours"
    fetch("/api/progress/start-lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lecon_id: lessonId }),
    }).catch(() => {});

    return () => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      if (elapsed > 0) {
        fetch("/api/progress/update-time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lecon_id: lessonId, seconds: elapsed }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [lessonId]);

  /**
   * « Continuer » termine la leçon (sauf un quiz, validé à sa réussite côté
   * serveur) puis emmène à la station suivante, ou à la page de la formation
   * en fin de ligne.
   */
  async function continueJourney() {
    setContinuing(true);
    try {
      if (contentType !== "quiz" && !completed) {
        const res = await fetch("/api/progress/complete-lesson", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lecon_id: lessonId }),
        });
        if (!res.ok) {
          toast.error("La leçon n'a pas pu être enregistrée comme terminée. Réessayez.");
          setContinuing(false);
          return;
        }
        const data = await res.json();
        setCompleted(true);
        if (data.points_awarded > 0) toast.success(`+${data.points_awarded} points remportés !`);
      }
      router.push(nextHref);
    } catch {
      toast.error("Erreur réseau : réessayez dans un instant.");
      setContinuing(false);
    }
  }

  const continueLabel = continuing ? "Enregistrement…" : next ? "Continuer" : "Terminus";

  return (
    <div className={styles.main}>
      <div className={styles.account}>
        <AccountMenu name={learnerName} />
      </div>

      <p className={styles.linePill}>
        <span>Ligne {lineName}</span>
        <span>
          Station {line.position} sur {line.total}
          {line.current?.minutes ? ` · ${formatMinutes(line.current.minutes)}` : ""}
        </span>
      </p>
      <h1 className={styles.plaque}>
        {line.currentModule && <span className="srOnly">Module {line.currentModule.number}, {line.currentModule.title} : </span>}
        {lessonTitle}
      </h1>

      <div className={styles.content}>
        {embedUrl && (
          <div className={styles.videoWrapper}>
            <iframe
              src={embedUrl}
              title={lessonTitle}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              className={styles.videoIframe}
            />
          </div>
        )}

        {contentType === "markdown" && contentMarkdown && (
          <div className={styles.markdownWrapper} data-color-mode="light">
            <Markdown source={contentMarkdown} />
          </div>
        )}

        {contentType === "rich" && blocks && blocks.length > 0 && <BlockRenderer blocks={blocks} />}

        {contentType === "video" && !embedUrl && videoUrl && (
          <p className={styles.fallback}>
            Vidéo non disponible.{" "}
            <a href={videoUrl} target="_blank" rel="noopener noreferrer">Ouvrir le lien</a>
          </p>
        )}

        {contentType === "quiz" && quizData && quizData.quiz_questions?.length > 0 && (
          quizStarted
            ? <QuizPlayer quiz={quizData} />
            : <QuizIntro quiz={quizData} onStart={() => setQuizStarted(true)} />
        )}

        {contentType === "quiz" && (!quizData || !quizData.quiz_questions?.length) && (
          <p className={styles.fallback}>Ce quiz n&apos;a pas encore été configuré.</p>
        )}
      </div>

      <div className={styles.nextBar} data-next-bar>
        <TrainFront size={40} strokeWidth={1.8} className={styles.nextIcon} aria-hidden="true" />
        <span className={styles.nextRule} aria-hidden="true" />
        <p className={styles.nextText}>
          {next ? (
            <>
              Prochaine station : {next.title}
              {next.minutes ? <span className={styles.nextTime}> · {formatMinutes(next.minutes)}</span> : null}
            </>
          ) : (
            <>Terminus : certificat, {line.terminusSubtitle.toLowerCase()}</>
          )}
        </p>
        <button type="button" className={styles.continueBtn} onClick={continueJourney} disabled={continuing}>
          {continueLabel}
          <ArrowRight size={22} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
