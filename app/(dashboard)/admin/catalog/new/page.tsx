"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PenLine, Sparkles, UploadCloud, FileText, X } from "lucide-react";
import styles from "./new.module.css";

type Mode = "choice" | "manual" | "ai";

export default function NewFormationPage() {
  const [mode, setMode] = useState<Mode>("choice");

  return (
    <div className={styles.page}>
      <Link href="/admin/catalog" className={styles.back}>
        <ArrowLeft size={16} strokeWidth={2} />
        Retour au catalogue
      </Link>

      <h1 className={styles.title}>Nouvelle formation</h1>

      {mode === "choice" && <ChoiceStep onSelect={setMode} />}
      {mode === "manual" && <ManualForm onBack={() => setMode("choice")} />}
      {mode === "ai" && <AiGenerateForm onBack={() => setMode("choice")} />}
    </div>
  );
}

// ── Étape 1 : choix du mode de création ──────────────────
function ChoiceStep({ onSelect }: { onSelect: (mode: Mode) => void }) {
  return (
    <div className={styles.choiceGrid}>
      <button className={styles.choiceCard} onClick={() => onSelect("manual")}>
        <span className={styles.choiceIcon}>
          <PenLine size={22} strokeWidth={1.75} />
        </span>
        <span className={styles.choiceTitle}>Créer manuellement</span>
        <span className={styles.choiceDesc}>
          Construisez la formation module par module avec l&apos;éditeur (texte, vidéo, quiz).
        </span>
      </button>

      <button className={`${styles.choiceCard} ${styles.choiceCardAi}`} onClick={() => onSelect("ai")}>
        <span className={`${styles.choiceIcon} ${styles.choiceIconAi}`}>
          <Sparkles size={22} strokeWidth={1.75} />
        </span>
        <span className={styles.choiceTitle}>Générer avec l&apos;IA</span>
        <span className={styles.choiceDesc}>
          Uploadez un PDF ou un Word — l&apos;IA génère automatiquement les modules, les leçons et les quiz.
        </span>
      </button>
    </div>
  );
}

// ── Étape 2a : formulaire manuel (existant) ──────────────
function ManualForm({ onBack }: { onBack: () => void }) {
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
        <button type="button" className={styles.btnSecondary} onClick={onBack}>Retour</button>
        <button type="submit" className={styles.btnPrimary} disabled={saving}>
          {saving ? "Création…" : "Créer la formation"}
        </button>
      </div>
    </form>
  );
}

// ── Étape 2b : génération par IA ─────────────────────────
function AiGenerateForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setFile(e.target.files?.[0] ?? null);
  }

  async function handleGenerate() {
    if (!file) return;
    setGenerating(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/formations/generate", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erreur lors de la génération.");
        setGenerating(false);
        return;
      }
      router.push(`/admin/catalog/${json.data.id}/edit`);
    } catch {
      setError("Erreur réseau — réessayez.");
      setGenerating(false);
    }
  }

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <label className={styles.label}>Document source (PDF ou Word)</label>

        {!file ? (
          <label className={styles.dropzone}>
            <UploadCloud size={24} strokeWidth={1.5} />
            <span>Cliquez pour choisir un fichier</span>
            <span className={styles.hint}>.pdf ou .docx</span>
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileChange}
              className={styles.hiddenInput}
              disabled={generating}
            />
          </label>
        ) : (
          <div className={styles.filePreview}>
            <FileText size={18} className={styles.filePreviewIcon} />
            <span className={styles.filePreviewName}>{file.name}</span>
            {!generating && (
              <button type="button" className={styles.filePreviewRemove} onClick={() => setFile(null)}>
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {generating && (
        <div className={styles.generatingNotice}>
          <Sparkles size={16} className={styles.generatingIcon} />
          Analyse du document et génération de la formation en cours… cela peut prendre jusqu&apos;à une minute.
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.btnSecondary} onClick={onBack} disabled={generating}>
          Retour
        </button>
        <button type="button" className={styles.btnPrimary} onClick={handleGenerate} disabled={!file || generating}>
          {generating ? "Génération…" : "Générer la formation"}
        </button>
      </div>
    </div>
  );
}
