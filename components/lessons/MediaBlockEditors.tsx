"use client";

import * as React from "react";
import { toast } from "sonner";
import { ImageIcon, Upload, Trash2, Search, Loader2, Video, Link2 } from "lucide-react";
import type { ContentBlock } from "@/lib/ai/contentBlocks";
import type { YoutubeVideoResult } from "@/lib/youtube";
import { getVideoEmbedUrl } from "@/lib/video";
import editorStyles from "./blockEditor.module.css";

type ImageTextBlock = Extract<ContentBlock, { type: "image_text" }>;
type VideoBlock = Extract<ContentBlock, { type: "video" }>;
type PromptBlock = Extract<ContentBlock, { type: "prompt" }>;

/** Intitulé au-dessus d'un champ : une fois rempli, le placeholder ne suffit plus à le reconnaître. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={editorStyles.field}>
      <span className={editorStyles.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

export function ImageTextEditor({
  block,
  formationId,
  onChange,
}: {
  block: ImageTextBlock;
  /** Sans formationId (éditeur hors d'une formation), l'upload est indisponible. */
  formationId?: string;
  onChange: (block: ImageTextBlock) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!formationId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/org/formations/${formationId}/media`, { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Erreur lors de l'upload", { description: json.error });
        return;
      }
      onChange({ ...block, image_url: json.data.url });
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className={editorStyles.fieldsRow}>
        <select
          className={editorStyles.selectSmall}
          value={block.layout}
          onChange={(e) => onChange({ ...block, layout: e.target.value as ImageTextBlock["layout"] })}
        >
          <option value="image_left">Image à gauche</option>
          <option value="image_right">Image à droite</option>
          <option value="image_full">Image pleine largeur, texte dessous</option>
        </select>
      </div>

      {block.image_url ? (
        <div className={editorStyles.mediaPreview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.image_url} alt={block.image_description} className={editorStyles.mediaPreviewImg} />
          <div className={editorStyles.mediaPreviewActions}>
            <button type="button" className={editorStyles.addBtn} onClick={() => inputRef.current?.click()} disabled={uploading || !formationId}>
              <Upload size={13} /> {uploading ? "Envoi…" : "Remplacer"}
            </button>
            <button type="button" className={editorStyles.addBtn} onClick={() => onChange({ ...block, image_url: null })}>
              <Trash2 size={13} /> Retirer
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={editorStyles.mediaDrop}
          onClick={() => inputRef.current?.click()}
          disabled={uploading || !formationId}
        >
          {uploading ? <Loader2 size={18} className={editorStyles.spin} /> : <ImageIcon size={18} />}
          <span>
            <strong>{uploading ? "Envoi de l'image…" : "Ajouter l'image"}</strong>
            {block.image_description && <span className={editorStyles.mediaHint}>Suggestion : {block.image_description}</span>}
            <span className={editorStyles.mediaHint}>PNG, JPEG, WebP ou GIF — 4 Mo max. Tant qu&apos;elle manque, l&apos;apprenant ne voit que le texte.</span>
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className={editorStyles.hiddenInput}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
          e.target.value = "";
        }}
      />

      <Field label="Description de l'image (texte alternatif)">
        <input
          className={editorStyles.input}
          placeholder="Ce que montre l'image"
          value={block.image_description}
          onChange={(e) => onChange({ ...block, image_description: e.target.value })}
        />
      </Field>
      <Field label="Légende (optionnelle)">
        <input
          className={editorStyles.input}
          value={block.caption ?? ""}
          onChange={(e) => onChange({ ...block, caption: e.target.value || null })}
        />
      </Field>
      <Field label="Texte">
        <textarea
          className={editorStyles.textarea}
          rows={3}
          placeholder="Explication accompagnant l'image"
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      </Field>
    </>
  );
}

export function VideoEditor({ block, onChange }: { block: VideoBlock; onChange: (block: VideoBlock) => void }) {
  const [query, setQuery] = React.useState(block.search_query);
  const [pasted, setPasted] = React.useState("");
  const [pasteError, setPasteError] = React.useState(false);
  const [results, setResults] = React.useState<YoutubeVideoResult[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const embedUrl = block.url ? getVideoEmbedUrl(block.url) : null;

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch("/api/admin/youtube/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Recherche impossible", { description: json.error });
        return;
      }
      setResults(json.data);
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setSearching(false);
    }
  }

  function applyPastedLink(value = pasted) {
    if (!getVideoEmbedUrl(value)) {
      setPasteError(true);
      return;
    }
    onChange({ ...block, url: value.trim() });
    setPasted("");
    setPasteError(false);
    setResults(null);
  }

  // Un lien reconnu est pris en compte dès qu'il est collé : sans ça, il
  // restait dans le champ sans être enregistré si l'on oubliait de cliquer
  // sur « Utiliser ce lien » avant d'enregistrer la leçon.
  function onPastedChange(value: string) {
    setPasted(value);
    setPasteError(false);
    if (getVideoEmbedUrl(value)) applyPastedLink(value);
  }

  return (
    <>
      {embedUrl ? (
        <div className={editorStyles.mediaPreview}>
          <div className={editorStyles.videoPreview}>
            <iframe src={embedUrl} title={block.title} allowFullScreen />
          </div>
          <div className={editorStyles.mediaPreviewActions}>
            <button type="button" className={editorStyles.addBtn} onClick={() => onChange({ ...block, url: null })}>
              <Trash2 size={13} /> Changer de vidéo
            </button>
          </div>
        </div>
      ) : (
        <div className={editorStyles.videoPicker}>
          <span className={editorStyles.mediaHint}>
            <Video size={13} /> Aucune vidéo pour l&apos;instant — le bloc est masqué pour l&apos;apprenant tant qu&apos;elle manque.
          </span>
          <div className={editorStyles.fieldsRow}>
            <input
              className={editorStyles.input}
              placeholder="Rechercher sur YouTube"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }}
            />
            <button type="button" className={editorStyles.addBtn} onClick={search} disabled={searching || !query.trim()}>
              {searching ? <Loader2 size={13} className={editorStyles.spin} /> : <Search size={13} />} Rechercher
            </button>
          </div>
          {results && results.length === 0 && <span className={editorStyles.mediaHint}>Aucun résultat — essayez une autre recherche.</span>}
          {results && results.length > 0 && (
            <div className={editorStyles.videoResults}>
              {results.map((r) => (
                <button
                  key={r.videoId}
                  type="button"
                  className={editorStyles.videoResult}
                  onClick={() => { onChange({ ...block, url: r.url }); setResults(null); }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.thumbnailUrl} alt="" className={editorStyles.videoResultThumb} />
                  <span className={editorStyles.videoResultText}>
                    <strong>{r.title}</strong>
                    <span>{r.channelTitle}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className={editorStyles.fieldsRow}>
            <input
              className={editorStyles.input}
              placeholder="…ou collez un lien YouTube, Vimeo ou Loom"
              value={pasted}
              onChange={(e) => onPastedChange(e.target.value)}
              onBlur={() => pasted.trim() && applyPastedLink()}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPastedLink(); } }}
              aria-invalid={pasteError || undefined}
            />
            <button type="button" className={editorStyles.addBtn} onClick={() => applyPastedLink()} disabled={!pasted.trim()}>
              <Link2 size={13} /> Utiliser ce lien
            </button>
          </div>
          {pasteError && (
            <span className={editorStyles.mediaError} role="alert">
              Lien non reconnu : collez l&apos;adresse d&apos;une vidéo YouTube, Vimeo ou Loom (par exemple https://www.youtube.com/watch?v=…).
            </span>
          )}
        </div>
      )}

      <Field label="Titre de la vidéo">
        <input
          className={editorStyles.input}
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </Field>
      <Field label="Ce que l'apprenant doit observer (optionnel)">
        <input
          className={editorStyles.input}
          value={block.caption ?? ""}
          onChange={(e) => onChange({ ...block, caption: e.target.value || null })}
        />
      </Field>
    </>
  );
}

export function PromptEditor({ block, onChange }: { block: PromptBlock; onChange: (block: PromptBlock) => void }) {
  return (
    <>
      <Field label="À quoi sert ce prompt">
        <input
          className={editorStyles.input}
          placeholder="Ex. Rédiger un compte rendu de réunion"
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </Field>
      <Field label="Prompt à copier">
        <textarea
          className={`${editorStyles.textarea} ${editorStyles.monoTextarea}`}
          rows={5}
          placeholder="Texte exact du prompt, avec des [crochets] pour les parties à personnaliser"
          value={block.prompt}
          onChange={(e) => onChange({ ...block, prompt: e.target.value })}
        />
      </Field>
      <Field label="Conseil d'utilisation ou résultat attendu (optionnel)">
        <input
          className={editorStyles.input}
          value={block.tip ?? ""}
          onChange={(e) => onChange({ ...block, tip: e.target.value || null })}
        />
      </Field>
    </>
  );
}
