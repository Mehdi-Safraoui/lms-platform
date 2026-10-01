import Link from "next/link";
import { ArrowRight, CalendarCheck, Flag, Lock } from "lucide-react";
import type { BadgeDef } from "@/lib/badges";
import type { Streak } from "@/lib/streaks";
import type { LessonLine } from "@/lib/lessonLine";
import { formatMinutes } from "@/lib/lessonDuration";
import styles from "./dashboard.module.css";

export interface DashboardLine {
  formationId: string;
  line: LessonLine;
}

export interface NewLine {
  formationId: string;
  title: string;
  moduleCount: number;
  minutes: number | null;
}

/** Une ligne en cours : une station par module, du départ au certificat. */
function LineStrip({ formationId, line }: DashboardLine) {
  const done = line.total > 0 && line.completed >= line.total;
  const resumeHref = line.current ? `/apprenant/${formationId}/${line.current.id}` : `/apprenant/${formationId}`;
  const position = line.current ? line.position : line.total;
  return (
    <li className={styles.strip}>
      <div className={styles.stripInfo}>
        <Link href={`/apprenant/${formationId}`} className={styles.stripTitle}>
          {line.formationTitle}
        </Link>
        <span className={styles.stripMeta}>
          {done
            ? `${line.total} stations franchies`
            : `Station ${position} sur ${line.total}${line.minutesToCertificate > 0 ? ` · encore ${formatMinutes(line.minutesToCertificate)}` : " · certificat atteint"}`}
        </span>
      </div>
      <ol className={styles.stripLine} aria-label={`Progression : ${line.completed} stations sur ${line.total}`}>
        {line.modules.map((m) => (
          <li key={m.id} className={styles.stripStop} data-status={m.status} title={`${m.number} · ${m.title}`}>
            {m.status === "current" && <span className={styles.here}>Vous êtes ici</span>}
          </li>
        ))}
      </ol>
      <span className={styles.stripTerminus}>
        <Flag size={20} strokeWidth={2.2} fill="currentColor" aria-hidden="true" />
        Certificat
      </span>
      <Link href={resumeHref} className={styles.resumeBtn}>
        {line.completed > 0 ? "Reprendre" : "Commencer"}
        <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
      </Link>
    </li>
  );
}

/**
 * Tableau de bord de l'apprenant : ses lignes en cours, ses badges en
 * médaillons de station, et les formations proposées par son entreprise.
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
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{firstName ? `Bonjour ${firstName}` : "Bonjour"}</h1>
          <p className={styles.subtitle}>
            {lines.length > 0 ? "Votre prochaine station vous attend." : "Choisissez une ligne pour commencer votre parcours."}
          </p>
        </div>
        <div className={styles.streak}>
          <CalendarCheck size={40} strokeWidth={1.7} aria-hidden="true" />
          <span className={styles.streakRule} aria-hidden="true" />
          <p>
            <strong>
              {days > 0 ? `${days} jour${days > 1 ? "s" : ""} de suite` : "Série à lancer"}
            </strong>
            <span>
              Niveau {level} · {points} points
              {days > 0 && streak && !streak.activeToday ? " · à prolonger aujourd'hui" : ""}
            </span>
          </p>
        </div>
      </header>

      {lines.length > 0 && (
        <section aria-labelledby="lines-title">
          <h2 id="lines-title" className={styles.sectionTitle}>Vos lignes en cours</h2>
          <ol className={styles.strips}>
            {lines.map((l) => (
              <LineStrip key={l.formationId} {...l} />
            ))}
          </ol>
        </section>
      )}

      {badges.length > 0 && (
        <section aria-labelledby="badges-title">
          <h2 id="badges-title" className={styles.sectionTitle}>Badges</h2>
          <ul className={styles.badges}>
            {badges.map((b) => (
              <li key={b.id} className={styles.badge} data-earned={b.earned || undefined} title={b.description}>
                <span className={styles.medallion} aria-hidden="true">
                  {b.earned ? <b.icon size={34} strokeWidth={1.8} /> : <Lock size={26} strokeWidth={2} />}
                </span>
                <span className={styles.badgeLabel}>{b.label}</span>
                <span className="srOnly">{b.earned ? ", débloqué" : `, à débloquer : ${b.description}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {newLines.length > 0 && (
        <section aria-labelledby="new-title">
          <h2 id="new-title" className={styles.sectionTitle}>Nouvelles lignes</h2>
          <ul className={styles.newLines}>
            {newLines.map((n) => (
              <li key={n.formationId} className={styles.newLine}>
                <span className={styles.newMarker} aria-hidden="true" />
                <div className={styles.newInfo}>
                  <span className={styles.newTitle}>{n.title}</span>
                  <span className={styles.newMeta}>
                    {n.moduleCount} module{n.moduleCount > 1 ? "s" : ""}
                    {n.minutes ? ` · ${formatMinutes(n.minutes)}` : ""}
                  </span>
                </div>
                <Link href={`/apprenant/${n.formationId}`} className={styles.boardBtn}>
                  Monter à bord
                  <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
                </Link>
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
