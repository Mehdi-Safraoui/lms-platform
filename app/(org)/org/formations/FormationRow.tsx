"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import styles from "./formations.module.css";

export default function FormationRow({
  formationId,
  title,
  createdAt,
  href,
  stageLabel,
  stageIcon,
  isPublished,
  isFinal,
}: {
  formationId: string;
  title: string;
  createdAt: string;
  href: string;
  stageLabel: string;
  stageIcon: React.ReactNode;
  isPublished: boolean;
  isFinal: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

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
    <Link href={href} className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowDate}>Créée le {new Date(createdAt).toLocaleDateString("fr-FR")}</span>
      </div>
      <div className={styles.rowRight}>
        <span className={`${styles.stageBadge} ${isFinal ? styles.stageBadgePublished : ""}`}>
          {stageIcon}
          {stageLabel}
        </span>
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
    </Link>
  );
}
