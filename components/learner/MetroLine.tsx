"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { LessonLine, StationStatus } from "@/lib/lessonLine";
import AheadLogo from "./AheadLogo";
import styles from "./metro.module.css";

const STATUS_LABEL: Record<StationStatus, string> = { done: "terminée", current: "en cours", upcoming: "à venir" };

function Progress({ status }: { status: StationStatus }) {
  if (status === "done") return <Check size={17} strokeWidth={2.4} className={styles.check} aria-hidden="true" />;
  if (status === "upcoming") return <span className={styles.pending} aria-hidden="true" />;
  return null;
}

/**
 * Menu de la page leçon : la formation dessinée comme une ligne de métro.
 * Modules = correspondances, leçons = stations, certificat = terminus. Seul
 * le module en cours déplie ses stations, sur une ligne secondaire. L'état
 * est une marque (coche, cercle vide, anneau corail « Vous êtes ici »),
 * jamais une couleur seule.
 */
export default function MetroLine({ line }: { line: LessonLine }) {
  const currentRef = useRef<HTMLAnchorElement>(null);

  // Une formation longue dépasse la hauteur du menu : la station en cours
  // est ramenée dans la zone visible à l'ouverture de la leçon.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
  }, [line.current?.id]);

  return (
    <nav className={styles.sidebar} aria-label="Parcours de la formation">
      <Link href="/apprenant" className={styles.wordmark} aria-label="Ahead Digital, retour à mes formations">
        <AheadLogo width={180} />
      </Link>
      <Link href={`/apprenant/${line.formationId}`} className={styles.formationTitle}>
        {line.formationTitle}
      </Link>

      <ol className={styles.line}>
        {line.modules.map((mod) => {
          // Un module replié pointe vers sa première station.
          const firstStation = mod.stations[0];
          const marker = mod.expanded ? "interchange" : mod.status;
          const head = (
            <>
              <span className={styles.marker} data-marker={marker} aria-hidden="true" />
              <span className={styles.label}>
                <span className={styles.moduleName}>
                  {mod.number} · {mod.title}
                </span>
                {!mod.expanded && mod.subtitle && <span className={styles.subtitle}>{mod.subtitle}</span>}
                {mod.status === "current" && !mod.expanded && <span className={styles.here}>Vous êtes ici</span>}
              </span>
              {!mod.expanded && <Progress status={mod.status} />}
            </>
          );
          return (
            <li key={mod.id} className={styles.module} data-expanded={mod.expanded || undefined}>
              {mod.expanded || !firstStation ? (
                <div className={styles.moduleHead}>{head}</div>
              ) : (
                <Link href={`/apprenant/${line.formationId}/${firstStation.id}`} className={styles.moduleHead}>
                  {head}
                  <span className="srOnly">, module {STATUS_LABEL[mod.status]}</span>
                </Link>
              )}
              {mod.expanded && (
                <ol className={styles.stations}>
                  {mod.stations.map((station) => (
                    <li key={station.id}>
                      <Link
                        ref={station.status === "current" ? currentRef : undefined}
                        href={`/apprenant/${line.formationId}/${station.id}`}
                        className={styles.station}
                        data-status={station.status}
                        aria-current={station.status === "current" ? "page" : undefined}
                      >
                        <span className={styles.dot} aria-hidden="true" />
                        <span className={styles.label}>
                          <span className={styles.stationTitle}>
                            {station.code} · {station.title}
                          </span>
                          {station.subtitle && <span className={styles.subtitle}>{station.subtitle}</span>}
                          {station.status === "current" && <span className={styles.here}>Vous êtes ici</span>}
                        </span>
                        <Progress status={station.status} />
                        <span className="srOnly">, {STATUS_LABEL[station.status]}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
        <li className={`${styles.module} ${styles.terminusItem}`}>
          <Link href={`/apprenant/${line.formationId}`} className={styles.moduleHead}>
            <span className={styles.marker} data-marker="terminus" aria-hidden="true" />
            <span className={styles.label}>
              <span className={styles.moduleName}>Terminus : certificat</span>
              <span className={styles.subtitle}>{line.terminusSubtitle}</span>
            </span>
          </Link>
        </li>
      </ol>
    </nav>
  );
}
