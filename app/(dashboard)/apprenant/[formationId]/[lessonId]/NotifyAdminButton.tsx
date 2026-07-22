"use client";

import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import styles from "./lesson.module.css";

export default function NotifyAdminButton() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/subscription-request", { method: "POST" });
      const data = await res.json().catch(() => null);

      if (res.ok) {
        setSent(true);
        if (data?.alreadySent) {
          toast.info("Votre administrateur a déjà été prévenu récemment.");
        } else {
          toast.success("Votre administrateur a été prévenu.");
        }
      } else {
        toast.error(data?.error ?? "Impossible d'envoyer la demande.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className={styles.lockedNotifyBtn} onClick={handleClick} disabled={loading || sent}>
      {sent ? <Check size={14} /> : <Bell size={14} />}
      {sent ? "Administrateur prévenu" : loading ? "Envoi…" : "Prévenir mon administrateur"}
    </button>
  );
}
