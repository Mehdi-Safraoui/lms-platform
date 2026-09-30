"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./new.module.css";

export default function NewAiFormationForm({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailError, setThumbnailError] = useState(false);
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
      body: JSON.stringify({ title, thumbnailUrl: thumbnailUrl.trim() || undefined }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erreur lors de la création.");
      setSaving(false);
      return;
    }
    router.push(`${basePath}/${json.data.id}/sources`);
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

      <div className={styles.field}>
        <label className={styles.label}>Image de couverture (optionnel)</label>
        <input
          className={styles.input}
          type="url"
          placeholder="https://… (lien vers une image)"
          value={thumbnailUrl}
          onChange={(e) => { setThumbnailUrl(e.target.value); setThumbnailError(false); }}
        />
        <span className={styles.hint}>
          Un lien vers une image existante — sans image, une couverture générée automatiquement sera utilisée.
        </span>
        {thumbnailUrl.trim() && !thumbnailError && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl.trim()}
            alt=""
            className={styles.thumbnailPreview}
            onError={() => setThumbnailError(true)}
          />
        )}
        {thumbnailError && <span className={styles.hintError}>Impossible de charger cette image — vérifiez le lien.</span>}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <Link href={basePath} className={styles.btnSecondary}>Annuler</Link>
        <button type="submit" className={styles.btnPrimary} disabled={!title.trim() || saving}>
          {saving ? "Création…" : "Continuer"}
        </button>
      </div>
    </form>
  );
}
