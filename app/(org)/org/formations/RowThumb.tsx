"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Check, X } from "lucide-react";
import { formationCover } from "@/lib/formationAccent";
import styles from "./formations.module.css";

// Vignette de couverture partagée entre FormationRow (vos formations) et
// AheadFormationRow (catalogue) — même logique que côté apprenant
// (app/(dashboard)/apprenant/page.tsx) : la vraie image si définie, sinon un
// dégradé + icône généré de façon déterministe à partir de l'id.
//
// editable=true (vos formations uniquement, jamais le catalogue Ahead dont ce
// tenant n'est pas propriétaire) affiche un crayon pour ajouter/changer
// l'image après coup — jusqu'ici ce n'était possible qu'au moment de la
// création (NewAiFormationForm.tsx), aucun moyen de le faire pour une
// formation déjà existante.
export default function RowThumb({
  formationId,
  thumbnailUrl,
  editable = false,
}: {
  formationId: string;
  thumbnailUrl: string | null;
  editable?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(thumbnailUrl ?? "");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/org/formations/${formationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnailUrl: value.trim() || null }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error("Erreur", { description: json?.error });
        return;
      }
      toast.success("Image de couverture mise à jour.");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setValue(thumbnailUrl ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className={styles.thumbEditPopover}>
        <input
          autoFocus
          className={styles.thumbEditInput}
          placeholder="https://…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          disabled={saving}
        />
        <div className={styles.thumbEditActions}>
          <button type="button" className={styles.miniIconBtn} onClick={save} disabled={saving} aria-label="Enregistrer l'image">
            <Check size={12} />
          </button>
          <button type="button" className={styles.miniIconBtn} onClick={cancel} disabled={saving} aria-label="Annuler">
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  const thumb = thumbnailUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={thumbnailUrl} alt="" className={styles.cardCover} />
  ) : (
    <GeneratedThumb formationId={formationId} />
  );

  if (!editable) return thumb;

  return (
    <div className={styles.thumbWrap}>
      {thumb}
      <button
        type="button"
        className={styles.thumbEditBtn}
        onClick={() => setEditing(true)}
        aria-label="Modifier l'image de couverture"
        title="Modifier l'image de couverture"
      >
        <Pencil size={11} />
      </button>
    </div>
  );
}

function GeneratedThumb({ formationId }: { formationId: string }) {
  const cover = formationCover(formationId);
  return (
    <div className={styles.cardCoverGenerated} style={{ background: cover.gradient }}>
      <div className={styles.cardCoverIconBadge}>
        <cover.icon size={24} color="#fff" strokeWidth={1.75} />
      </div>
    </div>
  );
}
