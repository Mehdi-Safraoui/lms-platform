import type { ContentBlock } from "@/lib/ai/contentBlocks";
import { formatMinutes, lessonMinutes } from "@/lib/lessonDuration";

/**
 * La formation vue comme une ligne de métro : chaque module est une
 * correspondance, chaque leçon une station, le certificat est le terminus.
 * Données calculées côté serveur pour le menu (MetroLine) et la barre
 * « Prochaine station » de la page leçon.
 */
export type StationStatus = "done" | "current" | "upcoming";

export interface LineStation {
  id: string;
  /** « 2.1 » : numéro du module, puis rang de la leçon dans le module. */
  code: string;
  title: string;
  contentType: string;
  minutes: number | null;
  status: StationStatus;
  /** Ligne secondaire sous le titre (durée, format). */
  subtitle: string | null;
}

export interface LineModule {
  id: string;
  number: number;
  title: string;
  stations: LineStation[];
  /** done : toutes ses leçons terminées ; current : contient la leçon en cours. */
  status: StationStatus;
  /** Seul le module en cours déplie ses stations ; les autres restent une correspondance. */
  expanded: boolean;
  subtitle: string | null;
}

export interface LessonLine {
  formationId: string;
  formationTitle: string;
  modules: LineModule[];
  current: LineStation | null;
  currentModule: LineModule | null;
  /** Les trois stations qui suivent la leçon en cours. */
  next: LineStation[];
  completed: number;
  total: number;
  /** Rang de la leçon en cours dans tout le parcours (1 = première). */
  position: number;
  thresholdPct: number;
  terminusSubtitle: string;
  /** Temps des leçons restant à terminer pour obtenir le certificat ; 0 = seuil atteint. */
  minutesToCertificate: number;
}

export interface LineSourceModule {
  id: string;
  title: string;
  order_index: number;
  lecons: {
    id: string;
    title: string;
    order_index: number;
    content_type: string;
    content_blocks?: ContentBlock[] | null;
    content_markdown?: string | null;
    quiz_question_count?: number;
  }[];
}

function stationSubtitle(contentType: string, minutes: number | null): string | null {
  if (contentType === "quiz") return minutes ? `Quiz · ${formatMinutes(minutes)}` : "Quiz";
  if (contentType === "video") return "Vidéo";
  return minutes ? formatMinutes(minutes) : null;
}

/** « 2. Choisir les tâches… » → « Choisir les tâches… ». */
export function stripModuleNumber(title: string): string {
  return title.replace(/^\s*(module\s*)?\d+\s*[—–\-.:)]\s*/i, "").trim() || title;
}

export function buildLessonLine(args: {
  formationId: string;
  formationTitle: string;
  thresholdPct: number;
  modules: LineSourceModule[];
  currentLessonId: string;
  completedLessonIds: Set<string>;
}): LessonLine {
  const modules: LineModule[] = [...args.modules]
    .sort((a, b) => a.order_index - b.order_index)
    .map((m, mi) => ({
      id: m.id,
      number: mi + 1,
      title: stripModuleNumber(m.title),
      stations: [...m.lecons]
        .sort((a, b) => a.order_index - b.order_index)
        .map((l, li) => ({
          id: l.id,
          code: `${mi + 1}.${li + 1}`,
          title: l.title,
          contentType: l.content_type,
          minutes: lessonMinutes(l),
          status: (l.id === args.currentLessonId ? "current" : args.completedLessonIds.has(l.id) ? "done" : "upcoming") as StationStatus,
          subtitle: stationSubtitle(l.content_type, lessonMinutes(l)),
        })),
    }))
    .map((m) => {
      const isCurrent = m.stations.some((st) => st.status === "current");
      const allDone = m.stations.length > 0 && m.stations.every((st) => args.completedLessonIds.has(st.id));
      const minutes = m.stations.reduce((sum, st) => sum + (st.minutes ?? 0), 0);
      return {
        ...m,
        status: (isCurrent ? "current" : allDone ? "done" : "upcoming") as StationStatus,
        expanded: isCurrent,
        subtitle: `${m.stations.length} leçon${m.stations.length > 1 ? "s" : ""}${minutes ? ` · ${formatMinutes(minutes)}` : ""}`,
      };
    });

  const stations = modules.flatMap((m) => m.stations);
  const currentIndex = stations.findIndex((s) => s.id === args.currentLessonId);
  const current = currentIndex >= 0 ? stations[currentIndex] : null;
  const total = stations.length;
  const completed = stations.filter((s) => args.completedLessonIds.has(s.id)).length;

  // Leçons encore à terminer pour atteindre le seuil du certificat, prises
  // dans l'ordre du parcours à partir de la leçon en cours.
  const needed = Math.max(0, Math.ceil((args.thresholdPct / 100) * total) - completed);
  const remaining = [...stations.slice(Math.max(0, currentIndex)), ...stations.slice(0, Math.max(0, currentIndex))].filter(
    (s) => !args.completedLessonIds.has(s.id)
  );
  const minutesToCertificate = remaining.slice(0, needed).reduce((sum, s) => sum + (s.minutes ?? 5), 0);

  return {
    formationId: args.formationId,
    formationTitle: args.formationTitle,
    modules,
    current,
    currentModule: modules.find((m) => m.stations.some((s) => s.id === args.currentLessonId)) ?? null,
    next: currentIndex >= 0 ? stations.slice(currentIndex + 1, currentIndex + 4) : [],
    completed,
    total,
    position: currentIndex + 1,
    thresholdPct: args.thresholdPct,
    terminusSubtitle: minutesToCertificate > 0 ? `Encore ${formatMinutes(minutesToCertificate)} de parcours` : "Obtenu, bravo !",
    minutesToCertificate,
  };
}
