"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Eye, Pencil } from "lucide-react";
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
  href,
  stageLabel,
  stageIcon,
  isPublished,
  isFinal,
  canPreview,
}: {
  formationId: string;
  title: string;
  createdAt: string;
  href: string;
  stageLabel: string;
  stageIcon: React.ReactNode;
  isPublished: boolean;
  isFinal: boolean;
  canPreview: boolean;
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
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <Link href={href} className={styles.rowTitle}>{title}</Link>
        <span className={styles.rowDate}>Créée le {new Date(createdAt).toLocaleDateString("fr-FR")}</span>
      </div>
      <div className={styles.rowRight}>
        <span className={styles.sourceBadge}>Votre entreprise</span>
        <span className={`${styles.stageBadge} ${isFinal ? styles.stageBadgePublished : ""}`}>
          {stageIcon}
          {stageLabel}
        </span>
        {canPreview && (
          <Link href={`/org/formations/${formationId}/apercu`} className={styles.rowIconBtn} title="Voir le contenu">
            <Eye size={14} />
            Voir le contenu
          </Link>
        )}
        <Link href={href} className={styles.rowIconBtn} title="Modifier">
          <Pencil size={14} />
          Modifier
        </Link>
        {!isPublished && (
          <button
            type="button"
            className={`${styles.deleteBtn} ${confirming ? styles.deleteBtnConfirm : ""}`}
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
  );
}
