import type { LucideIcon } from "lucide-react";
import { Flag, Flame, Target, Trophy, Lightbulb } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export interface BadgeDef {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  earned: boolean;
}

export async function computeBadges(dbUserId: string, tenantFormationIds: string[]): Promise<BadgeDef[]> {
  const supabase = createServiceRoleSupabaseClient();

  const [{ data: progressRows }, { count: quizPassedCount }, { data: formationModules }] = await Promise.all([
    supabase.from("progress").select("lecon_id, status, updated_at").eq("user_id", dbUserId),
    supabase.from("quiz_results").select("*", { count: "exact", head: true }).eq("user_id", dbUserId).eq("passed", true),
    tenantFormationIds.length > 0
      ? supabase.from("modules").select("id, formation_id, lecons(id)").in("formation_id", tenantFormationIds)
      : Promise.resolve({ data: [] as { id: string; formation_id: string; lecons: { id: string }[] }[] }),
  ]);

  const completedLeconIds = new Set(
    (progressRows ?? []).filter((p) => p.status === "completed").map((p) => p.lecon_id)
  );
  const activeDays = new Set((progressRows ?? []).map((p) => new Date(p.updated_at).toDateString()));

  const lessonsByFormation: Record<string, string[]> = {};
  (formationModules ?? []).forEach((m) => {
    const ids = ((m.lecons as { id: string }[]) ?? []).map((l) => l.id);
    lessonsByFormation[m.formation_id] = [...(lessonsByFormation[m.formation_id] ?? []), ...ids];
  });
  const hasCompletedFormation = Object.values(lessonsByFormation).some(
    (ids) => ids.length > 0 && ids.every((id) => completedLeconIds.has(id))
  );

  return [
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
      icon: Flame,
      earned: activeDays.size >= 3,
    },
    {
      id: "quiz",
      label: "Quiz réussi",
      description: "Valider au moins un quiz.",
      icon: Target,
      earned: (quizPassedCount ?? 0) >= 1,
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
  ];
}

export async function detectAndPersistNewBadges(dbUserId: string, badges: BadgeDef[]) {
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
