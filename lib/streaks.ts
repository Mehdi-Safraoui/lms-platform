/**
 * Série d'apprentissage : nombre de jours consécutifs avec au moins une
 * activité (leçon commencée ou terminée, quiz tenté), en heure de Paris.
 * La série en cours reste valable tant que l'apprenant a été actif
 * aujourd'hui ou hier — elle ne se casse qu'après une journée complète sans
 * activité.
 */
export interface Streak {
  current: number;
  best: number;
  /** Déjà actif aujourd'hui (sinon, la série en cours se casse demain). */
  activeToday: boolean;
  /** Nombre total de jours avec une activité. */
  activeDays: number;
}

const dayKey = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

function toDay(date: Date): string {
  return dayKey.format(date); // AAAA-MM-JJ
}

function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function computeStreak(activityDates: (string | null | undefined)[], now: Date = new Date()): Streak {
  const days = new Set(activityDates.filter((d): d is string => !!d).map((d) => toDay(new Date(d))));
  if (days.size === 0) return { current: 0, best: 0, activeToday: false, activeDays: 0 };

  const sorted = [...days].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = previousDay(sorted[i]) === sorted[i - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const today = toDay(now);
  const activeToday = days.has(today);
  let cursor = activeToday ? today : previousDay(today);
  let current = 0;
  while (days.has(cursor)) {
    current += 1;
    cursor = previousDay(cursor);
  }

  return { current, best, activeToday, activeDays: days.size };
}
