"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import styles from "./formation.module.css";

export default function EnrollButton({ formationId }: { formationId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function enroll() {
    setLoading(true);
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formationId }),
      });
      if (res.ok) {
        toast.success("Bienvenue à bord ! Bonne formation.");
        router.refresh();
      } else {
        toast.error("Erreur lors de l'inscription.");
      }
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className={styles.enrollBtn} onClick={enroll} disabled={loading}>
      {loading ? "Inscription…" : "Monter à bord"}
      <ArrowRight size={22} strokeWidth={2.4} aria-hidden="true" />
    </button>
  );
}
