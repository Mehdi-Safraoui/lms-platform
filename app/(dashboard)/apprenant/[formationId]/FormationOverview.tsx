import Link from "next/link";
import { ArrowRight, Award, Clock, Flag, MapPin, TrainFront } from "lucide-react";
import { formatMinutes } from "@/lib/lessonDuration";
import type { LessonLine } from "@/lib/lessonLine";
import { certificateUrl, formatCertificateDate, linkedinAddToProfileUrl, type Certificate } from "@/lib/certificates";
import CertificateActions from "@/components/certificates/CertificateActions";
import EnrollButton from "./EnrollButton";
import ModulePlan from "./ModulePlan";
import styles from "./formation.module.css";

const NIVEAU_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export interface FormationVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  url: string;
}

/** Libellé court d'un module pour le plan de ligne horizontal. */
function shortLabel(title: string): string {
  return title.length <= 22 ? title : `${title.slice(0, 21).replace(/\s+\S*$/, "")}…`;
}

/**
 * Page formation de l'apprenant, en ligne de métro : plan de ligne
 * horizontal (une station par module), plan détaillé dépliable, terminus
 * certificat et barre « Reprendre ».
 */
export default function FormationOverview({
  formationId,
  formation,
  line,
  isEnrolled,
  lockedIds,
  certificate,
}: {
  formationId: string;
  formation: { title: string; description: string | null; niveau: string | null; tenant_id: string | null; videos: unknown };
  line: LessonLine;
  isEnrolled: boolean;
  lockedIds: string[];
  certificate: Certificate | null;
}) {
  const totalMinutes = line.modules.reduce((sum, m) => sum + m.stations.reduce((s, st) => s + (st.minutes ?? 0), 0), 0);
  const progressPct = line.total > 0 ? Math.round((line.completed / line.total) * 100) : 0;
  const lineName = formation.title.replace(/^formation\s+/i, "");
  const resumeStation = isEnrolled ? line.current : null;
  const currentModuleNumber = line.currentModule?.number ?? null;

  return (
    <div className={styles.page}>
      <p className={styles.linePill}>
        <span>Ligne {lineName}</span>
        <span>
          {line.modules.length} module{line.modules.length > 1 ? "s" : ""} · {line.total} station{line.total > 1 ? "s" : ""}
          {totalMinutes ? ` · ${formatMinutes(totalMinutes)}` : ""}
          {formation.niveau ? ` · ${NIVEAU_LABEL[formation.niveau] ?? formation.niveau}` : ""}
        </span>
        {formation.tenant_id && <span>Créée par votre entreprise</span>}
      </p>

      <header className={styles.plaque}>
        <h1 className={styles.title}>{formation.title}</h1>
        {formation.description && <p className={styles.desc}>{formation.description}</p>}
      </header>

      {/* Plan de ligne horizontal : une station par module, jusqu'au terminus. */}
      <ol className={styles.lineMap} aria-label="Plan de la ligne" style={{ "--stops": line.modules.length + 1 } as React.CSSProperties}>
        {line.modules.map((mod) => {
          const isCurrent = isEnrolled && mod.number === currentModuleNumber;
          const marker = isCurrent ? "current" : mod.status === "done" ? "done" : "upcoming";
          return (
            <li key={mod.id} className={styles.stop} data-marker={marker}>
              <span className={styles.stopLabel} title={mod.title}>{shortLabel(mod.title)}</span>
              <span className={styles.stopMarker} aria-hidden="true">{mod.number}</span>
              {isCurrent ? <span className={styles.here}>Vous êtes ici</span> : <span className={styles.stopNumber}>{mod.number}</span>}
            </li>
          );
        })}
        <li className={styles.stop} data-marker="terminus">
          <span className={styles.stopLabel}>Certificat</span>
          <span className={styles.stopMarker} aria-hidden="true">
            <Flag size={18} strokeWidth={2.4} fill="currentColor" />
          </span>
        </li>
      </ol>

      <div className={styles.columns}>
        <section className={styles.planCol} aria-labelledby="plan-title">
          <h2 id="plan-title" className={styles.sectionTitle}>Plan de la ligne</h2>
          <ModulePlan
            formationId={formationId}
            modules={line.modules}
            initiallyOpen={currentModuleNumber ?? 1}
            lockedIds={lockedIds}
            linkable={isEnrolled}
          />

          {((formation.videos as FormationVideo[] | null) ?? []).map((video) => (
            <div key={video.videoId} className={styles.videoWrap}>
              <iframe
                className={styles.videoFrame}
                src={`https://www.youtube.com/embed/${video.videoId}`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ))}
        </section>

        <aside className={styles.terminus} aria-labelledby="terminus-title">
          <div className={styles.terminusHead}>
            <Flag size={44} strokeWidth={1.8} aria-hidden="true" />
            <h2 id="terminus-title" className={styles.terminusTitle}>Terminus : certificat</h2>
          </div>

          {certificate ? (
            <>
              <p className={styles.terminusRow}>
                <Award size={26} strokeWidth={1.9} aria-hidden="true" />
                <span>
                  Certificat obtenu le <strong>{formatCertificateDate(certificate.issued_at)}</strong>
                </span>
              </p>
              <CertificateActions
                pdfHref={`/api/certificates/${certificate.id}/pdf`}
                linkedinHref={linkedinAddToProfileUrl(certificate)}
                shareUrl={certificateUrl(certificate.id)}
              />
            </>
          ) : (
            <>
              {isEnrolled && (
                <p className={styles.terminusRow}>
                  <Clock size={26} strokeWidth={1.9} aria-hidden="true" />
                  <span>
                    {line.minutesToCertificate > 0 ? (
                      <>Encore <strong>{formatMinutes(line.minutesToCertificate)}</strong> de parcours</>
                    ) : (
                      <>Seuil atteint : votre certificat se prépare</>
                    )}
                  </span>
                </p>
              )}
              <p className={styles.terminusRow}>
                <MapPin size={26} strokeWidth={1.9} aria-hidden="true" />
                <span>
                  <strong>{line.completed} station{line.completed > 1 ? "s" : ""}</strong> sur {line.total}
                </span>
              </p>
              <div className={styles.gaugeRow}>
                <div className={styles.gauge} role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Progression dans la formation">
                  <span className={styles.gaugeFill} style={{ width: `${progressPct}%` }} />
                </div>
                <span className={styles.gaugePct}>{progressPct} %</span>
              </div>
            </>
          )}
          <p className={styles.terminusNote}>
            <Award size={26} strokeWidth={1.9} aria-hidden="true" />
            Certificat délivré à {line.thresholdPct} % de complétion, quiz réussis compris.
          </p>
        </aside>
      </div>

      <div className={styles.nextBar}>
        <TrainFront size={40} strokeWidth={1.8} className={styles.nextIcon} aria-hidden="true" />
        <span className={styles.nextRule} aria-hidden="true" />
        {!isEnrolled ? (
          <>
            <p className={styles.nextText}>Montez à bord pour suivre cette formation et votre progression.</p>
            <EnrollButton formationId={formationId} />
          </>
        ) : resumeStation ? (
          <>
            <p className={styles.nextText}>
              {line.completed > 0 ? "Reprendre" : "Départ"} : {resumeStation.code} · {resumeStation.title}
              {resumeStation.minutes ? <span className={styles.nextTime}> · {formatMinutes(resumeStation.minutes)}</span> : null}
            </p>
            <Link href={`/apprenant/${formationId}/${resumeStation.id}`} className={styles.continueBtn}>
              {line.completed > 0 ? "Continuer" : "Commencer"}
              <ArrowRight size={22} strokeWidth={2.4} aria-hidden="true" />
            </Link>
          </>
        ) : (
          <p className={styles.nextText}>Ligne terminée : toutes les stations sont franchies.</p>
        )}
      </div>
    </div>
  );
}
