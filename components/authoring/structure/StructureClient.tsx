"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles, RefreshCw, Plus, Trash2, ChevronUp, ChevronDown,
  CheckCircle2, ClipboardList, GraduationCap, ArrowRight,
} from "lucide-react";
import styles from "./structure.module.css";

type ContentType = "lesson" | "quiz";

/**
 * Description de leçon affichée en entier : la hauteur suit le contenu au lieu
 * d'un bloc de 2 lignes avec barre de défilement interne.
 */
function AutoGrowTextarea({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const fit = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  React.useLayoutEffect(fit, [value, fit]);
  React.useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

  return <textarea ref={ref} className={className} value={value} rows={1} onChange={(e) => onChange(e.target.value)} />;
}

interface StructureLessonDraft {
  title: string;
  description: string;
  contentType: ContentType;
}

interface StructureModuleDraft {
  title: string;
  lessons: StructureLessonDraft[];
}

interface StructureProposal {
  modules: StructureModuleDraft[];
}

interface ExistingStructure {
  proposal: StructureProposal;
  validated_at: string | null;
}

function emptyLesson(): StructureLessonDraft {
  return { title: "Nouvelle leçon", description: "", contentType: "lesson" };
}

function emptyModule(): StructureModuleDraft {
  return { title: "Nouveau module", lessons: [emptyLesson(), emptyLesson()] };
}

function move<T>(arr: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= arr.length) return arr;
  const copy = [...arr];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

export default function StructureClient({
  formationId,
  basePath,
  initialStructure,
}: {
  formationId: string;
  basePath: string;
  initialStructure: ExistingStructure | null;
}) {
  const router = useRouter();
  const [structure, setStructure] = React.useState<StructureProposal | null>(initialStructure?.proposal ?? null);
  const [validatedAt, setValidatedAt] = React.useState<string | null>(initialStructure?.validated_at ?? null);
  const [generating, setGenerating] = React.useState(false);
  const [validating, setValidating] = React.useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/org/formations/${formationId}/structure/generate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Erreur", { description: json.error });
        return;
      }
      setStructure(json.data.proposal);
      toast.success("Structure proposée — relisez-la et ajustez-la avant de valider.");
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleValidate() {
    if (!structure) return;
    setValidating(true);
    try {
      const saveRes = await fetch(`/api/org/formations/${formationId}/structure`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal: structure }),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok) {
        toast.error("Erreur lors de l'enregistrement", { description: saveJson.error });
        return;
      }

      const validateRes = await fetch(`/api/org/formations/${formationId}/structure/validate`, { method: "POST" });
      const validateJson = await validateRes.json();
      if (!validateRes.ok) {
        toast.error("Erreur lors de la validation", { description: validateJson.error });
        return;
      }
      setValidatedAt(new Date().toISOString());
      toast.success("Structure validée — modules et leçons créés.");
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setValidating(false);
    }
  }

  function updateModule(mi: number, patch: Partial<StructureModuleDraft>) {
    setStructure((prev) => {
      if (!prev) return prev;
      const modules = prev.modules.map((m, i) => (i === mi ? { ...m, ...patch } : m));
      return { modules };
    });
  }

  function updateLesson(mi: number, li: number, patch: Partial<StructureLessonDraft>) {
    setStructure((prev) => {
      if (!prev) return prev;
      const modules = prev.modules.map((m, i) => {
        if (i !== mi) return m;
        return { ...m, lessons: m.lessons.map((l, j) => (j === li ? { ...l, ...patch } : l)) };
      });
      return { modules };
    });
  }

  function moveModule(mi: number, dir: -1 | 1) {
    setStructure((prev) => (prev ? { modules: move(prev.modules, mi, dir) } : prev));
  }

  function moveLesson(mi: number, li: number, dir: -1 | 1) {
    setStructure((prev) => {
      if (!prev) return prev;
      const modules = prev.modules.map((m, i) => (i === mi ? { ...m, lessons: move(m.lessons, li, dir) } : m));
      return { modules };
    });
  }

  function deleteModule(mi: number) {
    setStructure((prev) => (prev ? { modules: prev.modules.filter((_, i) => i !== mi) } : prev));
  }

  function deleteLesson(mi: number, li: number) {
    setStructure((prev) => {
      if (!prev) return prev;
      const modules = prev.modules.map((m, i) => (i === mi ? { ...m, lessons: m.lessons.filter((_, j) => j !== li) } : m));
      return { modules };
    });
  }

  function addLesson(mi: number) {
    setStructure((prev) => {
      if (!prev) return prev;
      const modules = prev.modules.map((m, i) => (i === mi ? { ...m, lessons: [...m.lessons, emptyLesson()] } : m));
      return { modules };
    });
  }

  function addModule() {
    setStructure((prev) => ({ modules: [...(prev?.modules ?? []), emptyModule()] }));
  }

  if (validatedAt) {
    const totalLessons = structure?.modules.reduce((sum, m) => sum + m.lessons.length, 0) ?? 0;
    return (
      <div className={styles.validatedCard}>
        <CheckCircle2 size={22} className={styles.validatedIcon} />
        <p className={styles.validatedTitle}>Structure validée</p>
        <p className={styles.validatedSubtitle}>
          {structure?.modules.length ?? 0} module{(structure?.modules.length ?? 0) > 1 ? "s" : ""} et {totalLessons} leçon
          {totalLessons > 1 ? "s" : ""} créés.
        </p>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() => router.push(`${basePath}/${formationId}/generation`)}
        >
          Générer le contenu des leçons
          <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  if (!structure) {
    return (
      <div className={styles.emptyState}>
        <Sparkles size={28} className={styles.emptyIcon} />
        <p className={styles.emptyText}>
          Générez une première proposition de structure à partir de vos documents et de votre cadrage.
        </p>
        <button type="button" className={styles.primaryBtn} disabled={generating} onClick={handleGenerate}>
          {generating ? "Génération en cours…" : "Générer la proposition de structure"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <button type="button" className={styles.secondaryBtn} disabled={generating} onClick={handleGenerate}>
          <RefreshCw size={14} className={generating ? styles.spin : undefined} />
          {generating ? "Régénération…" : "Régénérer"}
        </button>
        <button type="button" className={styles.secondaryBtn} onClick={addModule}>
          <Plus size={14} />
          Ajouter un module
        </button>
      </div>

      {structure.modules.map((mod, mi) => (
        <div key={mi} className={styles.moduleCard}>
          <div className={styles.moduleHeader}>
            <span className={styles.moduleBadge}>Module {mi + 1}</span>
            <input
              className={styles.moduleTitleInput}
              value={mod.title}
              onChange={(e) => updateModule(mi, { title: e.target.value })}
            />
            <div className={styles.moduleActions}>
              <button type="button" className={styles.iconBtn} disabled={mi === 0} onClick={() => moveModule(mi, -1)} aria-label="Monter le module">
                <ChevronUp size={15} />
              </button>
              <button type="button" className={styles.iconBtn} disabled={mi === structure.modules.length - 1} onClick={() => moveModule(mi, 1)} aria-label="Descendre le module">
                <ChevronDown size={15} />
              </button>
              <button type="button" className={styles.iconBtnDanger} onClick={() => deleteModule(mi)} aria-label="Supprimer le module">
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <div className={styles.lessonsList}>
            {mod.lessons.map((lesson, li) => (
              <div key={li} className={styles.lessonRow}>
                <span className={styles.lessonTypeIcon}>
                  {lesson.contentType === "quiz" ? <ClipboardList size={14} /> : <GraduationCap size={14} />}
                </span>
                <div className={styles.lessonFields}>
                  <input
                    className={styles.lessonTitleInput}
                    value={lesson.title}
                    onChange={(e) => updateLesson(mi, li, { title: e.target.value })}
                  />
                  <AutoGrowTextarea
                    className={styles.lessonDescInput}
                    value={lesson.description}
                    onChange={(value) => updateLesson(mi, li, { description: value })}
                  />
                </div>
                <button
                  type="button"
                  className={styles.typeToggle}
                  onClick={() => updateLesson(mi, li, { contentType: lesson.contentType === "quiz" ? "lesson" : "quiz" })}
                >
                  {lesson.contentType === "quiz" ? "Quiz" : "Leçon"}
                </button>
                <div className={styles.lessonActions}>
                  <button type="button" className={styles.iconBtn} disabled={li === 0} onClick={() => moveLesson(mi, li, -1)} aria-label="Monter la leçon">
                    <ChevronUp size={13} />
                  </button>
                  <button type="button" className={styles.iconBtn} disabled={li === mod.lessons.length - 1} onClick={() => moveLesson(mi, li, 1)} aria-label="Descendre la leçon">
                    <ChevronDown size={13} />
                  </button>
                  <button type="button" className={styles.iconBtnDanger} onClick={() => deleteLesson(mi, li)} aria-label="Supprimer la leçon">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className={styles.addLessonBtn} onClick={() => addLesson(mi)}>
              <Plus size={13} />
              Ajouter une leçon
            </button>
          </div>
        </div>
      ))}

      <button type="button" className={styles.validateBtn} disabled={validating} onClick={handleValidate}>
        {validating ? "Validation en cours…" : "Valider la structure"}
      </button>
    </div>
  );
}
