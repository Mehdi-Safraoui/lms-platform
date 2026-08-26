"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Eye, Pencil } from "lucide-react";
import RowThumb from "./RowThumb";
import styles from "./formations.module.css";

// Ligne d'une formation créée par CE tenant via l'assistant IA — pas de bouton
// Activer/Désactiver ici (elle est déjà visible pour ses propres apprenants
// dès publication, voir app/api/org/formations/[id]/publish/route.ts) :
// seulement "Voir le contenu", "Modifier" (reprendre l'étape en cours) et
// "Supprimer" (tant qu'elle n'est pas publiée).
export default function FormationRow({
  formationId,
  title,
  createdAt,
  updatedAt,
  href,
  stageLabel,
  stageIcon,
  isPublished,
  isFinal,
  canPreview,
  thumbnailUrl,
}: {
  formationId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  href: string;
  stageLabel: string;
  stageIcon: React.ReactNode;
  isPublished: boolean;
  isFinal: boolean;
  canPreview: boolean;
  thumbnailUrl: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/org/formations/${formationId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error("Erreur", { description: json?.error });
        setConfirming(false);
        return;
      }
      toast.success(`"${title}" supprimée.`);
      router.refresh();
    } catch {
      toast.error("Erreur réseau. Réessayez.");
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardCoverWrap}>
        <RowThumb formationId={formationId} thumbnailUrl={thumbnailUrl} editable />
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardBadgeRow}>
          <span className={styles.sourceBadge}>Votre entreprise</span>
          <span className={`${styles.stageBadge} ${isFinal ? styles.stageBadgePublished : ""}`}>
            {stageIcon}
            {stageLabel}
          </span>
        </div>
        <Link href={href} className={styles.cardTitle} title={title}>{title}</Link>
        <span className={styles.cardMeta}>
          {updatedAt !== createdAt
            ? `Modifiée le ${new Date(updatedAt).toLocaleDateString("fr-FR")}`
            : `Créée le ${new Date(createdAt).toLocaleDateString("fr-FR")}`}
        </span>
        <div className={styles.cardActions}>
          {canPreview && (
            <Link href={`/org/formations/${formationId}/apercu`} className={styles.rowIconBtn} title="Voir le contenu">
              <Eye size={14} />
              Voir le contenu
            </Link>
          )}
          <Link href={href} className={styles.iconBtn} title="Modifier" aria-label="Modifier">
            <Pencil size={14} />
          </Link>
          {!isPublished && (
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.iconBtnDanger} ${confirming ? styles.deleteBtnConfirm : ""}`}
              disabled={deleting}
              onClick={handleDelete}
              onBlur={() => setConfirming(false)}
              aria-label={confirming ? "Confirmer la suppression" : "Supprimer cette formation"}
              title={confirming ? "Cliquer à nouveau pour confirmer" : "Supprimer"}
            >
              <Trash2 size={14} />
              {confirming && <span>Confirmer ?</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
