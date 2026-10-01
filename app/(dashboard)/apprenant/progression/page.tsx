import Link from "next/link";
import { Award, ChevronRight } from "lucide-react";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";
import { computeGamification } from "@/lib/badges";
import { getOrIssueCertificate, formatCertificateDate } from "@/lib/certificates";
import styles from "./progression.module.css";

const POINTS_PER_LEVEL = 500;

export default async function ProgressionPage() {
  const dbUser = await getCurrentUser();
  const supabase = createServiceRoleSupabaseClient();

  // Lectures indépendantes en parallèle (une seule attente au lieu de six).
  const [
    { data: tenantEnrollments },
    { data: userEnrollments },
    { count: quizPassedCount },
    { data: progressRows },
  ] = await Promise.all([
    dbUser?.tenant_id
      ? supabase.from("tenant_formations").select("formation_id").eq("tenant_id", dbUser.tenant_id)
      : { data: [] as { formation_id: string }[] },
    dbUser
      ? supabase.from("user_enrollments").select("formation_id").eq("user_id", dbUser.id)
      : { data: [] as { formation_id: string }[] },
    dbUser
      ? supabase
          .from("quiz_results")
          .select("*", { count: "exact", head: true })
          .eq("user_id", dbUser.id)
          .eq("passed", true)
      : { count: 0 },
    dbUser
      ? supabase.from("progress").select("lecon_id, status").eq("user_id", dbUser.id)
      : { data: [] as { lecon_id: string; status: string }[] },
  ]);
  const tenantFormationIds = (tenantEnrollments ?? []).map((e) => e.formation_id);
  const enrolledFormationIds = (userEnrollments ?? []).map((e) => e.formation_id);

  // Formations suivies avec leurs leçons, badges et certificats (délivrance au
  // passage si un seuil vient d'être atteint), en parallèle.
  const [{ data: enrolledFormations }, gamification, certificateStatuses] = await Promise.all([
    enrolledFormationIds.length > 0
      ? supabase
          .from("formations")
          .select("id, title, modules(lecons(id))")
          .in("id", enrolledFormationIds)
      : { data: [] as { id: string; title: string; modules: { lecons: { id: string }[] }[] }[] },
    dbUser ? computeGamification(dbUser.id, tenantFormationIds) : null,
    dbUser
      ? Promise.all(
          enrolledFormationIds.map((id) => getOrIssueCertificate(supabase, dbUser.id, id))
        )
      : [],
  ]);

  const lessonsByFormation: Record<string, string[]> = {};
  for (const f of enrolledFormations ?? []) {
    lessonsByFormation[f.id] = ((f.modules ?? []) as { lecons: { id: string }[] }[]).flatMap((m) =>
      (m.lecons ?? []).map((l) => l.id)
    );
  }
  const allLeconIds = new Set(Object.values(lessonsByFormation).flat());

  const completedLeconIds = new Set(
    (progressRows ?? [])
      .filter((p) => p.status === "completed" && allLeconIds.has(p.lecon_id))
      .map((p) => p.lecon_id)
  );

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

  const badges = gamification?.badges ?? [];
  const competences = gamification?.competences ?? [];
  const streak = gamification?.streak ?? { current: 0, best: 0, activeToday: false, activeDays: 0 };
  const earnedCount =
    badges.filter((b) => b.earned).length + competences.filter((c) => c.earned).length;
  const competencesByFormation = competences.reduce<Record<string, typeof competences>>(
    (acc, c) => {
      (acc[c.formationTitle] ??= []).push(c);
      return acc;
    },
    {}
  );

  const certificates = certificateStatuses
    .map((status) => status.certificate)
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Ma progression</h1>
      <p className={styles.subtitle}>Vos stations franchies, vos certificats et vos badges.</p>

      {/* Relevé de parcours : une phrase sur une plaque, pas un mur de chiffres. */}
      <section className={styles.summary} aria-label="Résumé de votre parcours">
        <p className={styles.summaryText}>
          {allLeconIds.size === 0 ? (
            <>Votre parcours commence dès votre première station.</>
          ) : (
            <>
              Vous avez franchi{" "}
              <strong>
                {completedLeconIds.size} station{completedLeconIds.size > 1 ? "s" : ""}
              </strong>{" "}
              sur {allLeconIds.size}
              {quizPassedCount ? (
                <>
                  , réussi <strong>{quizPassedCount} quiz</strong>
                </>
              ) : null}
              {streak.current > 0 ? (
                <>
                  {" "}
                  et appris{" "}
                  <strong>
                    {streak.current} jour{streak.current > 1 ? "s" : ""} de suite
                  </strong>
                </>
              ) : null}
              .
            </>
          )}
        </p>
        <div className={styles.level}>
          <span className={styles.levelLabel}>
            Niveau {niveau} · {totalPoints} points
          </span>
          <div
            className={styles.levelGauge}
            role="progressbar"
            aria-valuenow={totalPoints % POINTS_PER_LEVEL}
            aria-valuemin={0}
            aria-valuemax={POINTS_PER_LEVEL}
            aria-label={`Points vers le niveau ${niveau + 1}`}
          >
            <span
              style={{ width: `${((totalPoints % POINTS_PER_LEVEL) / POINTS_PER_LEVEL) * 100}%` }}
            />
          </div>
          <span className={styles.levelHint}>
            {pointsToNextLevel} points avant le niveau {niveau + 1} · {earnedCount} badge
            {earnedCount > 1 ? "s" : ""} sur {badges.length + competences.length}
            {streak.best > 0 ? ` · record ${streak.best} jour${streak.best > 1 ? "s" : ""}` : ""}
          </span>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Progression par formation</h2>
        {formationProgress.length === 0 ? (
          <p className={styles.empty}>
            Vous ne suivez encore aucune ligne.{" "}
            <Link href="/apprenant" className={styles.emptyLink}>
              Choisir une formation
            </Link>
          </p>
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
                <span className={styles.formationCaption}>
                  {f.completed}/{f.total} leçons terminées
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {certificates.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Mes certificats</h2>
          <div className={styles.formationList}>
            {certificates.map((c) => (
              <Link key={c.id} href={`/certificats/${c.id}`} className={styles.certificateRow}>
                <Award size={18} className={styles.certificateIcon} />
                <span className={styles.certificateBody}>
                  <span className={styles.formationTitle}>{c.formation_title}</span>
                  <span className={styles.formationCaption}>
                    Délivré le {formatCertificateDate(c.issued_at)}
                  </span>
                </span>
                <ChevronRight size={16} className={styles.certificateChevron} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {Object.keys(competencesByFormation).length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Compétences</h2>
          <p className={styles.sectionHint}>Un badge par module terminé, quiz réussi compris.</p>
          {Object.entries(competencesByFormation).map(([formationTitle, list]) => (
            <div key={formationTitle} className={styles.competenceGroup}>
              <span className={styles.competenceFormation}>{formationTitle}</span>
              <div className={styles.badgesGrid}>
                {list.map((c) => (
                  <div
                    key={c.id}
                    className={`${styles.badgeCard} ${c.earned ? styles.badgeCardEarned : ""}`}
                  >
                    <span
                      className={`${styles.badgeIcon} ${c.earned ? styles.badgeIconEarned : ""}`}
                    >
                      <Award size={20} />
                    </span>
                    <div className={styles.badgeCardBody}>
                      <span className={styles.badgeCardLabel}>{c.label}</span>
                      <span className={styles.badgeCardDesc}>
                        {c.completed}/{c.total} leçons
                      </span>
                    </div>
                    <span
                      className={`${styles.badgeStatus} ${c.earned ? styles.badgeStatusEarned : ""}`}
                    >
                      {c.earned
                        ? "Acquise"
                        : `${c.total ? Math.round((c.completed / c.total) * 100) : 0} %`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {badges.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Badges</h2>
          <div className={styles.badgesGrid}>
            {badges.map((b) => (
              <div
                key={b.id}
                className={`${styles.badgeCard} ${b.earned ? styles.badgeCardEarned : ""}`}
              >
                <span className={`${styles.badgeIcon} ${b.earned ? styles.badgeIconEarned : ""}`}>
                  <b.icon size={20} />
                </span>
                <div className={styles.badgeCardBody}>
                  <span className={styles.badgeCardLabel}>{b.label}</span>
                  <span className={styles.badgeCardDesc}>{b.description}</span>
                </div>
                <span
                  className={`${styles.badgeStatus} ${b.earned ? styles.badgeStatusEarned : ""}`}
                >
                  {b.earned ? "Débloqué" : "Verrouillé"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
