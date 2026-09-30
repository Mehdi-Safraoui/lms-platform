"use client";

import * as React from "react";
import { parse, Allow } from "partial-json";
import { Sparkles, ClipboardList, GraduationCap } from "lucide-react";
import styles from "./structure.module.css";

interface PartialLesson {
  title?: string;
  description?: string;
  contentType?: string;
}
interface PartialModule {
  title?: string;
  lessons?: PartialLesson[];
}

function parseModules(text: string): PartialModule[] {
  if (!text) return [];
  try {
    const value = parse(text, Allow.ALL) as { modules?: PartialModule[] } | undefined;
    return Array.isArray(value?.modules) ? value.modules : [];
  } catch {
    return [];
  }
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`;
}

function SkeletonModule() {
  return (
    <div className={`${styles.moduleCard} ${styles.skeletonCard}`} aria-hidden="true">
      <div className={styles.skeletonHeader} />
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonLine} />
      <div className={styles.skeletonLineShort} />
    </div>
  );
}

/**
 * Plan de formation affiché au fil de son écriture par l'IA (route en
 * streaming .../structure/generate) : le JSON partiel reçu est relu à chaque
 * mise à jour, les modules déjà écrits s'affichent, un squelette clignotant
 * tient la place du suivant — et de tout le plan pendant les premières
 * secondes, avant que le modèle n'écrive son premier module.
 */
export default function StreamingStructurePreview({
  text,
  expectedModules,
  retrying,
}: {
  text: string;
  expectedModules: number | null;
  retrying: boolean;
}) {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const modules = parseModules(text).filter((m) => m.title);
  const writing = modules.length;
  const remaining = expectedModules ? Math.max(0, expectedModules - writing) : 1;

  return (
    <div aria-live="polite">
      <div className={styles.streamHeader}>
        <Sparkles size={16} className={`${styles.streamIcon} ${styles.pulse}`} />
        <span className={styles.streamTitle}>
          {retrying
            ? "L'IA corrige sa proposition…"
            : writing === 0
              ? "L'IA lit vos documents et prépare le plan…"
              : `L'IA construit votre plan — module ${writing}${expectedModules ? ` / ${expectedModules}` : ""}`}
        </span>
        <span className={styles.streamElapsed}>{formatElapsed(elapsed)}</span>
      </div>

      {modules.map((mod, mi) => {
        const isLast = mi === modules.length - 1;
        const lessons = (mod.lessons ?? []).filter((l) => l.title);
        return (
          <div key={mi} className={`${styles.moduleCard} ${styles.streamModule}`}>
            <div className={styles.moduleHeader}>
              <span className={styles.moduleBadge}>Module {mi + 1}</span>
              <span className={styles.streamModuleTitle}>{mod.title}</span>
            </div>
            <div className={styles.lessonsList}>
              {lessons.map((lesson, li) => (
                <div key={li} className={styles.lessonRow}>
                  <span className={styles.lessonTypeIcon}>
                    {lesson.contentType === "quiz" ? <ClipboardList size={14} /> : <GraduationCap size={14} />}
                  </span>
                  <div className={styles.lessonFields}>
                    <span className={styles.streamLessonTitle}>{lesson.title}</span>
                    {lesson.description && <span className={styles.streamLessonDesc}>{lesson.description}</span>}
                  </div>
                </div>
              ))}
              {isLast && <div className={styles.streamCaret} aria-hidden="true" />}
            </div>
          </div>
        );
      })}

      {writing === 0 ? (
        <>
          <SkeletonModule />
          <SkeletonModule />
          <SkeletonModule />
        </>
      ) : (
        remaining > 0 && <SkeletonModule />
      )}
    </div>
  );
}
