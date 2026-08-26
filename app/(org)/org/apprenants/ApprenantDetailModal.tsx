"use client";

import { X, Star, BookOpen, Clock } from "lucide-react";
import styles from "./apprenants.module.css";
import { getCompletion, getLastActivity } from "@/lib/apprenantProgress";
import type { Apprenant, Formation, ProgressRecord } from "./ApprenantTable";

// Même principe que TenantDetailModal.tsx côté super_admin (popup au clic sur
// une ligne) — mais sans appel réseau supplémentaire : la page apprenants
// charge déjà tous les progressRecords du tenant et toutes les formations
// disponibles, donc le détail par formation d'un apprenant se calcule
// entièrement à partir de ce qui est déjà en mémoire.
export default function ApprenantDetailModal({
  apprenant,
  formations,
  progressRecords,
  onClose,
}: {
  apprenant: Apprenant;
  formations: Formation[];
  progressRecords: ProgressRecord[];
  onClose: () => void;
}) {
  const lastActivity = getLastActivity(apprenant.id, progressRecords);
  const allLessonIds = formations.flatMap((f) => f.lessonIds);
  const overall = getCompletion(apprenant.id, allLessonIds, progressRecords);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.detailModal}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <p className={styles.modalTitle}>{apprenant.full_name || apprenant.email}</p>
          <button className={styles.modalClose} onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <p className={styles.detailMeta}>
          {apprenant.email} · Membre depuis {new Date(apprenant.created_at).toLocaleDateString("fr-FR")}
        </p>

        <div className={styles.detailStatsRow}>
          <div className={styles.detailStat}>
            <span className={styles.detailStatIcon}>
              <Star size={14} />
            </span>
            <div>
              <span className={styles.detailStatValue}>{apprenant.total_points}</span>
              <span className={styles.detailStatLabel}>Points</span>
            </div>
          </div>
          <div className={styles.detailStat}>
            <span className={styles.detailStatIcon}>
              <BookOpen size={14} />
            </span>
            <div>
              <span className={styles.detailStatValue}>{overall.completed}/{overall.total}</span>
              <span className={styles.detailStatLabel}>Leçons terminées (toutes formations)</span>
            </div>
          </div>
          <div className={styles.detailStat}>
            <span className={styles.detailStatIcon}>
              <Clock size={14} />
            </span>
            <div>
              <span className={styles.detailStatValue}>
                {lastActivity ? new Date(lastActivity).toLocaleDateString("fr-FR") : "—"}
              </span>
              <span className={styles.detailStatLabel}>Dernière activité</span>
            </div>
          </div>
        </div>

        <div className={styles.detailSection}>
          <span className={styles.detailSectionTitle}>Détail par formation ({formations.length})</span>
          {formations.length === 0 ? (
            <p className={styles.detailEmpty}>Aucune formation disponible pour cette entreprise.</p>
          ) : (
            <div className={styles.memberList}>
              {formations.map((f) => {
                const { completed, total, pct } = getCompletion(apprenant.id, f.lessonIds, progressRecords);
                return (
                  <div key={f.id} className={styles.formationRow}>
                    <span className={styles.memberAvatar}>
                      <BookOpen size={14} />
                    </span>
                    <div className={styles.memberInfo}>
                      <span className={styles.memberName}>{f.title}</span>
                      <span className={styles.memberEmail}>
                        {total > 0 ? `${completed}/${total} leçons` : "Aucune leçon dans cette formation"}
                      </span>
                      {total > 0 && (
                        <div className={styles.formationProgressBar}>
                          <div className={styles.formationProgressFill} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                    {total > 0 && <span className={styles.formationPct}>{pct}%</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
