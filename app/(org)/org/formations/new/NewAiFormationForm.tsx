"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./new.module.css";

export default function NewAiFormationForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/org/formations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erreur lors de la création.");
      setSaving(false);
      return;
    }
    router.push(`/org/formations/${json.data.id}/sources`);
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label}>Titre de la formation</label>
        <input
          className={styles.input}
          placeholder="Ex : Onboarding sécurité informatique"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <Link href="/org/catalogue" className={styles.btnSecondary}>Annuler</Link>
        <button type="submit" className={styles.btnPrimary} disabled={!title.trim() || saving}>
          {saving ? "Création…" : "Continuer"}
        </button>
      </div>
    </form>
  );
}
