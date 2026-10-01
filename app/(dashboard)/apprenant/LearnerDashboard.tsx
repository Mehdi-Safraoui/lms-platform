import Link from "next/link";
import { ArrowRight, CalendarCheck, Lock } from "lucide-react";
import type { BadgeDef } from "@/lib/badges";
import type { Streak } from "@/lib/streaks";
import type { LessonLine } from "@/lib/lessonLine";
import { formatMinutes } from "@/lib/lessonDuration";
import { formationCover } from "@/lib/formationAccent";
import styles from "./dashboard.module.css";

export interface DashboardLine {
  formationId: string;
  thumbnailUrl: string | null;
  line: LessonLine;
}

export interface NewLine {
  formationId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  moduleCount: number;
  minutes: number | null;
}

function Cover({ formationId, thumbnailUrl }: { formationId: string; thumbnailUrl: string | null }) {
  if (thumbnailUrl) {
    // Couverture choisie par le Formateur (Supabase Storage) : domaine non configuré pour next/image.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={thumbnailUrl} alt="" className={styles.cover} />;
  }
  const cover = formationCover(formationId);
  return (
    <div className={styles.cover} style={{ background: cover.gradient }} aria-hidden="true">
      <cover.icon size={34} color="#fff" strokeWidth={1.5} />
    </div>
  );
}

/** Formation en cours : couverture, avancement et une ligne discrète (une station par module). */
function CourseCard({ formationId, thumbnailUrl, line }: DashboardLine) {
  const done = line.total > 0 && line.completed >= line.total;
  const pct = line.total > 0 ? Math.round((line.completed / line.total) * 100) : 0;
  const resumeHref = line.current ? `/apprenant/${formationId}/${line.current.id}` : `/apprenant/${formationId}`;
  return (
    <li className={styles.card}>
      <Link href={`/apprenant/${formationId}`} className={styles.coverLink} tabIndex={-1} aria-hidden="true">
        <Cover formationId={formationId} thumbnailUrl={thumbnailUrl} />
      </Link>
      <div className={styles.cardBody}>
        <Link href={`/apprenant/${formationId}`} className={styles.cardTitle}>
          {line.formationTitle}
        </Link>
        <span className={styles.cardMeta}>
          {done
            ? `Terminée · ${line.total} leçons`
            : `Leçon ${line.current ? line.position : line.total} sur ${line.total}${line.minutesToCertificate > 0 ? ` · encore ${formatMinutes(line.minutesToCertificate)}` : " · certificat atteint"}`}
        </span>
        <ol className={styles.track} aria-label={`${line.completed} leçons terminées sur ${line.total}`}>
          {line.modules.map((m) => (
            <li key={m.id} className={styles.trackStop} data-status={m.status} title={`${m.number} · ${m.title}`} />
          ))}
        </ol>
        <div className={styles.cardFoot}>
          <span className={styles.cardPct}>{pct} %</span>
          <Link href={resumeHref} className={styles.resumeBtn}>
            {line.completed > 0 ? "Reprendre" : "Commencer"}
            <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </li>
  );
}

/**
 * Tableau de bord de l'apprenant : ses formations en cours, ses badges et
 * les formations proposées par son entreprise.
 */
export default function LearnerDashboard({
  firstName,
  streak,
  level,
  points,
  lines,
  newLines,
  badges,
}: {
  firstName: string | null;
  streak: Streak | null;
  level: number;
  points: number;
  lines: DashboardLine[];
  newLines: NewLine[];
  badges: BadgeDef[];
}) {
  const days = streak?.current ?? 0;
  const earned = badges.filter((b) => b.earned).length;
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{firstName ? `Bonjour ${firstName}` : "Bonjour"}</h1>
          <p className={styles.subtitle}>
            {lines.length > 0 ? "Reprenez là où vous vous êtes arrêté." : "Choisissez une formation pour commencer."}
          </p>
        </div>
        <div className={styles.streak}>
          <span className={styles.streakIcon} aria-hidden="true">
            <CalendarCheck size={20} strokeWidth={2} />
          </span>
          <p>
            <strong>{days > 0 ? `${days} jour${days > 1 ? "s" : ""} de suite` : "Série à lancer"}</strong>
            <span>
              Niveau {level} · {points} points
              {days > 0 && streak && !streak.activeToday ? " · à prolonger aujourd'hui" : ""}
            </span>
          </p>
        </div>
      </header>

      {lines.length > 0 && (
        <section aria-labelledby="lines-title">
          <h2 id="lines-title" className={styles.sectionTitle}>Formations en cours</h2>
          <ol className={styles.grid}>
            {lines.map((l) => (
              <CourseCard key={l.formationId} {...l} />
            ))}
          </ol>
        </section>
      )}

      {newLines.length > 0 && (
        <section aria-labelledby="new-title">
          <h2 id="new-title" className={styles.sectionTitle}>À découvrir</h2>
          <ul className={styles.grid}>
            {newLines.map((n) => (
              <li key={n.formationId} className={styles.card}>
                <Link href={`/apprenant/${n.formationId}`} className={styles.coverLink} tabIndex={-1} aria-hidden="true">
                  <Cover formationId={n.formationId} thumbnailUrl={n.thumbnailUrl} />
                </Link>
                <div className={styles.cardBody}>
                  <Link href={`/apprenant/${n.formationId}`} className={styles.cardTitle}>{n.title}</Link>
                  <span className={styles.cardMeta}>
                    {n.moduleCount} module{n.moduleCount > 1 ? "s" : ""}
                    {n.minutes ? ` · ${formatMinutes(n.minutes)}` : ""}
                  </span>
                  {n.description && <p className={styles.cardDesc}>{n.description}</p>}
                  <div className={styles.cardFoot}>
                    <span />
                    <Link href={`/apprenant/${n.formationId}`} className={styles.discoverBtn}>
                      Découvrir
                      <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {badges.length > 0 && (
        <section aria-labelledby="badges-title">
          <div className={styles.sectionHead}>
            <h2 id="badges-title" className={styles.sectionTitle}>Badges</h2>
            <span className={styles.sectionCount}>{earned} sur {badges.length}</span>
          </div>
          <ul className={styles.badges}>
            {badges.map((b) => (
              <li key={b.id} className={styles.badge} data-earned={b.earned || undefined} title={b.description}>
                <span className={styles.medallion} aria-hidden="true">
                  {b.earned ? <b.icon size={24} strokeWidth={1.9} /> : <Lock size={18} strokeWidth={2} />}
                </span>
                <span className={styles.badgeLabel}>{b.label}</span>
                <span className="srOnly">{b.earned ? ", débloqué" : `, à débloquer : ${b.description}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lines.length === 0 && newLines.length === 0 && (
        <p className={styles.empty}>Aucune formation n&apos;est encore proposée par votre entreprise. Votre administrateur peut en activer depuis le catalogue Ahead.</p>
      )}
    </div>
  );
}
