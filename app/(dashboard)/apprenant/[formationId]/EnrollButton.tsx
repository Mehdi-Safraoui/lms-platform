"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookmarkPlus } from "lucide-react";
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
        toast.success("Inscription réussie ! Bonne formation 🎓");
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
      <BookmarkPlus size={18} />
      {loading ? "Inscription en cours…" : "S'inscrire à cette formation"}
    </button>
  );
}
