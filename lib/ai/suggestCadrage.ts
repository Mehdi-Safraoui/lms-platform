import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, OPENAI_GENERATION_MODEL } from "@/lib/openai";
import { recordOpenAiUsage } from "@/lib/aiUsage";

/**
 * Bouton "Décider pour moi" du stepper de cadrage : contrairement à
 * reformulateCadrage.ts (qui reformule une réponse déjà donnée par le
 * Formateur), ici il n'y a AUCUNE réponse brute — l'IA doit proposer une
 * valeur plausible à partir des documents source de la formation, ancrée dans
 * leur contenu réel (jamais inventée de toutes pièces), et cohérente avec les
 * réponses déjà données pour les autres champs du cadrage.
 */
export type CadrageField =
  | "objectif"
  | "public_vise"
  | "niveau"
  | "nb_modules_souhaite"
  | "duree_estimee"
  | "notions_a_inclure"
  | "notions_a_exclure";

export interface CadrageContext {
  objectif?: string;
  public_vise?: string;
  niveau?: "debutant" | "intermediaire" | "avance" | "";
  nb_modules_souhaite?: number | "";
  duree_estimee?: string;
  notions_a_inclure?: string[];
  notions_a_exclure?: string[];
}

// S'applique à la fiche de synthèse (lib/sourcesSummary.ts, ~1 500 mots), pas
// aux documents bruts : simple garde-fou.
const MAX_DOCUMENT_CHARS = 20_000;

function truncate(text: string): string {
  return text.length <= MAX_DOCUMENT_CHARS ? text : text.slice(0, MAX_DOCUMENT_CHARS);
}

function answeredSoFarBlock(context: CadrageContext): string {
  const lines: string[] = [];
  if (context.objectif) lines.push(`- Objectif : ${context.objectif}`);
  if (context.public_vise) lines.push(`- Public visé : ${context.public_vise}`);
  if (context.niveau) lines.push(`- Niveau : ${context.niveau}`);
  if (context.nb_modules_souhaite) lines.push(`- Nombre de modules souhaité : ${context.nb_modules_souhaite}`);
  if (context.duree_estimee) lines.push(`- Durée estimée : ${context.duree_estimee}`);
  if (context.notions_a_inclure?.length) lines.push(`- Notions à inclure : ${context.notions_a_inclure.join(", ")}`);
  if (context.notions_a_exclure?.length) lines.push(`- Notions à exclure : ${context.notions_a_exclure.join(", ")}`);
  return lines.length ? lines.join("\n") : "(aucune réponse donnée pour l'instant)";
}

const SYSTEM_PROMPT = `Tu es un assistant pédagogique qui aide un Formateur pressé à cadrer une formation avant sa génération par IA. Il a cliqué sur "Décider pour moi" : à partir de la fiche de synthèse des documents source qu'il a fournis et des réponses qu'il a déjà données, propose des réponses plausibles et cohérentes pour les champs du cadrage.
Règles impératives :
1. Ancre ta proposition dans le contenu réel décrit par la synthèse — ne propose jamais un objectif, un public ou des notions qui ne sont pas soutenus par les documents.
2. Reste cohérent avec les réponses déjà données pour les autres champs.
3. Si la synthèse ne permet vraiment pas de juger un aspect précis, propose la valeur la plus raisonnable par défaut plutôt que de refuser de répondre.
4. Réponds uniquement avec les données structurées demandées — pas de texte hors schéma.`;

const FIELD_INSTRUCTIONS: Record<CadrageField, string> = {
  objectif:
    "Propose l'objectif pédagogique global de la formation, en une ou deux phrases claires et actionnables (ce que l'apprenant doit être capable de faire à la fin), dérivées du contenu des documents.",
  public_vise:
    "Propose une description concise du public visé par la formation (rôle, niveau d'expérience si déductible du document).",
  niveau:
    "Choisis le niveau visé (debutant, intermediaire ou avance) le plus cohérent avec la complexité du contenu des documents et le public déjà décrit.",
  nb_modules_souhaite:
    "Propose un nombre de modules (entre 1 et 20) proportionné au volume et à la diversité des sujets couverts par les documents.",
  duree_estimee:
    "Propose une durée totale réaliste, en minutes, multiple de 30 (le Formateur choisit ensuite via un sélecteur par tranches de 30 minutes), cohérente avec le nombre de modules déjà choisi si disponible.",
  notions_a_inclure:
    "Propose une liste de 3 à 8 notions clés que la formation doit absolument couvrir, tirées du contenu réel des documents (une entrée courte par notion).",
  notions_a_exclure:
    "Propose une liste de notions périphériques ou hors-sujet qu'il est raisonnable d'exclure explicitement pour rester focalisé sur l'objectif. Liste vide si rien ne s'y prête distinctement — ne force jamais une exclusion artificielle.",
};

const openField = z.object({ value: z.string().min(1), reply: z.string().min(1) });
const listField = z.object({ items: z.array(z.string().min(1)), reply: z.string().min(1) });

// Multiple de 30, borné à la plage du sélecteur (30 min à 8h) — voir
// DURATION_OPTIONS dans CadrageClient.tsx.
const fullCadrageResult = z.object({
  objectif: openField,
  public_vise: openField,
  niveau: z.enum(["debutant", "intermediaire", "avance"]),
  nb_modules_souhaite: z.number().int().min(1).max(20),
  duree_minutes: z.number().int().min(30).max(480),
  notions_a_inclure: listField,
  notions_a_exclure: listField,
});

export type FullCadrageSuggestion = z.infer<typeof fullCadrageResult>;

const FIELD_ORDER: CadrageField[] = [
  "objectif",
  "public_vise",
  "niveau",
  "nb_modules_souhaite",
  "duree_estimee",
  "notions_a_inclure",
  "notions_a_exclure",
];

/**
 * Propose TOUT le cadrage en un seul appel (au lieu d'un appel par champ) : le
 * stepper préremplit ensuite chaque étape instantanément. Les champs déjà
 * répondus dans `context` sont repris tels quels, les autres sont proposés en
 * cohérence avec eux — c'est ce qui permet de relancer une proposition pour
 * les étapes restantes quand le Formateur modifie une réponse.
 */
export async function suggestFullCadrage(documentContext: string, context: CadrageContext): Promise<FullCadrageSuggestion> {
  const instructions = FIELD_ORDER.map((field) => `- ${field === "duree_estimee" ? "duree_minutes" : field} : ${FIELD_INSTRUCTIONS[field]}`).join("\n");

  const response = await openai.responses.create({
    model: OPENAI_GENERATION_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Propose une valeur pour CHACUN des champs du cadrage ci-dessous, cohérents entre eux. Pour un champ déjà répondu par le Formateur, reprends sa réponse telle quelle. Pour les champs texte et liste, "reply" est une phrase courte adressée au Formateur qui présente la proposition.\n\nChamps :\n${instructions}\n\nRéponses déjà données :\n${answeredSoFarBlock(context)}\n\n--- Synthèse des documents source ---\n${truncate(documentContext)}`,
      },
    ],
    text: { format: zodTextFormat(fullCadrageResult, "cadrage_suggest_full") },
    max_output_tokens: 2_000,
  });
  await recordOpenAiUsage(response.model, response.usage);

  if (!response.output_text) throw new Error("Le modèle n'a renvoyé aucun contenu.");
  const result = fullCadrageResult.parse(JSON.parse(response.output_text));
  // Le modèle respecte généralement la consigne "multiple de 30", mais on
  // arrondit quand même au cas où — le sélecteur ne connaît que ces valeurs.
  return { ...result, duree_minutes: Math.min(480, Math.max(30, Math.round(result.duree_minutes / 30) * 30)) };
}
