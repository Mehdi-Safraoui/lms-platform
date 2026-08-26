import Link from "next/link";
import { Eye } from "lucide-react";
import CatalogueToggle from "../catalogue/CatalogueToggle";
import RowThumb from "./RowThumb";
import styles from "./formations.module.css";

const NIVEAU_LABEL: Record<string, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

// Ligne d'une formation du catalogue global Ahead (créée par le super_admin) —
// jamais de "Modifier"/"Supprimer" ici, ce tenant n'en est pas propriétaire :
// seulement "Voir le contenu" (lecture seule, app/(org)/org/catalogue/[id]) et
// le bouton Activer/Désactiver déjà existant.
export default function AheadFormationRow({
  formationId,
  title,
  createdAt,
  niveau,
  moduleCount,
  lessonCount,
  enabled,
  thumbnailUrl,
}: {
  formationId: string;
  title: string;
  createdAt: string;
  niveau: string | null;
  moduleCount: number;
  lessonCount: number;
  enabled: boolean;
  thumbnailUrl: string | null;
}) {
  const metaLine = `Créée le ${new Date(createdAt).toLocaleDateString("fr-FR")} · ${moduleCount} module${moduleCount > 1 ? "s" : ""} · ${lessonCount} leçon${lessonCount > 1 ? "s" : ""}${niveau ? ` · ${NIVEAU_LABEL[niveau] ?? niveau}` : ""}`;

  return (
    <div className={styles.card}>
      <div className={styles.cardCoverWrap}>
        <RowThumb formationId={formationId} thumbnailUrl={thumbnailUrl} />
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardBadgeRow}>
          <span className={`${styles.sourceBadge} ${styles.sourceBadgeAhead}`}>Ahead</span>
          {enabled && <span className={styles.stageBadge}>Activée</span>}
        </div>
        <Link href={`/org/catalogue/${formationId}`} className={styles.cardTitle} title={title}>{title}</Link>
        <span className={styles.cardMeta} title={metaLine}>{metaLine}</span>
        <div className={styles.cardActions}>
          <Link href={`/org/catalogue/${formationId}`} className={styles.rowIconBtn} title="Voir le contenu">
            <Eye size={14} />
            Voir le contenu
          </Link>
          <CatalogueToggle formationId={formationId} enabled={enabled} />
        </div>
      </div>
    </div>
  );
}
