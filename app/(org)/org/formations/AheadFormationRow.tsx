import Link from "next/link";
import { Eye } from "lucide-react";
import CatalogueToggle from "../catalogue/CatalogueToggle";
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
}: {
  formationId: string;
  title: string;
  createdAt: string;
  niveau: string | null;
  moduleCount: number;
  lessonCount: number;
  enabled: boolean;
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <Link href={`/org/catalogue/${formationId}`} className={styles.rowTitle}>{title}</Link>
        <span className={styles.rowDate}>
          Créée le {new Date(createdAt).toLocaleDateString("fr-FR")}
          {" · "}
          {moduleCount} module{moduleCount > 1 ? "s" : ""} · {lessonCount} leçon{lessonCount > 1 ? "s" : ""}
          {niveau && ` · ${NIVEAU_LABEL[niveau] ?? niveau}`}
        </span>
      </div>
      <div className={styles.rowRight}>
        <span className={`${styles.sourceBadge} ${styles.sourceBadgeAhead}`}>Ahead</span>
        {enabled && <span className={styles.stageBadge}>Activée</span>}
        <Link href={`/org/catalogue/${formationId}`} className={styles.rowIconBtn} title="Voir le contenu">
          <Eye size={14} />
          Voir le contenu
        </Link>
        <CatalogueToggle formationId={formationId} enabled={enabled} />
      </div>
    </div>
  );
}
