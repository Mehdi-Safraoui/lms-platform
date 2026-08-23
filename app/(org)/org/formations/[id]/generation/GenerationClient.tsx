"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Sparkles, RefreshCw, CheckCircle2, Circle, Clock,
  GraduationCap, ClipboardList, Save, ArrowRight, Rocket,
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

function flatten(modules: ModuleGroup[]): Lesson[] {
  return modules.flatMap((m) => m.lecons);
}

export default function GenerationClient({
  formationId,
  alreadyPublished,
}: {
  formationId: string;
  alreadyPublished: boolean;
}) {
  const [modules, setModules] = React.useState<ModuleGroup[] | null>(null);
  const [selectedLeconId, setSelectedLeconId] = React.useState<string | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [published, setPublished] = React.useState(alreadyPublished);
  const fetchedRef = React.useRef(false);

  React.useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetch(`/api/org/formations/${formationId}/generation`)
      .then((res) => res.json())
      .then((json) => {
        setModules(json.data);
        const first = flatten(json.data)[0];
        if (first) setSelectedLeconId(first.id);
      });
  }, [formationId]);

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
            <span className={styles.sidebarModuleTitle}>{mod.title}</span>
            {mod.lecons.map((lecon) => (
              <button
                key={lecon.id}
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
            ))}
          </div>
        ))}

        <div className={styles.progressBox}>
          {validatedCount} / {allLecons.length} leçons validées
        </div>

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
            onUpdate={(patch) => updateLeconLocal(selectedLecon.id, patch)}
            onValidated={() => selectNextAfter(selectedLecon.id)}
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
  onUpdate,
  onValidated,
}: {
  formationId: string;
  lecon: Lesson;
  onUpdate: (patch: Partial<Lesson>) => void;
  onValidated: () => void;
}) {
  const [editedBlocks, setEditedBlocks] = React.useState<ContentBlock[]>(lecon.contentBlocks ?? []);
  const [dirty, setDirty] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [validating, setValidating] = React.useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/org/formations/${formationId}/generation/${lecon.id}/generate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Erreur", { description: json.error });
        return;
      }
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
          <button type="button" className={styles.primaryBtn} disabled={generating} onClick={handleGenerate}>
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
            <button type="button" className={styles.secondaryBtn} disabled={generating} onClick={handleGenerate}>
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
