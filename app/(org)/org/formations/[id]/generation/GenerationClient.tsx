"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Sparkles, RefreshCw, CheckCircle2, Circle, Clock,
  GraduationCap, ClipboardList, Save, ArrowRight, Rocket, Gauge,
  Plus, Trash2, Pencil, Check, X,
} from "lucide-react";
import BlockEditor from "@/components/lessons/BlockEditor";
import type { ContentBlock } from "@/lib/ai/contentBlocks";
import styles from "./generation.module.css";

type ContentType = "rich" | "quiz";

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
}: {
  formationId: string;
  alreadyPublished: boolean;
}) {
  const [modules, setModules] = React.useState<ModuleGroup[] | null>(null);
  const [quota, setQuota] = React.useState<Quota | null>(null);
  const [selectedLeconId, setSelectedLeconId] = React.useState<string | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [published, setPublished] = React.useState(alreadyPublished);
  const [addingModule, setAddingModule] = React.useState(false);
  const [addingLeconTo, setAddingLeconTo] = React.useState<string | null>(null);
  const [renaming, setRenaming] = React.useState<{ kind: "module" | "lecon"; id: string; value: string } | null>(null);
  const fetchedRef = React.useRef(false);

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

  async function handleAddModule() {
    setAddingModule(true);
    try {
      const res = await fetch(`/api/org/formations/${formationId}/generation/modules`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Erreur", { description: json.error });
        return;
      }
      setModules((prev) => [...(prev ?? []), { id: json.data.id, title: json.data.title, lecons: json.data.lecons }]);
      setSelectedLeconId(json.data.lecons[0].id);
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

  async function handleAddLecon(moduleId: string) {
    setAddingLeconTo(moduleId);
    try {
      const res = await fetch(`/api/org/formations/${formationId}/generation/modules/${moduleId}/lecons`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Erreur", { description: json.error });
        return;
      }
      setModules((prev) => (prev ? prev.map((m) => (m.id === moduleId ? { ...m, lecons: [...m.lecons, json.data] } : m)) : prev));
      setSelectedLeconId(json.data.id);
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
                      onClick={() => setSelectedLeconId(lecon.id)}
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
            {!published && (
              <button type="button" className={styles.addLeconBtn} disabled={addingLeconTo === mod.id} onClick={() => handleAddLecon(mod.id)}>
                <Plus size={12} />
                {addingLeconTo === mod.id ? "Ajout…" : "Ajouter une leçon"}
              </button>
            )}
          </div>
        ))}

        {!published && (
          <button type="button" className={styles.addModuleBtn} disabled={addingModule} onClick={handleAddModule}>
            <Plus size={13} />
            {addingModule ? "Ajout…" : "Ajouter un module"}
          </button>
        )}

        <div className={styles.progressBox}>
          {validatedCount} / {allLecons.length} leçons validées
        </div>

        {quota && (
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
      </aside>

      <main className={styles.main}>
        {!selectedLecon ? (
          <p className={styles.loading}>Sélectionnez une leçon.</p>
        ) : (
          <LessonPanel
            key={selectedLecon.id}
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
function LessonPanel({
  formationId,
  lecon,
  quotaExhausted,
  onUpdate,
  onValidated,
  onQuotaUpdate,
}: {
  formationId: string;
  lecon: Lesson;
  quotaExhausted: boolean;
  onUpdate: (patch: Partial<Lesson>) => void;
  onValidated: () => void;
  onQuotaUpdate: (quota: Quota) => void;
}) {
  const [editedBlocks, setEditedBlocks] = React.useState<ContentBlock[]>(lecon.contentBlocks ?? []);
  const [dirty, setDirty] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [validating, setValidating] = React.useState(false);

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
    const res = await fetch(`/api/org/formations/${formationId}/generation/${lecon.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks: editedBlocks }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error("Erreur lors de l'enregistrement", { description: json.error });
      return false;
    }
    onUpdate({ contentBlocks: editedBlocks, validatedAt: null });
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

  async function handleValidate() {
    setValidating(true);
    try {
      if (lecon.contentType === "rich" && dirty) {
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
          {lecon.contentType === "quiz" ? <ClipboardList size={16} /> : <GraduationCap size={16} />}
        </span>
        <div>
          <h2 className={styles.lessonTitle}>{lecon.title}</h2>
          {lecon.generationBrief && <p className={styles.lessonBrief}>{lecon.generationBrief}</p>}
        </div>
      </div>

      {!lecon.hasContent ? (
        <div className={styles.emptyLesson}>
          <Sparkles size={26} className={styles.emptyLessonIcon} />
          <p className={styles.emptyLessonText}>Aucun contenu généré pour cette leçon pour l&apos;instant.</p>
          {quotaExhausted && <p className={styles.quotaWarning}>Quota de générations IA atteint — contactez Ahead pour l&apos;augmenter.</p>}
          <button type="button" className={styles.primaryBtn} disabled={generating || quotaExhausted} onClick={handleGenerate}>
            {generating ? "Génération en cours…" : "Générer le contenu"}
          </button>
        </div>
      ) : (
        <>
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
    </>
  );
}
