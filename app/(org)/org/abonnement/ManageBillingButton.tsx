"use client";

import { useState } from "react";
import { toast } from "sonner";
import styles from "./abonnement.module.css";

export default function ManageBillingButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.url) {
        window.location.href = data.url;
      } else {
        toast.error(data?.error ?? "Impossible d'ouvrir la gestion de facturation.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className={styles.btnManage} onClick={handleClick} disabled={loading}>
      {loading ? "Ouverture…" : "Gérer dans Stripe"}
    </button>
  );
}
