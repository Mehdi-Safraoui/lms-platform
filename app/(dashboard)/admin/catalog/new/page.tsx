"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "./new.module.css";

export default function NewFormationPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    is_published: false,
  });

  function handleTitleChange(title: string) {
    const slug = title
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setForm((prev) => ({ ...prev, title, slug }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.slug) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/formations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erreur lors de la création");
      setSaving(false);
      return;
    }
    router.push(`/admin/catalog/${json.data.id}/edit`);
  }

  return (
    <div className={styles.page}>
      <Link href="/admin/catalog" className={styles.back}>
        <ArrowLeft size={16} strokeWidth={2} />
        Retour au catalogue
      </Link>

      <h1 className={styles.title}>Nouvelle formation</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Titre *</label>
          <input
            className={styles.input}
            type="text"
            placeholder="Ex : Maîtriser l'IA générative"
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Slug *</label>
          <input
            className={styles.input}
            type="text"
            placeholder="maitriser-ia-generative"
            value={form.slug}
            onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
            required
          />
          <span className={styles.hint}>Généré automatiquement depuis le titre</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <textarea
            className={styles.textarea}
            placeholder="Décrivez le contenu de cette formation…"
            rows={4}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>

        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
          />
          Publier immédiatement
        </label>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <Link href="/admin/catalog" className={styles.btnSecondary}>Annuler</Link>
          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving ? "Création…" : "Créer la formation"}
          </button>
        </div>
      </form>
    </div>
  );
}
