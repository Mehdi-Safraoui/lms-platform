"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  UploadCloud, FileText, Link as LinkIcon,
  Clock, Loader2, CheckCircle2, AlertTriangle,
} from "lucide-react";
import styles from "./sources.module.css";

interface KnowledgeSource {
  id: string;
  file_name: string;
  format: "pdf" | "word" | "ppt" | "texte" | "web";
  ingestion_status: "en_attente" | "en_cours" | "terminee" | "erreur";
  uploaded_at: string;
}

const FORMAT_LABEL: Record<KnowledgeSource["format"], string> = {
  pdf: "PDF",
  word: "Word",
  ppt: "PowerPoint",
  texte: "Texte",
  web: "URL web",
};

const STATUS_LABEL: Record<KnowledgeSource["ingestion_status"], string> = {
  en_attente: "En attente",
  en_cours: "En cours",
  terminee: "Traité",
  erreur: "Erreur",
};

export default function SourcesClient({ formationId }: { formationId: string }) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/org/formations/${formationId}/knowledge-sources`);
      if (cancelled) return;
      if (res.ok) setSources((await res.json()).data ?? []);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [formationId]);

  async function uploadFile(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/org/formations/${formationId}/knowledge-sources`, { method: "POST", body: formData });
    const json = await res.json();
    if (!res.ok) {
      toast.error("Erreur lors de l'upload", { description: json.error });
    } else {
      toast.success(`"${file.name}" ajouté`);
      setSources((prev) => [json.data, ...prev]);
    }
    setUploading(false);
  }

  async function addUrl() {
    if (!urlInput.trim()) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("url", urlInput.trim());
    const res = await fetch(`/api/org/formations/${formationId}/knowledge-sources`, { method: "POST", body: formData });
    const json = await res.json();
    if (!res.ok) {
      toast.error("Erreur", { description: json.error });
    } else {
      toast.success("URL ajoutée");
      setSources((prev) => [json.data, ...prev]);
      setUrlInput("");
    }
    setUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  if (loading) return <div className={styles.loading}>Chargement…</div>;

  return (
    <>
      <label
        className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <UploadCloud size={26} strokeWidth={1.5} />
        <span>Glissez un fichier ici ou cliquez pour choisir</span>
        <span className={styles.hint}>PDF, .docx, .pptx, .txt — 4 Mo max</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.pptx,.ppt,.txt"
          className={styles.hiddenInput}
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
            e.target.value = "";
          }}
        />
      </label>

      <div className={styles.urlRow}>
        <LinkIcon size={15} className={styles.urlIcon} />
        <input
          className={styles.urlInput}
          placeholder="https://… (une page web comme source)"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addUrl(); }}
          disabled={uploading}
        />
        <button className={styles.urlBtn} onClick={addUrl} disabled={uploading || !urlInput.trim()}>
          Ajouter
        </button>
      </div>

      <div className={styles.sourcesSection}>
        <span className={styles.sourcesSectionTitle}>
          Documents ajoutés ({sources.length})
        </span>
        {sources.length === 0 ? (
          <p className={styles.empty}>Aucun document pour l&apos;instant.</p>
        ) : (
          <div className={styles.sourcesList}>
            {sources.map((s) => (
              <div key={s.id} className={styles.sourceRow}>
                <span className={styles.sourceIcon}>
                  {s.format === "web" ? <LinkIcon size={15} /> : <FileText size={15} />}
                </span>
                <div className={styles.sourceMeta}>
                  <span className={styles.sourceName}>{s.file_name}</span>
                  <span className={styles.sourceFormat}>{FORMAT_LABEL[s.format]}</span>
                </div>
                <span className={`${styles.statusBadge} ${styles[`status_${s.ingestion_status}`]}`}>
                  {s.ingestion_status === "en_attente" && <Clock size={12} />}
                  {s.ingestion_status === "en_cours" && <Loader2 size={12} className={styles.spin} />}
                  {s.ingestion_status === "terminee" && <CheckCircle2 size={12} />}
                  {s.ingestion_status === "erreur" && <AlertTriangle size={12} />}
                  {STATUS_LABEL[s.ingestion_status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
