"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import {
  ChevronRight, ChevronUp, ChevronDown,
  Trash2, Plus, FileText, Layers, Save, X, Eye, CheckCircle, Circle,
} from "lucide-react";
import { getVideoEmbedUrl } from "@/lib/video";
import styles from "./editor.module.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

// ── Types ──────────────────────────────────────────────
interface Formation { id: string; title: string; description: string | null; is_published: boolean; slug: string; niveau: "debutant" | "intermediaire" | "avance" | null; }
interface Module { id: string; formation_id: string; title: string; order_index: number; }
interface Lesson { id: string; module_id: string; title: string; content_type: string; content_markdown: string | null; video_url: string | null; order_index: number; }
type Selection =
  | { type: "formation" }
  | { type: "module"; id: string }
  | { type: "lesson"; id: string; moduleId: string };

// ── Modal composants ───────────────────────────────────
interface InputModalProps {
  title: string;
  subtitle?: string;
  placeholder: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}
function InputModal({ title, subtitle, placeholder, confirmLabel, onConfirm, onClose }: InputModalProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (value.trim()) { onConfirm(value.trim()); }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <p className={styles.modalTitle}>{title}</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        {subtitle && <p className={styles.modalSub}>{subtitle}</p>}
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>Annuler</button>
            <button type="submit" className={styles.btnConfirm} disabled={!value.trim()}>{confirmLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}
function ConfirmModal({ title, message, onConfirm, onClose }: ConfirmModalProps) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <p className={styles.modalTitle}>{title}</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <p className={styles.modalSub}>{message}</p>
        <div className={styles.modalActions}>
          <button className={styles.btnCancel} onClick={onClose}>Annuler</button>
          <button className={styles.btnDanger} onClick={() => { onConfirm(); onClose(); }}>Supprimer</button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────
export default function FormationEditorPage() {
  const { id } = useParams<{ id: string }>();

  const [formation, setFormation] = useState<Formation | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Record<string, Lesson[]>>({});
  const [selected, setSelected] = useState<Selection>({ type: "formation" });
  const [loading, setLoading] = useState(true);

  // Modals state
  const [addModuleModal, setAddModuleModal] = useState(false);
  const [addLessonModal, setAddLessonModal] = useState<string | null>(null); // moduleId
  const [deleteModuleModal, setDeleteModuleModal] = useState<string | null>(null);
  const [deleteLessonModal, setDeleteLessonModal] = useState<{ moduleId: string; lessonId: string } | null>(null);

  // ── Load data ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [fRes, mRes] = await Promise.all([
        fetch(`/api/formations/${id}`),
        fetch(`/api/formations/${id}/modules`),
      ]);
      if (cancelled || !fRes.ok) return;

      const fJson = await fRes.json();
      const mJson = mRes.ok ? await mRes.json() : { data: [] };
      const sorted: Module[] = (mJson.data ?? []).sort(
        (a: Module, b: Module) => a.order_index - b.order_index
      );

      const lessonMap: Record<string, Lesson[]> = {};
      await Promise.all(
        sorted.map(async (m) => {
          const lRes = await fetch(`/api/formations/${id}/modules/${m.id}/lecons`);
          if (lRes.ok) {
            const lJson = await lRes.json();
            lessonMap[m.id] = (lJson.data ?? []).sort(
              (a: Lesson, b: Lesson) => a.order_index - b.order_index
            );
          }
        })
      );

      if (cancelled) return;
      setFormation(fJson.data);
      setModules(sorted);
      setLessons(lessonMap);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [id]);

  // ── Module actions ──
  async function handleAddModule(title: string) {
    const res = await fetch(`/api/formations/${id}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, order_index: modules.length }),
    });
    if (res.ok) {
      const json = await res.json();
      setModules((prev) => [...prev, json.data]);
      setLessons((prev) => ({ ...prev, [json.data.id]: [] }));
    }
  }

  async function handleDeleteModule(moduleId: string) {
    await fetch(`/api/formations/${id}/modules/${moduleId}`, { method: "DELETE" });
    setModules((prev) => prev.filter((m) => m.id !== moduleId));
    setLessons((prev) => { const n = { ...prev }; delete n[moduleId]; return n; });
    if (selected.type === "module" && selected.id === moduleId) setSelected({ type: "formation" });
  }

  async function moveModule(moduleId: string, dir: -1 | 1) {
    const idx = modules.findIndex((m) => m.id === moduleId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= modules.length) return;
    const reordered = [...modules];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const updated = reordered.map((m, i) => ({ ...m, order_index: i }));
    setModules(updated);
    await Promise.all(
      updated.map((m) =>
        fetch(`/api/formations/${id}/modules/${m.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_index: m.order_index }),
        })
      )
    );
  }

  // ── Lesson actions ──
  async function handleAddLesson(moduleId: string, title: string) {
    const existing = lessons[moduleId] ?? [];
    const res = await fetch(`/api/formations/${id}/modules/${moduleId}/lecons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content_type: "markdown", order_index: existing.length }),
    });
    if (res.ok) {
      const json = await res.json();
      setLessons((prev) => ({ ...prev, [moduleId]: [...(prev[moduleId] ?? []), json.data] }));
    }
  }

  async function handleDeleteLesson(moduleId: string, lessonId: string) {
    await fetch(`/api/formations/${id}/modules/${moduleId}/lecons/${lessonId}`, { method: "DELETE" });
    setLessons((prev) => ({ ...prev, [moduleId]: prev[moduleId].filter((l) => l.id !== lessonId) }));
    if (selected.type === "lesson" && selected.id === lessonId) setSelected({ type: "module", id: moduleId });
  }

  async function moveLesson(moduleId: string, lessonId: string, dir: -1 | 1) {
    const list = lessons[moduleId] ?? [];
    const idx = list.findIndex((l) => l.id === lessonId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= list.length) return;
    const reordered = [...list];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const updated = reordered.map((l, i) => ({ ...l, order_index: i }));
    setLessons((prev) => ({ ...prev, [moduleId]: updated }));
    await Promise.all(
      updated.map((l) =>
        fetch(`/api/formations/${id}/modules/${moduleId}/lecons/${l.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_index: l.order_index }),
        })
      )
    );
  }

  if (loading) return <div className={styles.loading}>Chargement…</div>;
  if (!formation) return <div className={styles.loading}>Formation introuvable.</div>;

  return (
    <>
      {/* ── Modals ── */}
      {addModuleModal && (
        <InputModal
          title="Nouveau module"
          subtitle="Donnez un titre clair à ce module de formation."
          placeholder="Ex : Introduction à l'IA générative"
          confirmLabel="Créer le module"
          onConfirm={(title) => { handleAddModule(title); setAddModuleModal(false); }}
          onClose={() => setAddModuleModal(false)}
        />
      )}
      {addLessonModal && (
        <InputModal
          title="Nouvelle leçon"
          subtitle="Donnez un titre à cette leçon."
          placeholder="Ex : Les fondamentaux du prompt"
          confirmLabel="Créer la leçon"
          onConfirm={(title) => { handleAddLesson(addLessonModal, title); setAddLessonModal(null); }}
          onClose={() => setAddLessonModal(null)}
        />
      )}
      {deleteModuleModal && (
        <ConfirmModal
          title="Supprimer ce module ?"
          message="Toutes les leçons de ce module seront supprimées définitivement. Cette action est irréversible."
          onConfirm={() => handleDeleteModule(deleteModuleModal)}
          onClose={() => setDeleteModuleModal(null)}
        />
      )}
      {deleteLessonModal && (
        <ConfirmModal
          title="Supprimer cette leçon ?"
          message="Le contenu de cette leçon sera supprimé définitivement."
          onConfirm={() => handleDeleteLesson(deleteLessonModal.moduleId, deleteLessonModal.lessonId)}
          onClose={() => setDeleteLessonModal(null)}
        />
      )}

      <div className={styles.shell}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          {/* ── Topbar éditeur ── */}
          <div className={styles.editorTopbar}>
            <nav className={styles.breadcrumb}>
              <Link href="/admin/catalog">Catalogue</Link>
              <ChevronRight size={14} />
              <span className={styles.breadcrumbCurrent}>{formation.title}</span>
            </nav>
            <div className={styles.topbarActions}>
              <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
                {formation.is_published ? "✓ Publié" : "Brouillon"}
              </span>
            </div>
          </div>

          <div className={styles.body}>
            {/* ── Structure (gauche) ── */}
            <aside className={styles.structure}>
              <div className={styles.structureHeader}>Structure</div>

              {/* Formation */}
              <div
                className={`${styles.treeItem} ${styles.treeFormation} ${selected.type === "formation" ? styles.treeItemActive : ""}`}
                onClick={() => setSelected({ type: "formation" })}
              >
                <span className={styles.treeItemLabel}>{formation.title}</span>
              </div>

              {/* Modules + leçons */}
              {modules.map((mod, mIdx) => (
                <div key={mod.id}>
                  <div
                    className={`${styles.treeItem} ${styles.treeModule} ${selected.type === "module" && selected.id === mod.id ? styles.treeItemActive : ""}`}
                    onClick={() => setSelected({ type: "module", id: mod.id })}
                  >
                    <Layers size={13} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                    <span className={styles.treeItemLabel}>{mod.title}</span>
                    <div className={styles.treeActions} onClick={(e) => e.stopPropagation()}>
                      <button className={styles.treeBtn} onClick={() => moveModule(mod.id, -1)} disabled={mIdx === 0}><ChevronUp size={12} /></button>
                      <button className={styles.treeBtn} onClick={() => moveModule(mod.id, 1)} disabled={mIdx === modules.length - 1}><ChevronDown size={12} /></button>
                      <button className={`${styles.treeBtn} ${styles.treeBtnDanger}`} onClick={() => setDeleteModuleModal(mod.id)}><Trash2 size={12} /></button>
                    </div>
                  </div>

                  {(lessons[mod.id] ?? []).map((lesson, lIdx) => (
                    <div
                      key={lesson.id}
                      className={`${styles.treeItem} ${styles.treeLesson} ${selected.type === "lesson" && selected.id === lesson.id ? styles.treeItemActive : ""}`}
                      onClick={() => setSelected({ type: "lesson", id: lesson.id, moduleId: mod.id })}
                    >
                      <FileText size={12} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                      <span className={styles.treeItemLabel}>{lesson.title}</span>
                      <div className={styles.treeActions} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.treeBtn} onClick={() => moveLesson(mod.id, lesson.id, -1)} disabled={lIdx === 0}><ChevronUp size={12} /></button>
                        <button className={styles.treeBtn} onClick={() => moveLesson(mod.id, lesson.id, 1)} disabled={lIdx === (lessons[mod.id]?.length ?? 0) - 1}><ChevronDown size={12} /></button>
                        <button className={`${styles.treeBtn} ${styles.treeBtnDanger}`} onClick={() => setDeleteLessonModal({ moduleId: mod.id, lessonId: lesson.id })}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}

                  <button className={styles.addLessonBtn} onClick={() => setAddLessonModal(mod.id)}>
                    <Plus size={12} /> Ajouter une leçon
                  </button>
                </div>
              ))}

              <button className={styles.addModuleBtn} onClick={() => setAddModuleModal(true)}>
                <Plus size={14} /> Ajouter un module
              </button>
            </aside>

            {/* ── Contenu (droite) ── */}
            <main className={styles.content}>
              <div className={styles.contentInner}>
                {selected.type === "formation" && (
                  <FormationPanel formation={formation} onSave={setFormation} />
                )}
                {selected.type === "module" && (
                  <ModulePanel
                    key={selected.id}
                    module={modules.find((m) => m.id === selected.id)!}
                    formationId={id}
                    onSave={(updated) => setModules((prev) => prev.map((m) => m.id === updated.id ? updated : m))}
                  />
                )}
                {selected.type === "lesson" && (() => {
                  const lesson = (lessons[selected.moduleId] ?? []).find((l) => l.id === selected.id);
                  if (!lesson) return null;
                  return (
                    <LessonPanel
                      key={lesson.id}
                      lesson={lesson}
                      formationId={id}
                      onSave={(updated) =>
                        setLessons((prev) => ({
                          ...prev,
                          [selected.moduleId]: prev[selected.moduleId].map((l) => l.id === updated.id ? updated : l),
                        }))
                      }
                    />
                  );
                })()}
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Formation panel ────────────────────────────────────
function FormationPanel({ formation, onSave }: { formation: Formation; onSave: (f: Formation) => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: formation.title,
    description: formation.description ?? "",
    niveau: formation.niveau ?? "",
    is_published: formation.is_published,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/formations/${formation.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, niveau: form.niveau || null }),
    });
    if (res.ok) {
      const json = await res.json();
      onSave(json.data);
      toast.success("Formation enregistrée", { description: `"${json.data.title}" a été mise à jour.` });
      router.push("/admin/catalog");
    } else {
      toast.error("Erreur lors de l'enregistrement", { description: "Vérifiez les champs et réessayez." });
    }
    setSaving(false);
  }

  return (
    <>
      <h2 className={styles.panelTitle}>Informations de la formation</h2>
      <div className={styles.formCard}>
        <div className={styles.field}>
          <label className={styles.label}>Titre</label>
          <input
            className={styles.input}
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Description</label>
          <textarea
            className={styles.textarea}
            rows={4}
            placeholder="Décrivez le contenu et les objectifs de cette formation…"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Niveau de difficulté</label>
          <select
            className={styles.select}
            value={form.niveau}
            onChange={(e) => setForm((p) => ({ ...p, niveau: e.target.value }))}
          >
            <option value="">— Non défini —</option>
            <option value="debutant">Débutant</option>
            <option value="intermediaire">Intermédiaire</option>
            <option value="avance">Avancé</option>
          </select>
        </div>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.is_published}
            onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
          />
          Publier cette formation
        </label>
        <div className={styles.saveRow}>
          <button className={styles.btnSave} onClick={save} disabled={saving}>
            <Save size={14} />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Module panel ───────────────────────────────────────
function ModulePanel({ module, formationId, onSave }: { module: Module; formationId: string; onSave: (m: Module) => void }) {
  const [title, setTitle] = useState(module.title);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/formations/${formationId}/modules/${module.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const json = await res.json();
      onSave(json.data);
      toast.success("Module enregistré");
    } else {
      toast.error("Erreur lors de l'enregistrement");
    }
    setSaving(false);
  }

  return (
    <>
      <h2 className={styles.panelTitle}>Modifier le module</h2>
      <div className={styles.formCard}>
        <div className={styles.field}>
          <label className={styles.label}>Titre du module</label>
          <input
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className={styles.saveRow}>
          <button className={styles.btnSave} onClick={save} disabled={saving}>
            <Save size={14} />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Quiz builder ───────────────────────────────────────
interface QuizOption { text: string; is_correct: boolean; }
interface QuizQuestion { question_text: string; options: QuizOption[]; points: number; }
interface QuizData { id: string; title: string; pass_score: number; quiz_questions: (QuizQuestion & { id: string })[]; }

function QuizBuilder({ lesson, formationId }: { lesson: Lesson; formationId: string }) {
  const [quizId, setQuizId] = useState<string | null>(null);
  const [title, setTitle] = useState("Quiz");
  const [passScore, setPassScore] = useState(70);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/formations/${formationId}/modules/${lesson.module_id}/lecons/${lesson.id}/quiz`
      );
      if (cancelled) return;
      const json = await res.json();
      if (json.data) {
        const q: QuizData = json.data;
        setQuizId(q.id);
        setTitle(q.title);
        setPassScore(q.pass_score);
        setQuestions(
          [...(q.quiz_questions ?? [])].sort((a, b) => (a as never as { order_index: number }).order_index - (b as never as { order_index: number }).order_index)
            .map(({ question_text, options, points }) => ({ question_text, options, points }))
        );
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [lesson.id, lesson.module_id, formationId]);

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      { question_text: "", options: [{ text: "", is_correct: true }, { text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false }], points: 1 },
    ]);
  }

  function removeQuestion(qi: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== qi));
  }

  function updateQuestionText(qi: number, text: string) {
    setQuestions((prev) => prev.map((q, i) => i === qi ? { ...q, question_text: text } : q));
  }

  function setCorrect(qi: number, oi: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i !== qi ? q : { ...q, options: q.options.map((o, j) => ({ ...o, is_correct: j === oi })) }
      )
    );
  }

  function updateOptionText(qi: number, oi: number, text: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i !== qi ? q : { ...q, options: q.options.map((o, j) => j === oi ? { ...o, text } : o) }
      )
    );
  }

  function addOption(qi: number) {
    setQuestions((prev) =>
      prev.map((q, i) => i !== qi ? q : { ...q, options: [...q.options, { text: "", is_correct: false }] })
    );
  }

  function removeOption(qi: number, oi: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qi) return q;
        const newOptions = q.options.filter((_, j) => j !== oi);
        const hasCorrect = newOptions.some((o) => o.is_correct);
        if (!hasCorrect && newOptions.length > 0) newOptions[0].is_correct = true;
        return { ...q, options: newOptions };
      })
    );
  }

  async function save() {
    for (const q of questions) {
      if (!q.question_text.trim()) { toast.error("Une question est vide."); return; }
      if (q.options.length < 2) { toast.error("Chaque question doit avoir au moins 2 options."); return; }
      if (!q.options.some((o) => o.is_correct)) { toast.error("Chaque question doit avoir une bonne réponse."); return; }
    }
    setSaving(true);
    const body = { title, pass_score: passScore, questions };
    const method = quizId ? "PUT" : "POST";
    const res = await fetch(
      `/api/formations/${formationId}/modules/${lesson.module_id}/lecons/${lesson.id}/quiz`,
      { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    if (res.ok) {
      const json = await res.json();
      setQuizId(json.data.id);
      toast.success("Quiz enregistré", { description: `${questions.length} question(s)` });
    } else {
      toast.error("Erreur lors de l'enregistrement");
    }
    setSaving(false);
  }

  if (loading) return <div className={styles.loading}>Chargement du quiz…</div>;

  return (
    <>
      <h2 className={styles.panelTitle}>Créer le quiz</h2>
      <div className={styles.formCard}>
        <div style={{ display: "flex", gap: 16 }}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label}>Titre du quiz</label>
            <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className={styles.field} style={{ width: 140 }}>
            <label className={styles.label}>Score minimum (%)</label>
            <input className={styles.input} type="number" min={0} max={100} value={passScore} onChange={(e) => setPassScore(Number(e.target.value))} />
          </div>
        </div>

        {questions.map((q, qi) => (
          <div key={qi} className={styles.quizQuestion}>
            <div className={styles.quizQuestionHeader}>
              <span className={styles.quizQuestionIndex}>Question {qi + 1}</span>
              <button className={styles.quizBtnRemove} onClick={() => removeQuestion(qi)}><Trash2 size={13} /></button>
            </div>
            <input
              className={styles.input}
              placeholder="Énoncé de la question…"
              value={q.question_text}
              onChange={(e) => updateQuestionText(qi, e.target.value)}
              style={{ marginBottom: 10 }}
            />
            <div className={styles.quizOptions}>
              {q.options.map((o, oi) => (
                <div key={oi} className={styles.quizOption}>
                  <button
                    className={styles.quizRadio}
                    onClick={() => setCorrect(qi, oi)}
                    title="Définir comme bonne réponse"
                  >
                    {o.is_correct ? <CheckCircle size={16} color="var(--coral)" /> : <Circle size={16} color="var(--text-light)" />}
                  </button>
                  <input
                    className={styles.input}
                    placeholder={`Option ${oi + 1}`}
                    value={o.text}
                    onChange={(e) => updateOptionText(qi, oi, e.target.value)}
                    style={{ flex: 1 }}
                  />
                  {q.options.length > 2 && (
                    <button className={styles.quizBtnRemove} onClick={() => removeOption(qi, oi)}><X size={12} /></button>
                  )}
                </div>
              ))}
            </div>
            {q.options.length < 5 && (
              <button className={styles.quizAddOption} onClick={() => addOption(qi)}>
                <Plus size={12} /> Ajouter une option
              </button>
            )}
          </div>
        ))}

        <button className={styles.quizAddQuestion} onClick={addQuestion}>
          <Plus size={14} /> Ajouter une question
        </button>

        <div className={styles.saveRow}>
          <button className={styles.btnSave} onClick={save} disabled={saving || questions.length === 0}>
            <Save size={14} />
            {saving ? "Enregistrement…" : "Enregistrer le quiz"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Lesson panel ───────────────────────────────────────
function LessonPanel({ lesson, formationId, onSave }: { lesson: Lesson; formationId: string; onSave: (l: Lesson) => void }) {
  const [form, setForm] = useState({
    title: lesson.title,
    content_type: lesson.content_type,
    content_markdown: lesson.content_markdown ?? "",
    video_url: lesson.video_url ?? "",
  });
  const [saving, setSaving] = useState(false);

  const embedUrl = form.content_type === "video" ? getVideoEmbedUrl(form.video_url) : null;

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/formations/${formationId}/modules/${lesson.module_id}/lecons/${lesson.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        video_url: form.video_url.trim() || null,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      onSave(json.data);
      toast.success("Leçon enregistrée");
    } else {
      toast.error("Erreur lors de l'enregistrement");
    }
    setSaving(false);
  }

  return (
    <>
      <h2 className={styles.panelTitle}>Modifier la leçon</h2>
      <div className={styles.formCard}>
        <div className={styles.field}>
          <label className={styles.label}>Titre</label>
          <input
            className={styles.input}
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Type de contenu</label>
          <select
            className={styles.select}
            value={form.content_type}
            onChange={(e) => setForm((p) => ({ ...p, content_type: e.target.value }))}
          >
            <option value="markdown">Markdown</option>
            <option value="video">Vidéo</option>
            <option value="quiz">Quiz</option>
          </select>
        </div>
        {form.content_type === "markdown" && (
          <div className={styles.field}>
            <label className={styles.label}>Contenu</label>
            <div className={styles.mdEditorWrap} data-color-mode="light">
              <MDEditor
                value={form.content_markdown}
                onChange={(val) => setForm((p) => ({ ...p, content_markdown: val ?? "" }))}
                height={420}
                preview="live"
              />
            </div>
          </div>
        )}
        {form.content_type === "video" && (
          <div className={styles.field}>
            <label className={styles.label}>URL de la vidéo</label>
            <input
              className={styles.input}
              placeholder="https://www.youtube.com/watch?v=… ou https://vimeo.com/…"
              value={form.video_url}
              onChange={(e) => setForm((p) => ({ ...p, video_url: e.target.value }))}
            />
            <p className={styles.hint}>Formats acceptés : YouTube (youtube.com, youtu.be) et Vimeo</p>
            {embedUrl && (
              <div className={styles.videoPreview}>
                <iframe
                  src={embedUrl}
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            )}
            {form.video_url && !embedUrl && (
              <p className={styles.videoError}>URL non reconnue. Vérifiez le format.</p>
            )}
          </div>
        )}
        <div className={styles.saveRow}>
          <a
            href={`/apprenant/${formationId}/${lesson.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnPreview}
          >
            <Eye size={14} />
            Aperçu apprenant
          </a>
          <button className={styles.btnSave} onClick={save} disabled={saving}>
            <Save size={14} />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
      {form.content_type === "quiz" && (
        <div style={{ marginTop: 32 }}>
          <QuizBuilder lesson={lesson} formationId={formationId} />
        </div>
      )}
    </>
  );
}
