"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, AlertTriangle, TrendingDown, ClipboardList, GraduationCap, ChevronUp, ChevronDown } from "lucide-react";
import type { FormationAnalytics, LearnerRow, LearnerStatus } from "@/lib/formationAnalytics";
import styles from "./analytics.module.css";

const STATUS_LABEL: Record<LearnerStatus, string> = {
  not_started: "Non commencé",
  in_progress: "En cours",
  completed: "Terminé",
};

// Question réussie par moins d'un apprenant sur deux : signalée comme à retravailler.
const WEAK_QUESTION_PCT = 50;

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.meter} title={label} aria-label={label}>
      <div className={styles.meterFill} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileValue}>{value}</span>
      {hint && <span className={styles.tileHint}>{hint}</span>}
    </div>
  );
}

type SortKey = "name" | "progressPct" | "timeMinutes" | "quizAvgPct" | "lastActivity";

export default function FormationAnalyticsView({
  data,
  backHref,
  backLabel,
  exportHref,
  showTenant,
}: {
  data: FormationAnalytics;
  backHref: string;
  backLabel: string;
  exportHref: string;
  /** Vue super_admin : colonne "Entreprise" dans le tableau des apprenants. */
  showTenant: boolean;
}) {
  const { kpis, funnel, quizzes } = data;
  const [statusFilter, setStatusFilter] = React.useState<LearnerStatus | "all">("all");
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "progressPct", dir: -1 });

  // Plus forte baisse de complétion d'une leçon à la suivante : là où les
  // apprenants décrochent.
  const biggestDrop = funnel.reduce<{ index: number; drop: number }>(
    (best, row, i) => {
      if (i === 0) return best;
      const drop = funnel[i - 1].completedPct - row.completedPct;
      return drop > best.drop ? { index: i, drop } : best;
    },
    { index: -1, drop: 0 }
  );

  const learners = data.learners
    .filter((l) => statusFilter === "all" || l.status === statusFilter)
    .sort((a, b) => {
      const va = a[sort.key] as LearnerRow[SortKey];
      const vb = b[sort.key] as LearnerRow[SortKey];
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va > vb ? 1 : -1) * sort.dir;
    });

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "name" ? 1 : -1 }));
  }

  function sortHeader(label: string, k: SortKey) {
    const active = sort.key === k;
    return (
      <th aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button type="button" className={styles.sortBtn} onClick={() => toggleSort(k)}>
          {label}
          {active && (sort.dir === 1 ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
        </button>
      </th>
    );
  }

  return (
    <div className={styles.page}>
      <Link href={backHref} className={styles.back}>
        <ArrowLeft size={16} strokeWidth={2} />
        {backLabel}
      </Link>

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{data.formation.title}</h1>
          <p className={styles.subtitle}>
            Suivi de {kpis.learners} apprenant{kpis.learners > 1 ? "s" : ""} · {data.totalLessons} leçon{data.totalLessons > 1 ? "s" : ""}
          </p>
        </div>
        <a href={exportHref} className={styles.exportBtn}>
          <Download size={15} />
          Exporter (CSV)
        </a>
      </div>

      {kpis.learners === 0 ? (
        <p className={styles.empty}>Aucun apprenant inscrit à cette formation pour l&apos;instant.</p>
      ) : (
        <>
          <section className={styles.kpis} aria-label="Indicateurs clés">
            <div className={styles.hero}>
              <span className={styles.tileLabel}>Taux de complétion</span>
              <span className={styles.heroValue}>{kpis.completionRatePct ?? 0} %</span>
              <span className={styles.tileHint}>
                {kpis.completed} apprenant{kpis.completed > 1 ? "s" : ""} sur {kpis.learners} ont terminé
              </span>
            </div>
            <div className={styles.tiles}>
              <StatTile label="Ont commencé" value={`${kpis.started} / ${kpis.learners}`} />
              <StatTile label="Progression moyenne" value={kpis.avgProgressPct === null ? "—" : `${kpis.avgProgressPct} %`} />
              <StatTile label="Temps moyen passé" value={formatMinutes(kpis.avgTimeMinutes)} hint="par apprenant ayant commencé" />
              <StatTile label="Score moyen aux quiz" value={kpis.avgQuizPct === null ? "—" : `${kpis.avgQuizPct} %`} hint="meilleur score par quiz" />
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Progression leçon par leçon</h2>
            <p className={styles.sectionHint}>Part des apprenants ayant terminé chaque leçon, dans l&apos;ordre de la formation.</p>
            <div className={styles.funnel}>
              {funnel.map((row, i) => {
                const header = i === 0 || funnel[i - 1].moduleTitle !== row.moduleTitle ? row.moduleTitle : null;
                const isDrop = i === biggestDrop.index && biggestDrop.drop > 0;
                const detail = `${row.completedCount} apprenant${row.completedCount > 1 ? "s" : ""} sur ${kpis.learners} (${row.completedPct} %)${row.avgTimeMinutes ? ` · ${row.avgTimeMinutes} min en moyenne` : ""}`;
                return (
                  <React.Fragment key={row.lessonId}>
                    {header && <span className={styles.funnelModule}>{header}</span>}
                    <div className={styles.funnelRow} tabIndex={0}>
                      <span className={styles.funnelLabel}>
                        {row.isQuiz ? <ClipboardList size={13} /> : <GraduationCap size={13} />}
                        <span className={styles.funnelTitle}>{row.title}</span>
                      </span>
                      <Meter value={row.completedPct} label={detail} />
                      <span className={styles.funnelValue}>{row.completedPct} %</span>
                      {isDrop && (
                        <span className={styles.dropBadge}>
                          <TrendingDown size={12} />
                          Plus forte baisse (−{biggestDrop.drop} pts)
                        </span>
                      )}
                      <span className={styles.tooltip} role="tooltip">{detail}</span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Quiz</h2>
            <p className={styles.sectionHint}>
              Taux de bonnes réponses par question. Une question réussie par moins de {WEAK_QUESTION_PCT} % des apprenants signale souvent une leçon à clarifier.
            </p>
            <div className={styles.quizGrid}>
              {quizzes.map((quiz) => (
                <div key={quiz.quizId} className={styles.quizCard}>
                  <div className={styles.quizHeader}>
                    <span className={styles.quizModule}>{quiz.moduleTitle}</span>
                    <span className={styles.quizTitle}>{quiz.lessonTitle}</span>
                    <span className={styles.quizMeta}>
                      {quiz.learnersAttempted} apprenant{quiz.learnersAttempted > 1 ? "s" : ""} · {quiz.attempts} tentative{quiz.attempts > 1 ? "s" : ""}
                      {quiz.passRatePct !== null && ` · ${quiz.passRatePct} % réussi`}
                      {quiz.firstTryPassRatePct !== null && ` (${quiz.firstTryPassRatePct} % du premier coup)`}
                    </span>
                  </div>
                  {quiz.questions.every((q) => q.answered === 0) ? (
                    <p className={styles.quizEmpty}>
                      {quiz.attempts === 0
                        ? "Pas encore de tentative."
                        : "Le détail par question est enregistré pour les tentatives à partir du 1er octobre 2026."}
                    </p>
                  ) : (
                    <ol className={styles.questions}>
                      {quiz.questions.map((q) => {
                        const weak = q.correctPct !== null && q.correctPct < WEAK_QUESTION_PCT;
                        return (
                          <li key={q.questionId} className={styles.question}>
                            <span className={styles.questionText}>{q.text}</span>
                            {q.correctPct === null ? (
                              <span className={styles.questionNoData}>Pas de réponse</span>
                            ) : (
                              <div className={styles.questionStats}>
                                <Meter value={q.correctPct} label={`${q.correctPct} % de bonnes réponses sur ${q.answered} réponse${q.answered > 1 ? "s" : ""}`} />
                                <span className={styles.funnelValue}>{q.correctPct} %</span>
                              </div>
                            )}
                            {weak && (
                              <span className={styles.weakBadge}>
                                <AlertTriangle size={12} />
                                À retravailler
                                {q.topWrongAnswer && ` · réponse fausse la plus choisie : « ${q.topWrongAnswer.text} » (${q.topWrongAnswer.pct} %)`}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeaderRow}>
              <h2 className={styles.sectionTitle}>Apprenants</h2>
              <select
                className={styles.filter}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as LearnerStatus | "all")}
                aria-label="Filtrer par statut"
              >
                <option value="all">Tous les statuts</option>
                <option value="not_started">Non commencé</option>
                <option value="in_progress">En cours</option>
                <option value="completed">Terminé</option>
              </select>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {sortHeader("Apprenant", "name")}
                    {showTenant && <th>Entreprise</th>}
                    {sortHeader("Progression", "progressPct")}
                    {sortHeader("Temps passé", "timeMinutes")}
                    {sortHeader("Quiz", "quizAvgPct")}
                    {sortHeader("Dernière activité", "lastActivity")}
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {learners.map((l) => (
                    <tr key={l.userId}>
                      <td>
                        <span className={styles.learnerName}>{l.name}</span>
                        <span className={styles.learnerEmail}>{l.email}</span>
                      </td>
                      {showTenant && <td>{l.tenantName ?? "—"}</td>}
                      <td>
                        <div className={styles.progressCell}>
                          <Meter value={l.progressPct} label={`${l.completedLessons} leçon${l.completedLessons > 1 ? "s" : ""} sur ${l.totalLessons}`} />
                          <span className={styles.num}>{l.progressPct} %</span>
                        </div>
                      </td>
                      <td className={styles.num}>{formatMinutes(l.timeMinutes)}</td>
                      <td className={styles.num}>{l.quizAvgPct === null ? "—" : `${l.quizAvgPct} %`}</td>
                      <td className={styles.num}>{formatDate(l.lastActivity)}</td>
                      <td>
                        <span className={`${styles.status} ${styles[`status_${l.status}`]}`}>{STATUS_LABEL[l.status]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
