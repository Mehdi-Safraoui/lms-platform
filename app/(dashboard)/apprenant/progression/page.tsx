import { auth } from "@clerk/nextjs/server";
import { Star, TrendingUp, BookOpen, CheckCircle2 } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { computeBadges } from "@/lib/badges";
import styles from "./progression.module.css";

const POINTS_PER_LEVEL = 500;

export default async function ProgressionPage() {
  const { userId: clerkUserId } = await auth();
  const supabase = createServiceRoleSupabaseClient();

  const { data: rawUser } = clerkUserId
    ? await supabase.from("users").select("id, total_points, tenant_id").eq("clerk_user_id", clerkUserId).single()
    : { data: null };
  const dbUser = rawUser as { id: string; total_points: number; tenant_id: string | null } | null;

  const tenantEnrollments = dbUser?.tenant_id
    ? (await supabase.from("tenant_formations").select("formation_id").eq("tenant_id", dbUser.tenant_id)).data ?? []
    : [];
  const tenantFormationIds = tenantEnrollments.map((e) => e.formation_id);

  const [{ data: userEnrollments }, { count: quizPassedCount }] = await Promise.all([
    dbUser
      ? supabase.from("user_enrollments").select("formation_id").eq("user_id", dbUser.id)
      : { data: [] as { formation_id: string }[] },
    dbUser
      ? supabase.from("quiz_results").select("*", { count: "exact", head: true }).eq("user_id", dbUser.id).eq("passed", true)
      : { count: 0 },
  ]);

  const enrolledFormationIds = (userEnrollments ?? []).map((e) => e.formation_id);

  const { data: enrolledFormations } = enrolledFormationIds.length > 0
    ? await supabase.from("formations").select("id, title").in("id", enrolledFormationIds)
    : { data: [] as { id: string; title: string }[] };

  const { data: modules } = enrolledFormationIds.length > 0
    ? await supabase.from("modules").select("id, formation_id, lecons(id)").in("formation_id", enrolledFormationIds)
    : { data: [] as { id: string; formation_id: string; lecons: { id: string }[] }[] };

  const lessonsByFormation: Record<string, string[]> = {};
  (modules ?? []).forEach((m) => {
    const ids = ((m.lecons as { id: string }[]) ?? []).map((l) => l.id);
    lessonsByFormation[m.formation_id] = [...(lessonsByFormation[m.formation_id] ?? []), ...ids];
  });
  const allLeconIds = Object.values(lessonsByFormation).flat();

  const { data: progressRows } = dbUser && allLeconIds.length > 0
    ? await supabase.from("progress").select("lecon_id, status").eq("user_id", dbUser.id).in("lecon_id", allLeconIds)
    : { data: [] as { lecon_id: string; status: string }[] };

  const completedLeconIds = new Set((progressRows ?? []).filter((p) => p.status === "completed").map((p) => p.lecon_id));

  const formationProgress = (enrolledFormations ?? []).map((f) => {
    const leconIds = lessonsByFormation[f.id] ?? [];
    const completed = leconIds.filter((id) => completedLeconIds.has(id)).length;
    const total = leconIds.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { id: f.id, title: f.title, completed, total, pct };
  });

  const totalPoints = dbUser?.total_points ?? 0;
  const niveau = Math.floor(totalPoints / POINTS_PER_LEVEL) + 1;
  const pointsToNextLevel = POINTS_PER_LEVEL - (totalPoints % POINTS_PER_LEVEL);
  const globalPct = allLeconIds.length > 0 ? Math.round((completedLeconIds.size / allLeconIds.length) * 100) : 0;

  const badges = dbUser ? await computeBadges(dbUser.id, tenantFormationIds) : [];
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className={styles.page}>
      <div className={styles.eyebrow}>
        <span className={styles.dot} />
        Ma progression
      </div>
      <h1 className={styles.title}>Suivi de votre parcours</h1>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconNavy}`}>
            <Star size={18} />
          </div>
          <div className={styles.statBody}>
            <span className={styles.statValue}>Niveau {niveau}</span>
            <span className={styles.statLabel}>{totalPoints} points · {pointsToNextLevel} avant le niveau {niveau + 1}</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconCoral}`}>
            <TrendingUp size={18} />
          </div>
          <div className={styles.statBody}>
            <span className={styles.statValue}>{globalPct}%</span>
            <span className={styles.statLabel}>Complétion globale</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconGreen}`}>
            <CheckCircle2 size={18} />
          </div>
          <div className={styles.statBody}>
            <span className={styles.statValue}>{quizPassedCount ?? 0}</span>
            <span className={styles.statLabel}>Quiz réussis</span>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconNavy}`}>
            <BookOpen size={18} />
          </div>
          <div className={styles.statBody}>
            <span className={styles.statValue}>{earnedCount}/{badges.length}</span>
            <span className={styles.statLabel}>Badges débloqués</span>
          </div>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Progression par formation</h2>
        {formationProgress.length === 0 ? (
          <p className={styles.empty}>Vous n&apos;êtes inscrit à aucune formation pour le moment.</p>
        ) : (
          <div className={styles.formationList}>
            {formationProgress.map((f) => (
              <div key={f.id} className={styles.formationRow}>
                <div className={styles.formationRowHead}>
                  <span className={styles.formationTitle}>{f.title}</span>
                  <span className={styles.formationPct}>{f.pct}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${f.pct}%` }} />
                </div>
                <span className={styles.formationCaption}>{f.completed}/{f.total} leçons terminées</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Badges</h2>
        <div className={styles.badgesGrid}>
          {badges.map((b) => (
            <div key={b.id} className={`${styles.badgeCard} ${b.earned ? styles.badgeCardEarned : ""}`}>
              <span className={`${styles.badgeIcon} ${b.earned ? styles.badgeIconEarned : ""}`}>
                <b.icon size={20} />
              </span>
              <div className={styles.badgeCardBody}>
                <span className={styles.badgeCardLabel}>{b.label}</span>
                <span className={styles.badgeCardDesc}>{b.description}</span>
              </div>
              <span className={`${styles.badgeStatus} ${b.earned ? styles.badgeStatusEarned : ""}`}>
                {b.earned ? "Débloqué" : "Verrouillé"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
