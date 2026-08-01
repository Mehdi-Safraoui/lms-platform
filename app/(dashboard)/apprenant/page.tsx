import Link from "next/link";
import { Star, CheckCircle } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { computeBadges, detectAndPersistNewBadges } from "@/lib/badges";
import { formationCover } from "@/lib/formationAccent";
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
          .select("id, title, description, niveau, thumbnail_url")
          .eq("is_published", true)
          .in("id", tenantFormationIds)
          .order("created_at", { ascending: false })
      : { data: [] as { id: string; title: string; description: string | null; niveau: string | null; thumbnail_url: string | null }[] },
    dbUser
      ? supabase.from("user_enrollments").select("formation_id").eq("user_id", dbUser.id)
      : { data: null },
  ]);

  const totalPoints = dbUser?.total_points ?? 0;
  const niveau = Math.floor(totalPoints / POINTS_PER_LEVEL) + 1;
  const enrolledIds = new Set((userEnrollments ?? []).map((e) => e.formation_id));

  // ── Badges : calculés en direct depuis la progression réelle ──
  const badges = dbUser ? await computeBadges(dbUser.id, tenantFormationIds) : [];
  const newlyUnlocked = dbUser ? await detectAndPersistNewBadges(dbUser.id, badges) : [];

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
                const cover = formationCover(f.id);
                return (
                  <Link key={f.id} href={`/apprenant/${f.id}`} className={`${styles.card} ${enrolled ? styles.cardEnrolled : ""}`}>
                    {f.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.thumbnail_url} alt="" className={styles.cardCover} />
                    ) : (
                      <div className={styles.cardCoverGenerated} style={{ background: cover.gradient }}>
                        <cover.icon size={34} color="#fff" strokeWidth={1.5} />
                      </div>
                    )}
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
