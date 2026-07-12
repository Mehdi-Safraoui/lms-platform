"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Trophy, ClipboardList, Check } from "lucide-react";
import { toast } from "sonner";
import { getVideoEmbedUrl } from "@/lib/video";
import styles from "./lesson.module.css";

const Markdown = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => ({ default: mod.default.Markdown })),
  { ssr: false }
);

interface QuizOption { text: string; is_correct: boolean; }
interface QuizQuestion { id: string; question_text: string; options: QuizOption[]; order_index: number; points: number; }
interface QuizData { id: string; title: string; pass_score: number; quiz_questions: QuizQuestion[]; }

interface AdjacentLesson { id: string; title: string; }

interface Props {
  lessonId: string;
  formationId: string;
  formationTitle: string;
  lessonTitle: string;
  contentType: string;
  contentMarkdown: string | null;
  videoUrl: string | null;
  quizData: QuizData | null;
  prevLesson: AdjacentLesson | null;
  nextLesson: AdjacentLesson | null;
}

// ── Quiz Player ──────────────────────────────────────────
function QuizPlayer({ quiz }: { quiz: QuizData }) {
  const questions = [...(quiz.quiz_questions ?? [])].sort((a, b) => a.order_index - b.order_index);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [scorePercent, setScorePercent] = useState(0);

  const allAnswered = questions.every((_, i) => answers[i] !== undefined);

  function select(qi: number, oi: number) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qi]: oi }));
  }

  async function submit() {
    let earned = 0;
    let total = 0;
    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      total += q.points;
      const oi = answers[qi] ?? -1;
      if (oi >= 0 && q.options[oi]?.is_correct === true) earned += q.points;
    }
    const percent = total > 0 ? Math.round((earned / total) * 100) : 0;
    const isPassed = percent >= quiz.pass_score;

    setScorePercent(percent);
    setSubmitted(true);

    try {
      const res = await fetch("/api/progress/quiz-passed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz_id: quiz.id, score: earned, max_score: total, passed: isPassed }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.points_awarded > 0) toast.success(`+${data.points_awarded} points remportés !`);
      }
    } catch {
      // Ne pas bloquer l'affichage du résultat si l'API échoue
    }
  }

  function retry() {
    setAnswers({});
    setSubmitted(false);
    setScorePercent(0);
  }

  const passed = scorePercent >= quiz.pass_score;

  return (
    <div className={styles.quiz}>
      <div className={styles.quizHeader}>
        <h2 className={styles.quizTitle}>{quiz.title}</h2>
        <span className={styles.quizThreshold}>Seuil de réussite : {quiz.pass_score}%</span>
      </div>

      {submitted && (
        <div className={`${styles.quizResult} ${passed ? styles.quizResultPass : styles.quizResultFail}`}>
          <Trophy size={22} />
          <div>
            <p className={styles.quizResultScore}>{scorePercent}%</p>
            <p className={styles.quizResultLabel}>{passed ? "Quiz validé ✓" : `Non validé — score minimum : ${quiz.pass_score}%`}</p>
          </div>
          <button className={styles.quizRetryBtn} onClick={retry}>Réessayer</button>
        </div>
      )}

      <div className={styles.quizQuestions}>
        {questions.map((q, qi) => (
          <div key={q.id} className={styles.quizQuestion}>
            <p className={styles.quizQuestionIndex}>Question {qi + 1}</p>
            <p className={styles.quizQuestionText}>{q.question_text}</p>
            <div className={styles.quizOptions}>
              {q.options.map((o, oi) => {
                const selected = answers[qi] === oi;
                const isCorrect = o.is_correct;
                let optClass = styles.quizOption;
                if (submitted) {
                  if (selected && isCorrect) optClass = `${styles.quizOption} ${styles.quizOptionCorrect}`;
                  else if (selected && !isCorrect) optClass = `${styles.quizOption} ${styles.quizOptionWrong}`;
                  else if (!selected && isCorrect) optClass = `${styles.quizOption} ${styles.quizOptionCorrectMissed}`;
                } else if (selected) {
                  optClass = `${styles.quizOption} ${styles.quizOptionSelected}`;
                }
                return (
                  <button key={oi} className={optClass} onClick={() => select(qi, oi)} disabled={submitted}>
                    <span className={styles.quizOptionDot} />
                    <span>{o.text}</span>
                    {submitted && isCorrect && <CheckCircle size={15} className={styles.quizOptionIcon} />}
                    {submitted && selected && !isCorrect && <XCircle size={15} className={styles.quizOptionIcon} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!submitted && (
        <button className={styles.quizSubmitBtn} onClick={submit} disabled={!allAnswered}>
          Soumettre le quiz
        </button>
      )}
    </div>
  );
}

// ── Quiz Intro ───────────────────────────────────────────
function QuizIntro({ quiz, onStart }: { quiz: QuizData; onStart: () => void }) {
  return (
    <div className={styles.quizIntro}>
      <div className={styles.quizIntroIcon}>
        <ClipboardList size={28} strokeWidth={1.5} />
      </div>
      <p className={styles.quizIntroText}>
        Ce quiz a pour objectif de vérifier votre compréhension des leçons de ce module.
        Lisez bien chaque question avant de répondre.
      </p>
      <div className={styles.quizIntroMeta}>
        <span>{quiz.quiz_questions.length} question{quiz.quiz_questions.length > 1 ? "s" : ""}</span>
        <span className={styles.quizIntroMetaDot} />
        <span>Seuil de réussite : {quiz.pass_score}%</span>
      </div>
      <button className={styles.quizStartBtn} onClick={onStart}>
        Commencer le quiz
      </button>
    </div>
  );
}

// ── Lesson View ──────────────────────────────────────────
export default function LessonView({ lessonId, formationId, formationTitle, lessonTitle, contentType, contentMarkdown, videoUrl, quizData, prevLesson, nextLesson }: Props) {
  const embedUrl = videoUrl ? getVideoEmbedUrl(videoUrl) : null;
  const [quizStarted, setQuizStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);

  async function completeLesson() {
    setCompleting(true);
    try {
      const res = await fetch("/api/progress/complete-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lecon_id: lessonId }),
      });
      if (res.ok) {
        const data = await res.json();
        setCompleted(true);
        if (data.points_awarded > 0) toast.success(`+${data.points_awarded} points remportés !`);
        else toast.success("Leçon marquée comme terminée ✓");
      }
    } catch {
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className={styles.page}>
      <Link href={`/apprenant/${formationId}`} className={styles.back}>
        <ChevronLeft size={15} />
        {formationTitle}
      </Link>

      <h1 className={styles.title}>{lessonTitle}</h1>

      {embedUrl && (
        <div className={styles.videoWrapper}>
          <iframe
            src={embedUrl}
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

      {contentType === "video" && !embedUrl && videoUrl && (
        <p className={styles.videoFallback}>
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
        <p className={styles.videoFallback}>Ce quiz n&apos;a pas encore été configuré.</p>
      )}

      {contentType !== "quiz" && (
        <div className={styles.completeRow}>
          <button
            className={`${styles.completeBtn} ${completed ? styles.completeBtnDone : ""}`}
            onClick={completeLesson}
            disabled={completed || completing}
          >
            <Check size={15} />
            {completed ? "Leçon terminée" : completing ? "Enregistrement…" : "Marquer comme terminé"}
          </button>
        </div>
      )}

      {(prevLesson || nextLesson) && (
        <div className={styles.lessonNav}>
          <div className={styles.lessonNavSlot}>
            {prevLesson && (
              <Link href={`/apprenant/${formationId}/${prevLesson.id}`} className={styles.lessonNavBtn}>
                <ChevronLeft size={16} />
                <span className={styles.lessonNavLabel}>
                  <em>Précédent</em>
                  <span>{prevLesson.title}</span>
                </span>
              </Link>
            )}
          </div>
          <div className={`${styles.lessonNavSlot} ${styles.lessonNavSlotRight}`}>
            {nextLesson && (
              <Link href={`/apprenant/${formationId}/${nextLesson.id}`} className={`${styles.lessonNavBtn} ${styles.lessonNavBtnNext}`}>
                <span className={styles.lessonNavLabel}>
                  <em>Suivant</em>
                  <span>{nextLesson.title}</span>
                </span>
                <ChevronRight size={16} />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
