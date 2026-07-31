import Link from "next/link";
import { BookOpen, Star, CheckCircle, Flag, Flame, Target, Trophy, Lightbulb } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import BadgeUnlockToasts from "./BadgeUnlockToasts";
import styles from "./apprenant.module.css";

const POINTS_PER_LEVEL = 500;

const NIVEAU_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export default async function ApprenantPage() {
  const { userId: clerkUserId } = await auth();
  const supabase = createServiceRoleSupabaseClient();

  const { data: rawUser } = clerkUserId
    ? await supabase.from("users").select("id, total_points, tenant_id").eq("clerk_user_id", clerkUserId).single()
    : { data: null };
  const dbUser = rawUser as { id: string; total_points: number; tenant_id: string | null } | null;

  // Formations activées par le tenant de l'apprenant
  const tenantEnrollments = dbUser?.tenant_id
    ? (await supabase.from("tenant_formations").select("formation_id").eq("tenant_id", dbUser.tenant_id)).data ?? []
    : [];
  const tenantFormationIds = tenantEnrollments.map((e) => e.formation_id);

  const [{ data: formations }, { data: userEnrollments }] = await Promise.all([
    tenantFormationIds.length > 0
      ? supabase
          .from("formations")
          .select("id, title, description, niveau")
          .eq("is_published", true)
          .in("id", tenantFormationIds)
          .order("created_at", { ascending: false })
      : { data: [] as { id: string; title: string; description: string | null; niveau: string | null }[] },
    dbUser
      ? supabase.from("user_tenant_formations").select("formation_id").eq("user_id", dbUser.id)
      : { data: null },
  ]);

  const totalPoints = dbUser?.total_points ?? 0;
  const niveau = Math.floor(totalPoints / POINTS_PER_LEVEL) + 1;
  const enrolledIds = new Set((userEnrollments ?? []).map((e) => e.formation_id));

  // ── Badges : calculés en direct depuis la progression réelle ──
  const [{ data: progressRows }, { count: quizPassedCount }, { data: formationModules }] = await Promise.all([
    dbUser
      ? supabase.from("progress").select("lecon_id, status, updated_at").eq("user_id", dbUser.id)
      : { data: [] as { lecon_id: string; status: string; updated_at: string }[] },
    dbUser
      ? supabase.from("quiz_results").select("*", { count: "exact", head: true }).eq("user_id", dbUser.id).eq("passed", true)
      : { count: 0 },
    tenantFormationIds.length > 0
      ? supabase.from("modules").select("id, formation_id, lecons(id)").in("formation_id", tenantFormationIds)
      : { data: [] as { id: string; formation_id: string; lecons: { id: string }[] }[] },
  ]);

  const completedLeconIds = new Set(
    (progressRows ?? []).filter((p) => p.status === "completed").map((p) => p.lecon_id)
  );
  const activeDays = new Set((progressRows ?? []).map((p) => new Date(p.updated_at).toDateString()));

  const lessonsByFormation: Record<string, string[]> = {};
  (formationModules ?? []).forEach((m) => {
    const ids = (m.lecons as { id: string }[] ?? []).map((l) => l.id);
    lessonsByFormation[m.formation_id] = [...(lessonsByFormation[m.formation_id] ?? []), ...ids];
  });
  const hasCompletedFormation = Object.values(lessonsByFormation).some(
    (ids) => ids.length > 0 && ids.every((id) => completedLeconIds.has(id))
  );

  const badges = [
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

  // ── Détection des nouveaux badges débloqués (pour la notif toast) ──
  let newlyUnlocked: { id: string; label: string }[] = [];
  if (dbUser) {
    const earnedBadges = badges.filter((b) => b.earned);
    const { data: existingBadgeRows } = await supabase
      .from("user_badges")
      .select("badge_id")
      .eq("user_id", dbUser.id);
    const alreadySeen = new Set((existingBadgeRows ?? []).map((r) => r.badge_id));
    const toInsert = earnedBadges.filter((b) => !alreadySeen.has(b.id));

    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("user_badges")
        .insert(toInsert.map((b) => ({ user_id: dbUser.id, badge_id: b.id })));
      if (!insertError) {
        newlyUnlocked = toInsert.map((b) => ({ id: b.id, label: b.label }));
      }
    }
  }

  return (
    <div className={styles.page}>
      <BadgeUnlockToasts newlyUnlocked={newlyUnlocked} />
      <div className={styles.eyebrow}>
        <span className={styles.dot} />
        Espace apprenant
      </div>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Mes formations</h1>
        <div className={styles.pointsBadge}>
          <Star size={13} />
          <span>{totalPoints} points</span>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.main}>
          {!formations?.length ? (
            <p className={styles.empty}>Aucune formation disponible pour le moment.</p>
          ) : (
            <div className={styles.grid}>
              {formations.map((f) => {
                const enrolled = enrolledIds.has(f.id);
                return (
                  <Link key={f.id} href={`/apprenant/${f.id}`} className={`${styles.card} ${enrolled ? styles.cardEnrolled : ""}`}>
                    <div className={styles.cardIcon}>
                      <BookOpen size={20} />
                    </div>
                    <div className={styles.cardBody}>
                      <h2 className={styles.cardTitle}>{f.title}</h2>
                      {f.description && <p className={styles.cardDesc}>{f.description}</p>}
                      <div className={styles.cardFooter}>
                        {f.niveau && (
                          <span className={styles.badge}>{NIVEAU_LABEL[f.niveau] ?? f.niveau}</span>
                        )}
                        {enrolled && (
                          <span className={styles.enrolledBadge}>
                            <CheckCircle size={11} />
                            Inscrit
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.badgesCard}>
            <span className={styles.badgesCardTitle}>Progression & badges</span>
            <div className={styles.badgesLevelRow}>
              <span className={styles.badgesLevelValue}>Niveau {niveau}</span>
              <span className={styles.badgesLevelCaption}>{totalPoints} points</span>
            </div>
            <div className={styles.badgesRow}>
              {badges.map((b) => (
                <div key={b.id} className={styles.badgeItem}>
                  <span className={`${styles.badgeIcon} ${b.earned ? styles.badgeIconEarned : ""}`}>
                    <b.icon size={17} />
                    <span className={styles.badgeTooltip}>
                      <strong>{b.label}</strong>
                      <span>{b.description}</span>
                      <em>{b.earned ? "Débloqué ✓" : "Verrouillé"}</em>
                    </span>
                  </span>
                  <span className={`${styles.badgeLabel} ${b.earned ? styles.badgeLabelEarned : ""}`}>
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
