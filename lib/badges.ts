import type { LucideIcon } from "lucide-react";
import { Flag, Flame, Target, Trophy, Lightbulb, Zap, Crown, CalendarCheck } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { computeStreak, type Streak } from "@/lib/streaks";

export interface BadgeDef {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  earned: boolean;
}

/** Badge de compétence : un par module terminé (toutes ses leçons, quiz réussi compris). */
export interface CompetenceBadge {
  id: string;
  label: string;
  formationTitle: string;
  completed: number;
  total: number;
  earned: boolean;
}

export interface Gamification {
  badges: BadgeDef[];
  competences: CompetenceBadge[];
  streak: Streak;
}

/** "Module 2 — Formuler des demandes" / "2. Formuler…" → "Formuler des demandes". */
function competenceName(moduleTitle: string): string {
  return moduleTitle.replace(/^\s*(module\s*)?\d+\s*[—–\-.:)]\s*/i, "").trim() || moduleTitle;
}

export async function computeGamification(dbUserId: string, tenantFormationIds: string[]): Promise<Gamification> {
  const supabase = createServiceRoleSupabaseClient();

  const [{ data: progressRows }, { data: quizRows }, { data: formationModules }, { data: enrollments }] = await Promise.all([
    supabase.from("progress").select("lecon_id, status, updated_at, completed_at").eq("user_id", dbUserId),
    supabase.from("quiz_results").select("passed, attempted_at").eq("user_id", dbUserId),
    tenantFormationIds.length > 0
      ? supabase.from("modules").select("id, title, order_index, formation_id, formations(title), lecons(id)").in("formation_id", tenantFormationIds)
      : Promise.resolve({ data: [] as { id: string; title: string; order_index: number; formation_id: string; formations: { title: string } | null; lecons: { id: string }[] }[] }),
    supabase.from("user_enrollments").select("formation_id").eq("user_id", dbUserId),
  ]);

  const completedLeconIds = new Set(
    (progressRows ?? []).filter((p) => p.status === "completed").map((p) => p.lecon_id)
  );
  const quizPassedCount = (quizRows ?? []).filter((q) => q.passed).length;
  const activityDates = [
    ...(progressRows ?? []).flatMap((p) => [p.updated_at, p.completed_at]),
    ...(quizRows ?? []).map((q) => q.attempted_at),
  ];
  const streak = computeStreak(activityDates);

  const lessonsByFormation: Record<string, string[]> = {};
  (formationModules ?? []).forEach((m) => {
    const ids = ((m.lecons as { id: string }[]) ?? []).map((l) => l.id);
    lessonsByFormation[m.formation_id] = [...(lessonsByFormation[m.formation_id] ?? []), ...ids];
  });
  const hasCompletedFormation = Object.values(lessonsByFormation).some(
    (ids) => ids.length > 0 && ids.every((id) => completedLeconIds.has(id))
  );

  const badges: BadgeDef[] = [
    {
      id: "premier-pas",
      label: "Premier pas",
      description: "Terminer votre toute première leçon.",
      icon: Flag,
      earned: completedLeconIds.size >= 1,
    },
    {
      id: "regulier",
      label: "Apprenant régulier",
      description: "Être actif sur au moins 3 jours différents.",
      icon: CalendarCheck,
      earned: streak.activeDays >= 3,
    },
    {
      id: "serie-3",
      label: "En rythme",
      description: "Apprendre 3 jours d'affilée.",
      icon: Flame,
      earned: streak.best >= 3,
    },
    {
      id: "quiz",
      label: "Quiz réussi",
      description: "Valider au moins un quiz.",
      icon: Target,
      earned: quizPassedCount >= 1,
    },
    {
      id: "formation",
      label: "Formation terminée",
      description: "Terminer 100% des leçons d'une formation.",
      icon: Trophy,
      earned: hasCompletedFormation,
    },
    {
      id: "assidu",
      label: "Apprenant assidu",
      description: "Terminer au moins 10 leçons au total.",
      icon: Lightbulb,
      earned: completedLeconIds.size >= 10,
    },
    {
      id: "serie-7",
      label: "Une semaine sans faillir",
      description: "Apprendre 7 jours d'affilée.",
      icon: Zap,
      earned: streak.best >= 7,
    },
    {
      id: "serie-30",
      label: "Inarrêtable",
      description: "Apprendre 30 jours d'affilée.",
      icon: Crown,
      earned: streak.best >= 30,
    },
  ];

  // Compétences : modules des formations suivies par l'apprenant.
  const enrolledIds = new Set((enrollments ?? []).map((e) => e.formation_id));
  const competences: CompetenceBadge[] = (formationModules ?? [])
    .filter((m) => enrolledIds.has(m.formation_id))
    .sort((a, b) => a.formation_id.localeCompare(b.formation_id) || a.order_index - b.order_index)
    .map((m) => {
      const ids = ((m.lecons as { id: string }[]) ?? []).map((l) => l.id);
      const completed = ids.filter((id) => completedLeconIds.has(id)).length;
      return {
        id: `competence:${m.id}`,
        label: competenceName(m.title),
        formationTitle: (m.formations as unknown as { title: string } | null)?.title ?? "",
        completed,
        total: ids.length,
        earned: ids.length > 0 && completed === ids.length,
      };
    });

  return { badges, competences, streak };
}

/**
 * Enregistre les badges (généraux et de compétence) nouvellement obtenus et
 * les renvoie, pour afficher un toast de déblocage une seule fois.
 */
export async function detectAndPersistNewBadges(dbUserId: string, badges: { id: string; label: string; earned: boolean }[]) {
  const supabase = createServiceRoleSupabaseClient();
  const earnedBadges = badges.filter((b) => b.earned);

  const { data: existingBadgeRows } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", dbUserId);
  const alreadySeen = new Set((existingBadgeRows ?? []).map((r) => r.badge_id));
  const toInsert = earnedBadges.filter((b) => !alreadySeen.has(b.id));

  if (toInsert.length === 0) return [];

  const { error } = await supabase
    .from("user_badges")
    .insert(toInsert.map((b) => ({ user_id: dbUserId, badge_id: b.id })));

  if (error) return [];
  return toInsert.map((b) => ({ id: b.id, label: b.label }));
}
