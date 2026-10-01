"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Lock } from "lucide-react";
import type { LineModule } from "@/lib/lessonLine";
import styles from "./formation.module.css";

/**
 * Plan détaillé de la ligne : un module par rangée (numéro, durée, une
 * pastille par station), dépliable pour voir et ouvrir ses stations. Le
 * module où reprendre est déplié à l'arrivée.
 */
export default function ModulePlan({
  formationId,
  modules,
  initiallyOpen,
  lockedIds,
  linkable,
}: {
  formationId: string;
  modules: LineModule[];
  initiallyOpen: number;
  lockedIds: string[];
  /** false = apprenant pas encore inscrit : plan visible, stations non ouvrables. */
  linkable: boolean;
}) {
  const [open, setOpen] = useState<number | null>(initiallyOpen);
  const locked = new Set(lockedIds);

  return (
    <ol className={styles.plan}>
      {modules.map((mod) => {
        const isOpen = open === mod.number;
        const panelId = `module-${mod.number}-stations`;
        return (
          <li key={mod.id} className={styles.planModule} data-open={isOpen || undefined}>
            <button
              type="button"
              className={styles.planHead}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : mod.number)}
            >
              <span className={styles.planDisc} aria-hidden="true">{mod.number}</span>
              <span className={styles.planLabel}>
                <span className={styles.planTitle}>{mod.title}</span>
                {mod.subtitle && <span className={styles.planSub}>{mod.subtitle}</span>}
              </span>
              <span className={styles.planDots} aria-hidden="true">
                {mod.stations.map((st) => (
                  <span key={st.id} className={styles.planDot} data-status={st.status} />
                ))}
              </span>
              <ChevronDown size={18} strokeWidth={2.2} className={styles.planChevron} aria-hidden="true" />
            </button>

            {isOpen && (
              <ol id={panelId} className={styles.planStations}>
                {mod.stations.map((st) => {
                  const isLocked = locked.has(st.id);
                  const content = (
                    <>
                      <span className={styles.planStationDot} data-status={st.status} aria-hidden="true" />
                      <span className={styles.planStationCode}>{st.code}</span>
                      <span className={styles.planStationTitle}>{st.title}</span>
                      {st.status === "current" && <span className={styles.hereSmall}>Vous êtes ici</span>}
                      <span className={styles.planStationEnd}>
                        {isLocked ? (
                          <Lock size={15} aria-label="Réservé aux abonnés" />
                        ) : st.status === "done" ? (
                          <Check size={17} strokeWidth={2.4} aria-label="Terminée" />
                        ) : (
                          st.subtitle && <span className={styles.planStationTime}>{st.subtitle}</span>
                        )}
                      </span>
                    </>
                  );
                  return (
                    <li key={st.id}>
                      {linkable && !isLocked ? (
                        <Link href={`/apprenant/${formationId}/${st.id}`} className={styles.planStation} data-status={st.status}>
                          {content}
                        </Link>
                      ) : (
                        <span className={styles.planStation} data-status={st.status} data-static>
                          {content}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </li>
        );
      })}
    </ol>
  );
}
