"use client";

import * as React from "react";
import { CheckCircle2, Circle, Loader2, FileText } from "lucide-react";
import styles from "./waitingPanel.module.css";

interface Excerpt {
  text: string;
  source: string;
  positionPct: number;
}

// Un seul chargement d'extraits par formation et par session de page, partagé
// entre toutes les attentes (chaque leçon générée, chaque upload...).
const excerptsCache = new Map<string, Promise<Excerpt[]>>();

function loadExcerpts(formationId: string): Promise<Excerpt[]> {
  let pending = excerptsCache.get(formationId);
  if (!pending) {
    pending = fetch(`/api/org/formations/${formationId}/excerpts`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json: { data?: Excerpt[] }) => json.data ?? [])
      .catch(() => []);
    excerptsCache.set(formationId, pending);
  }
  return pending;
}

function formatRemaining(seconds: number): string {
  if (seconds >= 60) return `environ ${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`;
  return `environ ${seconds} s`;
}

const EXCERPT_INTERVAL_MS = 3500;

/**
 * Attente d'une génération IA sans flux à afficher (leçon, quiz, upload,
 * fiche de synthèse) : étapes cochées au fil d'un temps ESTIMÉ, barre de
 * progression, et extraits réels des documents de la formation qui défilent.
 * La progression est une estimation (mesures réelles, voir les appelants) :
 * elle plafonne à 95 % tant que la réponse n'est pas arrivée plutôt que
 * d'annoncer une fin qui n'a pas eu lieu.
 */
export default function WaitingPanel({
  formationId,
  steps,
  estimatedSeconds,
  showExcerpts = true,
}: {
  formationId: string;
  steps: string[];
  estimatedSeconds: number;
  showExcerpts?: boolean;
}) {
  const [elapsed, setElapsed] = React.useState(0);
  const [excerpts, setExcerpts] = React.useState<Excerpt[]>([]);
  const [excerptIndex, setExcerptIndex] = React.useState(0);

  React.useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 250);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!showExcerpts) return;
    let cancelled = false;
    loadExcerpts(formationId).then((list) => {
      if (!cancelled) setExcerpts(list);
    });
    const rotation = setInterval(() => setExcerptIndex((i) => i + 1), EXCERPT_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(rotation);
    };
  }, [formationId, showExcerpts]);

  const ratio = elapsed / estimatedSeconds;
  const progress = Math.min(95, ratio * 100);
  const currentStep = Math.min(steps.length - 1, Math.floor(Math.min(ratio, 0.999) * steps.length));
  const remaining = Math.max(0, Math.round(estimatedSeconds - elapsed));
  const excerpt = excerpts.length ? excerpts[excerptIndex % excerpts.length] : null;

  return (
    <div className={styles.panel} role="status" aria-live="polite">
      <ul className={styles.steps}>
        {steps.map((label, i) => (
          <li key={label} className={i < currentStep ? styles.stepDone : i === currentStep ? styles.stepCurrent : styles.step}>
            {i < currentStep ? (
              <CheckCircle2 size={16} className={styles.iconDone} />
            ) : i === currentStep ? (
              <Loader2 size={16} className={styles.iconCurrent} />
            ) : (
              <Circle size={16} className={styles.iconTodo} />
            )}
            {label}
          </li>
        ))}
      </ul>

      <div className={styles.bar}>
        <div className={styles.barFill} style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
      <p className={styles.remaining}>
        {remaining > 0 ? `Temps restant estimé : ${formatRemaining(remaining)}` : "Encore quelques secondes…"}
      </p>

      {excerpt && (
        <figure className={styles.excerpt}>
          <figcaption className={styles.excerptSource}>
            <FileText size={13} />
            {excerpt.source} · vers {excerpt.positionPct} % du document
          </figcaption>
          <blockquote key={excerptIndex} className={styles.excerptText}>
            « {excerpt.text} »
          </blockquote>
        </figure>
      )}
    </div>
  );
}
