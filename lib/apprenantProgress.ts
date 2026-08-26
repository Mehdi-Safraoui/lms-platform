export interface ProgressRecord {
  user_id: string;
  lecon_id: string;
  status: string;
  updated_at: string;
}

/**
 * Calcule la complétion d'un apprenant sur un ensemble de leçons données —
 * utilisé à la fois pour la complétion globale (toutes formations) et pour le
 * détail par formation (app/(org)/org/apprenants/ApprenantDetailModal.tsx).
 */
export function getCompletion(userId: string, lessonIds: string[], records: ProgressRecord[]) {
  if (!lessonIds.length) return { completed: 0, total: 0, pct: 0 };
  const completed = records.filter((p) => p.user_id === userId && lessonIds.includes(p.lecon_id) && p.status === "completed").length;
  return { completed, total: lessonIds.length, pct: Math.round((completed / lessonIds.length) * 100) };
}

export function getLastActivity(userId: string, records: ProgressRecord[]): string | null {
  const userRecords = records.filter((p) => p.user_id === userId);
  if (!userRecords.length) return null;
  const latest = userRecords.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
  return latest.updated_at;
}
