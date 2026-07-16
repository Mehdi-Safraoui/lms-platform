"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import styles from "./catalogue.module.css";

interface Props {
  formationId: string;
  enabled: boolean;
}

export default function CatalogueToggle({ formationId, enabled: initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/org/catalogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formationId, enabled: !enabled }),
      });
      if (res.ok) {
        setEnabled(!enabled);
        toast.success(
          enabled
            ? "Formation retirée du catalogue apprenant"
            : "Formation activée pour vos apprenants ✓"
        );
        router.refresh();
      } else {
        toast.error("Erreur lors de la mise à jour");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`${styles.toggleBtn} ${enabled ? styles.toggleBtnEnabled : styles.toggleBtnDisabled}`}
    >
      {loading ? "…" : enabled ? "Désactiver" : "Activer"}
    </button>
  );
}
