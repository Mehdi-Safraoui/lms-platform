"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ArrowRight, Sparkles, Pencil, Wand2 } from "lucide-react";
import styles from "./cadrage.module.css";

type Niveau = "debutant" | "intermediaire" | "avance";

interface CadrageAnswers {
  objectif: string;
  public_vise: string;
  niveau: Niveau | "";
  nb_modules_souhaite: number | "";
  duree_estimee: string;
  notions_a_inclure: string[];
  notions_a_exclure: string[];
}

interface ExistingCadrage {
  objectif: string | null;
  public_vise: string | null;
  niveau: Niveau | null;
  nb_modules_souhaite: number | null;
  duree_estimee: string | null;
  notions_a_inclure: string[] | null;
  notions_a_exclure: string[] | null;
  completed_at: string | null;
}

const EMPTY: CadrageAnswers = {
  objectif: "",
  public_vise: "",
  niveau: "",
  nb_modules_souhaite: "",
  duree_estimee: "",
  notions_a_inclure: [],
  notions_a_exclure: [],
};

const NIVEAU_LABEL: Record<Niveau, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

type OpenStep = { key: "objectif" | "public_vise"; kind: "open"; question: string; placeholder: string };
type ListStep = { key: "notions_a_inclure" | "notions_a_exclure"; kind: "list"; question: string; placeholder: string; skippable: true };
type SelectStep = { key: "niveau"; kind: "select"; question: string };
type NumberStep = { key: "nb_modules_souhaite"; kind: "number"; question: string };
type DurationStep = { key: "duree_estimee"; kind: "duration"; question: string };
type Step = OpenStep | ListStep | SelectStep | NumberStep | DurationStep;

// Sélecteur de durée par tranches de 30 min, de 30 min à 8h — un champ texte
// libre laissait passer des réponses trop hétérogènes ("2h", "environ deux
// heures", "une demi-journée"...) pour un champ qui sert de contrainte
// numérique à la génération de structure.
const DURATION_OPTIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 30).map((minutes) => ({
  minutes,
  label: minutesToLabel(minutes),
}));

function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

const STEPS: Step[] = [
  { key: "objectif", kind: "open", question: "Quel est l'objectif de cette formation ?", placeholder: "Ex : permettre aux employés de reconnaître et signaler les tentatives de phishing" },
  { key: "public_vise", kind: "open", question: "À qui s'adresse cette formation ?", placeholder: "Ex : tous les employés, sans prérequis technique" },
  { key: "niveau", kind: "select", question: "Quel est le niveau visé ?" },
  { key: "nb_modules_souhaite", kind: "number", question: "Combien de modules souhaitez-vous ?" },
  { key: "duree_estimee", kind: "duration", question: "Quelle durée totale envisagez-vous ?" },
  { key: "notions_a_inclure", kind: "list", question: "Quelles notions la formation doit-elle absolument couvrir ?", placeholder: "Ex : mots de passe, phishing, VPN", skippable: true },
  { key: "notions_a_exclure", kind: "list", question: "Des notions à exclure explicitement ?", placeholder: "Ex : cryptographie avancée (facultatif)", skippable: true },
];

function fromExisting(existing: ExistingCadrage | null): CadrageAnswers {
  if (!existing) return EMPTY;
  return {
    objectif: existing.objectif ?? "",
    public_vise: existing.public_vise ?? "",
    niveau: existing.niveau ?? "",
    nb_modules_souhaite: existing.nb_modules_souhaite ?? "",
    duree_estimee: existing.duree_estimee ?? "",
    notions_a_inclure: existing.notions_a_inclure ?? [],
    notions_a_exclure: existing.notions_a_exclure ?? [],
  };
}

export default function CadrageClient({
  formationId,
  initialCadrage,
}: {
  formationId: string;
  initialCadrage: ExistingCadrage | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<CadrageAnswers>(() => fromExisting(initialCadrage));
  const [mode, setMode] = React.useState<"summary" | "stepper">(initialCadrage?.completed_at ? "summary" : "stepper");
  const [stepIndex, setStepIndex] = React.useState(0);
  const [rawInput, setRawInput] = React.useState("");
  const [reply, setReply] = React.useState<string | null>(null);
  const [pendingValue, setPendingValue] = React.useState<string | string[] | null>(null);
  const [reformulating, setReformulating] = React.useState(false);
  const [deciding, setDeciding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  // true quand on est entré dans le stepper via un crayon "Modifier" du récap :
  // valider cette seule étape doit ramener directement au récap, pas enchaîner
  // sur les étapes suivantes qui ont déjà une réponse enregistrée.
  const editingFromSummaryRef = React.useRef(false);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  function resetStepInput() {
    setRawInput("");
    setReply(null);
    setPendingValue(null);
  }

  function goToStep(index: number) {
    setStepIndex(index);
    resetStepInput();
    setMode("stepper");
  }

  // Depuis le récap : préremplit la réponse déjà connue pour ce champ (pas
  // besoin de tout retaper pour une correction mineure) et marque qu'un retour
  // direct au récap est attendu après validation de cette seule étape.
  function editStepFromSummary(index: number) {
    editingFromSummaryRef.current = true;
    setStepIndex(index);
    setReply(null);
    setPendingValue(null);
    const targetStep = STEPS[index];
    if (targetStep.kind === "open" || targetStep.kind === "list") {
      const existing = answers[targetStep.key];
      setRawInput(Array.isArray(existing) ? existing.join(", ") : existing);
    } else {
      setRawInput("");
    }
    setMode("stepper");
  }

  async function submitOpenOrListStep() {
    if (!rawInput.trim() || step.kind === "select" || step.kind === "number") return;
    setReformulating(true);
    try {
      const res = await fetch(`/api/org/formations/${formationId}/cadrage/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: step.key, rawAnswer: rawInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Erreur", { description: json.error });
        return;
      }
      if (step.kind === "open") {
        setPendingValue(json.data.value);
        setReply(json.data.reply);
      } else {
        setPendingValue(json.data.items);
        setReply(json.data.reply);
      }
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setReformulating(false);
    }
  }

  // Bouton "Décider pour moi" : propose une réponse ancrée dans les documents
  // source de la formation (voir /cadrage/suggest) plutôt que de forcer le
  // Formateur à tout rédiger — jamais appliquée directement pour les champs
  // texte/liste (elle passe par le même circuit reply+pendingValue que la
  // reformulation, donc reste éditable avant de continuer).
  async function decideForMe() {
    setDeciding(true);
    try {
      const res = await fetch(`/api/org/formations/${formationId}/cadrage/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: step.key, context: answers }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Erreur", { description: json.error });
        return;
      }
      if (step.kind === "open") {
        setPendingValue(json.data.value);
        setReply(json.data.reply);
      } else if (step.kind === "list") {
        setPendingValue(json.data.items);
        setReply(json.data.reply);
      } else if (step.kind === "select") {
        setAnswers((prev) => ({ ...prev, niveau: json.data.value }));
        advance();
      } else if (step.kind === "number") {
        const el = document.getElementById("nb-modules-input") as HTMLInputElement | null;
        if (el) el.value = String(json.data.value);
      } else if (step.kind === "duration") {
        const el = document.getElementById("duree-select") as HTMLSelectElement | null;
        if (el) el.value = minutesToLabel(json.data.value);
      }
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setDeciding(false);
    }
  }

  function acceptPendingValue() {
    if (pendingValue === null || step.kind === "select" || step.kind === "number") return;
    setAnswers((prev) => ({ ...prev, [step.key]: pendingValue }));
    advance();
  }

  function skipListStep() {
    if (step.kind !== "list") return;
    setAnswers((prev) => ({ ...prev, [step.key]: [] }));
    advance();
  }

  function advance() {
    resetStepInput();
    if (editingFromSummaryRef.current) {
      editingFromSummaryRef.current = false;
      setMode("summary");
    } else if (isLastStep) {
      setMode("summary");
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  async function handleValidateCadrage() {
    setSaving(true);
    try {
      const res = await fetch(`/api/org/formations/${formationId}/cadrage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error("Erreur", { description: json.error });
        return;
      }
      toast.success("Cadrage enregistré.");
      router.push(`/org/formations/${formationId}/structure`);
    } catch {
      toast.error("Erreur réseau. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  if (mode === "summary") {
    const complete =
      answers.objectif && answers.public_vise && answers.niveau && answers.nb_modules_souhaite && answers.duree_estimee;

    return (
      <div className={styles.summary}>
        <div className={styles.summaryHeader}>
          <CheckCircle2 size={18} className={styles.summaryIcon} />
          <span>Récapitulatif du cadrage</span>
        </div>

        <SummaryRow label="Objectif" value={answers.objectif} onEdit={() => editStepFromSummary(0)} />
        <SummaryRow label="Public visé" value={answers.public_vise} onEdit={() => editStepFromSummary(1)} />
        <SummaryRow label="Niveau" value={answers.niveau ? NIVEAU_LABEL[answers.niveau] : ""} onEdit={() => editStepFromSummary(2)} />
        <SummaryRow label="Nombre de modules" value={String(answers.nb_modules_souhaite || "")} onEdit={() => editStepFromSummary(3)} />
        <SummaryRow label="Durée estimée" value={answers.duree_estimee} onEdit={() => editStepFromSummary(4)} />
        <SummaryRow
          label="Notions à inclure"
          value={answers.notions_a_inclure.length ? answers.notions_a_inclure.join(", ") : "Aucune précisée"}
          onEdit={() => editStepFromSummary(5)}
        />
        <SummaryRow
          label="Notions à exclure"
          value={answers.notions_a_exclure.length ? answers.notions_a_exclure.join(", ") : "Aucune"}
          onEdit={() => editStepFromSummary(6)}
        />

        <button
          type="button"
          className={styles.primaryBtn}
          disabled={!complete || saving}
          onClick={handleValidateCadrage}
        >
          {saving ? "Enregistrement…" : "Valider le cadrage"}
        </button>

        {initialCadrage?.completed_at && (
          <p className={styles.savedHint}>
            Cadrage déjà enregistré — modifiable ci-dessus avant de continuer.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.stepper}>
      <div className={styles.progress}>
        Étape {stepIndex + 1} / {STEPS.length}
      </div>

      <div className={styles.assistantRow}>
        <Sparkles size={16} className={styles.assistantIcon} />
        <p className={styles.question}>{step.question}</p>
      </div>

      {step.kind === "select" && (
        <div className={styles.optionsRow}>
          {(["debutant", "intermediaire", "avance"] as Niveau[]).map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.optionBtn} ${answers.niveau === n ? styles.optionBtnActive : ""}`}
              onClick={() => {
                setAnswers((prev) => ({ ...prev, niveau: n }));
                advance();
              }}
            >
              {NIVEAU_LABEL[n]}
            </button>
          ))}
        </div>
      )}

      {step.kind === "select" && (
        <div className={styles.actionsRow}>
          <button type="button" className={styles.secondaryBtn} onClick={decideForMe} disabled={deciding}>
            <Wand2 size={14} />
            {deciding ? "…" : "Décider pour moi"}
          </button>
        </div>
      )}

      {step.kind === "number" && (
        <div className={styles.numberRow}>
          <input
            type="number"
            min={1}
            max={20}
            className={styles.numberInput}
            defaultValue={answers.nb_modules_souhaite || ""}
            id="nb-modules-input"
          />
          <button type="button" className={styles.secondaryBtn} onClick={decideForMe} disabled={deciding}>
            <Wand2 size={14} />
            {deciding ? "…" : "Décider pour moi"}
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => {
              const el = document.getElementById("nb-modules-input") as HTMLInputElement;
              const value = parseInt(el.value, 10);
              if (!value || value < 1 || value > 20) {
                toast.error("Entrez un nombre entre 1 et 20.");
                return;
              }
              setAnswers((prev) => ({ ...prev, nb_modules_souhaite: value }));
              advance();
            }}
          >
            Suivant
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {step.kind === "duration" && (
        <div className={styles.numberRow}>
          <select
            className={styles.durationSelect}
            id="duree-select"
            defaultValue={answers.duree_estimee || ""}
          >
            <option value="" disabled>Choisir une durée</option>
            {DURATION_OPTIONS.map((o) => (
              <option key={o.minutes} value={o.label}>{o.label}</option>
            ))}
          </select>
          <button type="button" className={styles.secondaryBtn} onClick={decideForMe} disabled={deciding}>
            <Wand2 size={14} />
            {deciding ? "…" : "Décider pour moi"}
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => {
              const el = document.getElementById("duree-select") as HTMLSelectElement;
              if (!el.value) {
                toast.error("Choisissez une durée.");
                return;
              }
              setAnswers((prev) => ({ ...prev, duree_estimee: el.value }));
              advance();
            }}
          >
            Suivant
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {(step.kind === "open" || step.kind === "list") && (
        <>
          {reply && pendingValue !== null ? (
            <div className={styles.reformulated}>
              <p className={styles.assistantReply}>{reply}</p>
              <div className={styles.reformulatedValue}>
                {Array.isArray(pendingValue) ? pendingValue.join(", ") : pendingValue}
              </div>
              <div className={styles.actionsRow}>
                <button type="button" className={styles.secondaryBtn} onClick={resetStepInput}>
                  <Pencil size={14} />
                  Modifier ma réponse
                </button>
                <button type="button" className={styles.primaryBtn} onClick={acceptPendingValue}>
                  Suivant
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <textarea
                className={styles.textarea}
                placeholder={step.placeholder}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                rows={3}
                disabled={reformulating}
              />
              <div className={styles.actionsRow}>
                <button type="button" className={styles.secondaryBtn} onClick={decideForMe} disabled={reformulating || deciding}>
                  <Wand2 size={14} />
                  {deciding ? "…" : "Décider pour moi"}
                </button>
                {step.kind === "list" && step.skippable && (
                  <button type="button" className={styles.secondaryBtn} onClick={skipListStep} disabled={reformulating || deciding}>
                    Passer
                  </button>
                )}
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={!rawInput.trim() || reformulating || deciding}
                  onClick={submitOpenOrListStep}
                >
                  {reformulating ? "…" : "Valider cette réponse"}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {stepIndex > 0 && (
        <button type="button" className={styles.backLink} onClick={() => goToStep(stepIndex - 1)}>
          ← Étape précédente
        </button>
      )}
    </div>
  );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className={styles.summaryRow}>
      <div className={styles.summaryRowText}>
        <span className={styles.summaryLabel}>{label}</span>
        <span className={styles.summaryValue}>{value || "—"}</span>
      </div>
      <button type="button" className={styles.editBtn} onClick={onEdit} aria-label={`Modifier : ${label}`}>
        <Pencil size={14} />
      </button>
    </div>
  );
}
