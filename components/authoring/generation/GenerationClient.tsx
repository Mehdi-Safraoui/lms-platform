"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Sparkles, RefreshCw, CheckCircle2, Circle, Clock,
  GraduationCap, ClipboardList, Save, ArrowRight, Rocket, Gauge,
  Plus, Trash2, Pencil, Check, X, Eye, Video, FileText,
} from "lucide-react";
import BlockEditor from "@/components/lessons/BlockEditor";
import BlockRenderer from "@/components/lessons/BlockRenderer";
import { getVideoEmbedUrl } from "@/lib/video";
import type { ContentBlock } from "@/lib/ai/contentBlocks";
import Link from "next/link";
import type { AuthoringSpace } from "../space";
import WaitingPanel from "../WaitingPanel";
import styles from "./generation.module.css";

type ContentType = "rich" | "quiz" | "video";

interface QuizQuestionOption {
  text: string;
  is_correct: boolean;
}

interface QuizQuestion {
  question_text: string;
  options: QuizQuestionOption[];
  order_index: number;
}

interface Lesson {
  id: string;
  title: string;
  contentType: ContentType;
  generationBrief: string | null;
  hasContent: boolean;
  contentBlocks: ContentBlock[] | null;
  videoUrl: string | null;
  quizQuestions: QuizQuestion[] | null;
  validatedAt: string | null;
}

interface ModuleGroup {
  id: string;
  title: string;
  lecons: Lesson[];
}

interface Quota {
  used: number;
  total: number | null; // null = illimité
}

function flatten(modules: ModuleGroup[]): Lesson[] {
  return modules.flatMap((m) => m.lecons);
}

function RenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.renameRow}>
      <input
        autoFocus
        className={styles.renameInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit();
          if (e.key === "Escape") onCancel();
        }}
      />
      <button type="button" className={styles.miniIconBtn} onClick={onCommit} aria-label="Confirmer">
        <Check size={12} />
      </button>
      <button type="button" className={styles.miniIconBtn} onClick={onCancel} aria-label="Annuler">
        <X size={12} />
      </button>
    </div>
  );
}

export default function GenerationClient({
  formationId,
  alreadyPublished,
  space,
}: {
  formationId: string;
  alreadyPublished: boolean;
  space: AuthoringSpace;
}) {
  const [modules, setModules] = React.useState<ModuleGroup[] | null>(null);
  const [quota, setQuota] = React.useState<Quota | null>(null);
  const [selectedLeconId, setSelectedLeconId] = React.useState<string | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [published, setPublished] = React.useState(alreadyPublished);
  const [addingModule, setAddingModule] = React.useState(false);
  const [addingLeconTo, setAddingLeconTo] = React.useState<string | null>(null);
  const [leconMenuOpenFor, setLeconMenuOpenFor] = React.useState<string | null>(null);
  const [renaming, setRenaming] = React.useState<{ kind: "module" | "lecon"; id: string; value: string } | null>(null);
  const fetchedRef = React.useRef(false);
  // Instance de LessonPanel actuellement montée (voir key={selectedLecon.id}
  // plus bas) — permet de forcer l'enregistrement de ses modifications non
  // sauvegardées juste avant de la démonter (changement de leçon), au lieu de
  // les perdre silencieusement. Voir selectLecon().
  const lessonPanelRef = React.useRef<{ flushIfDirty: () => Promise<void> } | null>(null);

  React.useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetch(`/api/org/formations/${formationId}/generation`)
      .then((res) => res.json())
      .then((json) => {
        setModules(json.data.modules);
        setQuota(json.data.quota);
        const first = flatten(json.data.modules)[0];
        if (first) setSelectedLeconId(first.id);
      });
  }, [formationId]);

  const quotaExhausted = quota !== null && quota.total !== null && quota.used >= quota.total;

  const allLecons = modules ? flatten(modules) : [];
  const selectedLecon = allLecons.find((l) => l.id === selectedLeconId) ?? null;
  const validatedCount = allLecons.filter((l) => l.validatedAt).length;
  const allValidated = allLecons.length > 0 && validatedCount === allLecons.length;

  function updateLeconLocal(leconId: string, patch: Partial<Lesson>) {
    setModules((prev) =>
      prev ? prev.map((m) => ({ ...m, lecons: m.lecons.map((l) => (l.id === leconId ? { ...l, ...patch } : l)) })) : prev
    );
  }

  function selectNextAfter(leconId: string) {
    const idx = allLecons.findIndex((l) => l.id === leconId);
    const next = allLecons[idx + 1];
    if (next) setSelectedLeconId(next.id);
  }

  // Point de passage unique pour tout changement de leçon sélectionnée
  // déclenché manuellement (sidebar, ajout de leçon/module) : enregistre
  // d'abord les modifications en cours si besoin, pour ne jamais les perdre au
  // démontage de LessonPanel. selectNextAfter() (après validation) n'en a pas
  // besoin : saveEdits() a déjà tourné dans handleValidate juste avant.
  async function selectLecon(leconId: string) {
    if (leconId === selectedLeconId) return;
    await lessonPanelRef.current?.flushIfDirty();
    setSelectedLeconId(leconId);
  }

  async function handleAddModule() {
    await lessonPanelRef.current?.flushIfDirty();
    setAddingModule(true);
    try {
      const res = await fetch(`/api/org/formations/${formationId}/generation/modules`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Erreur", { description: json.error });
        return;
      }
      const firstLecon: Lesson = {
        id: json.data.lecons[0].id,
        title: json.data.lecons[0].title,
        contentType: json.data.lecons[0].content_type,
        generationBrief: json.data.lecons[0].generation_brief,
        hasContent: false,
        contentBlocks: json.data.lecons[0].content_blocks,
        videoUrl: json.data.lecons[0].video_url ?? null,
        quizQuestions: null,
        validatedAt: json.data.lecons[0].content_validated_at,
      };
      setModules((prev) => [...(prev ?? []), { id: json.data.id, title: json.data.title, lecons: [firstLecon] }]);
      setSelectedLeconId(firstLecon.id);
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setAddingModule(false);
    }
  }

  async function handleDeleteModule(moduleId: string) {
    if (!window.confirm("Supprimer ce module et toutes ses leçons ?")) return;
    const res = await fetch(`/api/org/formations/${formationId}/generation/modules/${moduleId}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      toast.error("Erreur", { description: json?.error });
      return;
    }
    setModules((prev) => {
      const next = (prev ?? []).filter((m) => m.id !== moduleId);
      if (selectedLecon && !next.some((m) => m.lecons.some((l) => l.id === selectedLecon.id))) {
        setSelectedLeconId(flatten(next)[0]?.id ?? null);
      }
      return next;
    });
    toast.success("Module supprimé.");
  }

  async function handleAddLecon(moduleId: string, contentType: ContentType) {
    setLeconMenuOpenFor(null);
    await lessonPanelRef.current?.flushIfDirty();
    setAddingLeconTo(moduleId);
    try {
      const res = await fetch(`/api/org/formations/${formationId}/generation/modules/${moduleId}/lecons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Erreur", { description: json.error });
        return;
      }
      const newLecon: Lesson = {
        id: json.data.id,
        title: json.data.title,
        contentType: json.data.content_type,
        generationBrief: json.data.generation_brief,
        hasContent: false,
        contentBlocks: json.data.content_blocks,
        videoUrl: json.data.video_url,
        quizQuestions: null,
        validatedAt: json.data.content_validated_at,
      };
      setModules((prev) => (prev ? prev.map((m) => (m.id === moduleId ? { ...m, lecons: [...m.lecons, newLecon] } : m)) : prev));
      setSelectedLeconId(newLecon.id);
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setAddingLeconTo(null);
    }
  }

  async function handleDeleteLecon(moduleId: string, leconId: string) {
    if (!window.confirm("Supprimer cette leçon ?")) return;
    const res = await fetch(`/api/org/formations/${formationId}/generation/modules/${moduleId}/lecons/${leconId}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      toast.error("Erreur", { description: json?.error });
      return;
    }
    setModules((prev) => {
      const next = (prev ?? []).map((m) => (m.id === moduleId ? { ...m, lecons: m.lecons.filter((l) => l.id !== leconId) } : m));
      if (selectedLeconId === leconId) setSelectedLeconId(flatten(next)[0]?.id ?? null);
      return next;
    });
    toast.success("Leçon supprimée.");
  }

  async function commitRename() {
    if (!renaming || !renaming.value.trim()) {
      setRenaming(null);
      return;
    }
    const { kind, id, value } = renaming;
    const url =
      kind === "module"
        ? `/api/org/formations/${formationId}/generation/modules/${id}`
        : `/api/org/formations/${formationId}/generation/modules/${modules?.find((m) => m.lecons.some((l) => l.id === id))?.id}/lecons/${id}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: value.trim() }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      toast.error("Erreur", { description: json?.error });
      setRenaming(null);
      return;
    }
    setModules((prev) =>
      prev
        ? prev.map((m) =>
            kind === "module" && m.id === id
              ? { ...m, title: value.trim() }
              : { ...m, lecons: m.lecons.map((l) => (kind === "lecon" && l.id === id ? { ...l, title: value.trim() } : l)) }
          )
        : prev
    );
    setRenaming(null);
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/org/formations/${formationId}/publish`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Erreur", { description: json.error });
        return;
      }
      setPublished(true);
      toast.success("Formation publiée !");
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setPublishing(false);
    }
  }

  if (!modules) return <p className={styles.loading}>Chargement…</p>;

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        {modules.map((mod) => (
          <div key={mod.id} className={styles.sidebarModule}>
            <div className={styles.sidebarModuleHeader}>
              {renaming?.kind === "module" && renaming.id === mod.id ? (
                <RenameInput value={renaming.value} onChange={(v) => setRenaming({ kind: "module", id: mod.id, value: v })} onCommit={commitRename} onCancel={() => setRenaming(null)} />
              ) : (
                <>
                  <span className={styles.sidebarModuleTitle}>{mod.title}</span>
                  {!published && (
                    <div className={styles.sidebarModuleActions}>
                      <button type="button" className={styles.miniIconBtn} onClick={() => setRenaming({ kind: "module", id: mod.id, value: mod.title })} aria-label="Renommer le module">
                        <Pencil size={11} />
                      </button>
                      <button type="button" className={styles.miniIconBtnDanger} onClick={() => handleDeleteModule(mod.id)} aria-label="Supprimer le module">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            {mod.lecons.map((lecon) => (
              <div key={lecon.id} className={styles.sidebarLessonRow}>
                {renaming?.kind === "lecon" && renaming.id === lecon.id ? (
                  <RenameInput value={renaming.value} onChange={(v) => setRenaming({ kind: "lecon", id: lecon.id, value: v })} onCommit={commitRename} onCancel={() => setRenaming(null)} />
                ) : (
                  <>
                    <button
                      type="button"
                      className={`${styles.sidebarLesson} ${lecon.id === selectedLeconId ? styles.sidebarLessonActive : ""}`}
                      onClick={() => selectLecon(lecon.id)}
                    >
                      {lecon.validatedAt ? (
                        <CheckCircle2 size={14} className={styles.statusValidated} />
                      ) : lecon.hasContent ? (
                        <Clock size={14} className={styles.statusPending} />
                      ) : (
                        <Circle size={14} className={styles.statusEmpty} />
                      )}
                      <span className={styles.sidebarLessonTitle}>{lecon.title}</span>
                    </button>
                    {!published && (
                      <div className={styles.sidebarLessonActions}>
                        <button type="button" className={styles.miniIconBtn} onClick={() => setRenaming({ kind: "lecon", id: lecon.id, value: lecon.title })} aria-label="Renommer la leçon">
                          <Pencil size={11} />
                        </button>
                        <button type="button" className={styles.miniIconBtnDanger} onClick={() => handleDeleteLecon(mod.id, lecon.id)} aria-label="Supprimer la leçon">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {/* Ajouter reste possible même publiée (aucun risque pour la
                progression déjà acquise) — seuls renommer/supprimer restent
                verrouillés ci-dessus, voir handleDeleteLecon/commitRename. */}
            {leconMenuOpenFor === mod.id ? (
              <div className={styles.leconTypeMenu}>
                <button type="button" className={styles.leconTypeOption} onClick={() => handleAddLecon(mod.id, "rich")}>
                  <FileText size={13} />
                  Contenu
                </button>
                <button type="button" className={styles.leconTypeOption} onClick={() => handleAddLecon(mod.id, "quiz")}>
                  <ClipboardList size={13} />
                  Quiz
                </button>
                <button type="button" className={styles.leconTypeOption} onClick={() => handleAddLecon(mod.id, "video")}>
                  <Video size={13} />
                  Vidéo
                </button>
                <button type="button" className={styles.leconTypeCancel} onClick={() => setLeconMenuOpenFor(null)} aria-label="Annuler">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button type="button" className={styles.addLeconBtn} disabled={addingLeconTo === mod.id} onClick={() => setLeconMenuOpenFor(mod.id)}>
                <Plus size={12} />
                {addingLeconTo === mod.id ? "Ajout…" : "Ajouter une leçon"}
              </button>
            )}
          </div>
        ))}

        <button type="button" className={styles.addModuleBtn} disabled={addingModule} onClick={handleAddModule}>
          <Plus size={13} />
          {addingModule ? "Ajout…" : "Ajouter un module"}
        </button>

        <div className={styles.progressBox}>
          {validatedCount} / {allLecons.length} leçons validées
        </div>

        {/* Pas de quota pour le catalogue global (super_admin). */}
        {quota && space === "org" && (
          <div className={`${styles.quotaBox} ${quotaExhausted ? styles.quotaBoxExhausted : ""}`}>
            <Gauge size={13} />
            {quota.total === null
              ? `${quota.used} génération${quota.used > 1 ? "s" : ""} IA (illimité)`
              : `${quota.used} / ${quota.total} générations IA utilisées`}
          </div>
        )}

        {allValidated && !published && (
          <button type="button" className={styles.publishBtn} disabled={publishing} onClick={handlePublish}>
            <Rocket size={15} />
            {publishing ? "Publication…" : "Publier la formation"}
          </button>
        )}
        {published && (
          <div className={styles.publishedBox}>
            <CheckCircle2 size={15} />
            Formation publiée
          </div>
        )}
        {/* Vidéo d'accompagnement, puis description/niveau/durée dans l'éditeur
            admin — le flow IA ne renseigne pas ces champs du catalogue. */}
        {published && space === "admin" && (
          <Link href={`/admin/catalog/${formationId}/video`} className={styles.editDetailsLink}>
            Vidéo et fiche catalogue
          </Link>
        )}
      </aside>

      <main className={styles.main}>
        {!selectedLecon ? (
          <p className={styles.loading}>Sélectionnez une leçon.</p>
        ) : (
          <LessonPanel
            key={selectedLecon.id}
            ref={lessonPanelRef}
            formationId={formationId}
            lecon={selectedLecon}
            quotaExhausted={quotaExhausted}
            onUpdate={(patch) => updateLeconLocal(selectedLecon.id, patch)}
            onValidated={() => selectNextAfter(selectedLecon.id)}
            onQuotaUpdate={setQuota}
          />
        )}
      </main>
    </div>
  );
}

// Composant dédié par leçon, remonté à chaque changement de sélection (voir
// key={selectedLecon.id} ci-dessus) : son état local (editedBlocks) part
// toujours de la bonne valeur initiale sans jamais avoir besoin d'un effect
// pour le resynchroniser au changement de leçon (règle react-hooks/purity —
// même logique que le ref guard utilisé dans FormationChat.tsx).
export interface LessonPanelHandle {
  flushIfDirty: () => Promise<void>;
}

const LessonPanel = React.forwardRef<LessonPanelHandle, {
  formationId: string;
  lecon: Lesson;
  quotaExhausted: boolean;
  onUpdate: (patch: Partial<Lesson>) => void;
  onValidated: () => void;
  onQuotaUpdate: (quota: Quota) => void;
}>(function LessonPanel({ formationId, lecon, quotaExhausted, onUpdate, onValidated, onQuotaUpdate }, ref) {
  const [editedBlocks, setEditedBlocks] = React.useState<ContentBlock[]>(lecon.contentBlocks ?? []);
  const [editedVideoUrl, setEditedVideoUrl] = React.useState(lecon.videoUrl ?? "");
  const [videoUrlTouched, setVideoUrlTouched] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const isEditable = lecon.contentType === "rich" || lecon.contentType === "video";
  const videoEmbedUrl = lecon.contentType === "video" ? getVideoEmbedUrl(editedVideoUrl) : null;

  async function handleGenerate() {
    if (quotaExhausted) {
      toast.error("Quota de générations IA atteint. Contactez Ahead pour l'augmenter.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(`/api/org/formations/${formationId}/generation/${lecon.id}/generate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Erreur", { description: json.error });
        return;
      }
      if (json.data.quota) onQuotaUpdate(json.data.quota);
      if (lecon.contentType === "rich") {
        setEditedBlocks(json.data.blocks);
        setDirty(false);
        onUpdate({ hasContent: true, contentBlocks: json.data.blocks, validatedAt: null });
      } else {
        const quizQuestions = json.data.quiz.map((q: { question: string; options: string[]; correctIndex: number }, i: number) => ({
          question_text: q.question,
          options: q.options.map((text, oi) => ({ text, is_correct: oi === q.correctIndex })),
          order_index: i,
        }));
        onUpdate({ hasContent: true, quizQuestions, validatedAt: null });
      }
      toast.success(lecon.hasContent ? "Contenu régénéré." : "Contenu généré — relisez-le avant de valider.");
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveEdits(): Promise<boolean> {
    const isVideo = lecon.contentType === "video";
    const res = await fetch(`/api/org/formations/${formationId}/generation/${lecon.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isVideo ? { videoUrl: editedVideoUrl.trim() } : { blocks: editedBlocks }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error("Erreur lors de l'enregistrement", { description: json.error });
      return false;
    }
    if (isVideo) {
      onUpdate({ videoUrl: editedVideoUrl.trim(), hasContent: !!editedVideoUrl.trim(), validatedAt: null });
    } else {
      onUpdate({ contentBlocks: editedBlocks, validatedAt: null });
    }
    setDirty(false);
    return true;
  }

  async function handleSaveEdits() {
    setSaving(true);
    try {
      if (await saveEdits()) toast.success("Modifications enregistrées.");
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  // Exposé au parent (voir lessonPanelRef dans GenerationClient) pour
  // enregistrer silencieusement les modifications en cours avant de démonter
  // ce panneau (changement de leçon) — sans ça, des changements non cliqués
  // sur "Enregistrer" étaient perdus sans aucun avertissement.
  React.useImperativeHandle(ref, () => ({
    flushIfDirty: async () => {
      if (isEditable && dirty) {
        try {
          await saveEdits();
        } catch {
          // Le changement de leçon ne doit pas être bloqué par un échec
          // d'enregistrement réseau — au pire les modifications restent dans
          // editedBlocks/editedVideoUrl jusqu'au prochain clic manuel sur
          // "Enregistrer".
        }
      }
    },
  }));

  // Filet de sécurité pour la fermeture d'onglet / rechargement — le seul cas
  // que flushIfDirty() (déclenché par la navigation interne) ne couvre pas.
  React.useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  async function handleValidate() {
    setValidating(true);
    try {
      if (isEditable && dirty) {
        if (!(await saveEdits())) return;
      }

      const res = await fetch(`/api/org/formations/${formationId}/generation/${lecon.id}/validate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Erreur", { description: json.error });
        return;
      }
      onUpdate({ validatedAt: json.data.content_validated_at });
      toast.success("Leçon validée.");
      onValidated();
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setValidating(false);
    }
  }

  return (
    <>
      <div className={styles.lessonHeader}>
        <span className={styles.lessonTypeIcon}>
          {lecon.contentType === "quiz" ? <ClipboardList size={16} /> : lecon.contentType === "video" ? <Video size={16} /> : <GraduationCap size={16} />}
        </span>
        <div>
          <h2 className={styles.lessonTitle}>{lecon.title}</h2>
          {lecon.generationBrief && <p className={styles.lessonBrief}>{lecon.generationBrief}</p>}
        </div>
      </div>

      {lecon.contentType === "video" ? (
        <>
          <div className={styles.videoEditorWrap}>
            <label className={styles.videoUrlLabel}>URL de la vidéo</label>
            <input
              className={styles.videoUrlInput}
              placeholder="https://www.youtube.com/watch?v=… ou https://vimeo.com/…"
              value={editedVideoUrl}
              onChange={(e) => {
                setEditedVideoUrl(e.target.value);
                setVideoUrlTouched(true);
                setDirty(true);
              }}
            />
            {videoEmbedUrl ? (
              <div className={styles.videoPreviewWrap}>
                <iframe
                  src={videoEmbedUrl}
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            ) : (
              videoUrlTouched && editedVideoUrl.trim() && (
                <p className={styles.videoUrlError}>URL non reconnue — formats acceptés : YouTube (youtube.com, youtu.be) et Vimeo.</p>
              )
            )}
          </div>
          <div className={styles.actionsRow}>
            <button type="button" className={styles.secondaryBtn} disabled={saving || !dirty} onClick={handleSaveEdits}>
              <Save size={14} />
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" className={styles.primaryBtn} disabled={validating || !editedVideoUrl.trim()} onClick={handleValidate}>
              {validating ? "Validation…" : "Valider et passer à la leçon suivante"}
              <ArrowRight size={15} />
            </button>
          </div>
        </>
      ) : !lecon.hasContent ? (
        generating ? (
          <>
            <LessonWaitingPanel formationId={formationId} isQuiz={lecon.contentType === "quiz"} />
            <SkeletonBlocks />
          </>
        ) : (
          <div className={styles.emptyLesson}>
            <Sparkles size={26} className={styles.emptyLessonIcon} />
            <p className={styles.emptyLessonText}>Aucun contenu généré pour cette leçon pour l&apos;instant.</p>
            {quotaExhausted && <p className={styles.quotaWarning}>Quota de générations IA atteint — contactez Ahead pour l&apos;augmenter.</p>}
            <button type="button" className={styles.primaryBtn} disabled={generating || quotaExhausted} onClick={handleGenerate}>
              {generating ? "Génération en cours…" : "Générer le contenu"}
            </button>
          </div>
        )
      ) : (
        <>
          {generating && <LessonWaitingPanel formationId={formationId} isQuiz={lecon.contentType === "quiz"} />}
          {lecon.contentType === "rich" ? (
            <div className={styles.editorWrap}>
              <BlockEditor
                blocks={editedBlocks}
                onChange={(blocks) => {
                  setEditedBlocks(blocks);
                  setDirty(true);
                }}
              />
            </div>
          ) : (
            <div className={styles.quizList}>
              {(lecon.quizQuestions ?? []).map((q, qi) => (
                <div key={qi} className={styles.quizQuestion}>
                  <p className={styles.quizQuestionText}>
                    {qi + 1}. {q.question_text}
                  </p>
                  <ul className={styles.quizOptions}>
                    {q.options.map((opt, oi) => (
                      <li key={oi} className={opt.is_correct ? styles.quizOptionCorrect : styles.quizOption}>
                        {opt.is_correct && <CheckCircle2 size={13} />}
                        {opt.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className={styles.actionsRow}>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={generating || quotaExhausted}
              title={quotaExhausted ? "Quota de générations IA atteint" : undefined}
              onClick={handleGenerate}
            >
              <RefreshCw size={14} className={generating ? styles.spin : undefined} />
              {generating ? "Régénération…" : "Régénérer"}
            </button>
            {lecon.contentType === "rich" && (
              <button type="button" className={styles.secondaryBtn} onClick={() => setPreviewOpen(true)}>
                <Eye size={14} />
                Aperçu
              </button>
            )}
            {lecon.contentType === "rich" && (
              <button type="button" className={styles.secondaryBtn} disabled={saving || !dirty} onClick={handleSaveEdits}>
                <Save size={14} />
                {saving ? "Enregistrement…" : "Enregistrer les modifications"}
              </button>
            )}
            <button type="button" className={styles.primaryBtn} disabled={validating} onClick={handleValidate}>
              {validating ? "Validation…" : "Valider et passer à la leçon suivante"}
              <ArrowRight size={15} />
            </button>
          </div>
        </>
      )}

      {previewOpen && (
        <PreviewModal title={lecon.title} blocks={editedBlocks} onClose={() => setPreviewOpen(false)} />
      )}
    </>
  );
});

// Aperçu fidèle à 100% : réutilise BlockRenderer, le même composant qui
// affiche le contenu côté apprenant (LessonView.tsx) — pas de réimplémentation
// qui risquerait de diverger du rendu réel. Affiche editedBlocks (donc les
// modifications pas encore enregistrées), conformément à la demande de voir
// l'aperçu "durant la construction".
function PreviewModal({ title, blocks, onClose }: { title: string; blocks: ContentBlock[]; onClose: () => void }) {
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className={styles.previewOverlay} onClick={onClose}>
      <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.previewHeader}>
          <span className={styles.previewHeaderTitle}>
            <Eye size={13} />
            Aperçu — {title}
          </span>
          <button type="button" className={styles.previewCloseBtn} onClick={onClose} aria-label="Fermer l'aperçu">
            <X size={15} />
          </button>
        </div>
        <div className={styles.previewBody}>
          <BlockRenderer blocks={blocks} />
        </div>
      </div>
    </div>
  );
}

// Skeleton affiché pendant la toute première génération d'une leçon (le
// panneau était figé sur le message "Aucun contenu généré" + un bouton
// désactivé pendant potentiellement de longues secondes) — la régénération
// d'un contenu déjà existant garde son propre indicateur (icône qui tourne),
// l'ancien contenu restant visible pendant le remplacement.
// Durées mesurées avec le modèle de génération sur un vrai document : ~28 s
// pour une leçon, ~16 s pour un quiz.
function LessonWaitingPanel({ formationId, isQuiz }: { formationId: string; isQuiz: boolean }) {
  return isQuiz ? (
    <WaitingPanel
      formationId={formationId}
      estimatedSeconds={18}
      steps={["Recherche des passages du module dans vos documents", "Rédaction des questions", "Vérification des bonnes réponses"]}
    />
  ) : (
    <WaitingPanel
      formationId={formationId}
      estimatedSeconds={30}
      steps={["Recherche des passages pertinents dans vos documents", "Rédaction de la leçon", "Mise en forme des blocs"]}
    />
  );
}

function SkeletonBlocks() {
  return (
    <div className={styles.skeleton}>
      <div className={`${styles.skeletonBar} ${styles.skeletonHeading}`} />
      <div className={`${styles.skeletonBar} ${styles.skeletonLine}`} />
      <div className={`${styles.skeletonBar} ${styles.skeletonLine}`} />
      <div className={`${styles.skeletonBar} ${styles.skeletonLineShort}`} />
      <div className={`${styles.skeletonBar} ${styles.skeletonCallout}`} />
      <div className={`${styles.skeletonBar} ${styles.skeletonLine}`} />
      <div className={`${styles.skeletonBar} ${styles.skeletonLineShort}`} />
    </div>
  );
}
