import { zodTextFormat } from "openai/helpers/zod";
import { openai, OPENAI_GENERATION_MODEL } from "@/lib/openai";
import { recordOpenAiUsage } from "@/lib/aiUsage";
import { structureProposalSchema, type StructureProposal } from "./structureProposal";

// La source, c'est le texte COMPLET des documents de la formation, reconstitué
// dans l'ordre (lib/sourceDocumentsText.ts) : une structure a besoin d'une vue
// d'ensemble, qu'une recherche vectorielle top-K ne donnerait pas. ~400 000
// caractères ≈ 100 000 tokens (environ 150 pages), largement dans la fenêtre du
// modèle de génération ; au-delà, seul le début serait lu — il faudrait alors
// résumer chaque document avant de proposer la structure.
const MAX_SOURCE_CHARS = 400_000;

export interface CadrageInput {
  objectif: string;
  publicVise: string;
  niveau: "debutant" | "intermediaire" | "avance";
  nbModulesSouhaite: number;
  dureeEstimee: string;
  notionsAInclure: string[];
  notionsAExclure: string[];
}

function buildSystemPrompt(cadrage: CadrageInput): string {
  return `Tu es un concepteur pédagogique. À partir d'extraits de documents source et d'un cadrage validé par le Formateur, propose une structure Module → Leçon pour une formation — uniquement les titres et une courte description de chaque leçon, pas de contenu détaillé (il sera généré plus tard, leçon par leçon).

Cadrage de la formation :
- Objectif : ${cadrage.objectif}
- Public visé : ${cadrage.publicVise}
- Niveau : ${cadrage.niveau}
- Nombre de modules souhaité : ${cadrage.nbModulesSouhaite}
- Durée totale estimée : ${cadrage.dureeEstimee}
- Notions à absolument couvrir : ${cadrage.notionsAInclure.length ? cadrage.notionsAInclure.join(", ") : "aucune précisée"}
- Notions à exclure : ${cadrage.notionsAExclure.length ? cadrage.notionsAExclure.join(", ") : "aucune"}

Règles :
1. Produis exactement ${cadrage.nbModulesSouhaite} modules.
2. Chaque module contient 2 à 8 leçons, dont exactement UNE leçon de type "quiz" obligatoirement en dernière position du module.
3. La progression entre modules doit être cohérente et pédagogique — chaque module s'appuie sur les précédents, pas un empilement de sujets indépendants sans lien.
4. Chaque leçon doit correspondre à du contenu réellement présent dans les extraits fournis — ne propose pas de leçon sur une notion absente des documents, sauf si elle est explicitement demandée dans "notions à absolument couvrir".
5. Respecte strictement les notions à exclure : aucune leçon ne doit porter dessus.
6. La description de chaque leçon fait 1 à 2 phrases, assez précise pour guider sa génération de contenu ultérieure.
7. Réponds uniquement avec les données structurées demandées — pas de texte hors schéma.`;
}

function truncateSourceText(text: string): string {
  if (text.length <= MAX_SOURCE_CHARS) return text;
  console.warn(`[generateStructureProposal] Documents source tronqués : ${text.length} → ${MAX_SOURCE_CHARS} caractères.`);
  return text.slice(0, MAX_SOURCE_CHARS);
}

/**
 * Suivi en direct de la génération (route en streaming, voir
 * app/api/org/formations/[id]/structure/generate/route.ts) : onDelta reçoit
 * chaque morceau du JSON au fil de son écriture par le modèle, onRetry signale
 * qu'une sortie invalide va être régénérée (le texte déjà reçu est à jeter).
 */
export interface StructureGenerationHooks {
  onDelta?: (text: string) => void;
  onRetry?: (attempt: number, reason: string) => void;
}

async function callModel(
  cadrage: CadrageInput,
  sourceText: string,
  repairNote: string | undefined,
  onDelta: ((text: string) => void) | undefined
): Promise<string> {
  const stream = await openai.responses.create({
    model: OPENAI_GENERATION_MODEL,
    input: [
      { role: "system", content: buildSystemPrompt(cadrage) },
      {
        role: "user",
        content: repairNote
          ? `--- Documents source (texte complet) ---\n${sourceText}\n\n--- Correction demandée ---\n${repairNote}`
          : `--- Documents source (texte complet) ---\n${sourceText}`,
      },
    ],
    text: { format: zodTextFormat(structureProposalSchema(cadrage.nbModulesSouhaite), "structure_proposal") },
    // Jusqu'à 20 modules × plusieurs leçons avec leur description : marge large
    // pour ne jamais tronquer le JSON.
    max_output_tokens: 16_000,
    stream: true,
  });

  let output = "";
  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      output += event.delta;
      onDelta?.(event.delta);
    } else if (event.type === "response.completed" || event.type === "response.incomplete") {
      // Seul l'événement final porte le décompte des tokens ; une réponse
      // tronquée (incomplete) est facturée elle aussi.
      await recordOpenAiUsage(event.response.model, event.response.usage);
    } else if (event.type === "response.failed") {
      await recordOpenAiUsage(event.response.model, event.response.usage);
      throw new Error(event.response.error?.message ?? "La génération a échoué côté modèle.");
    } else if (event.type === "error") {
      throw new Error(event.message);
    }
  }

  if (!output) {
    throw new Error("Le modèle n'a renvoyé aucun contenu.");
  }
  return output;
}

// Budget de tentatives : la contrainte "un seul quiz, en dernière position" par module
// peut faire échouer une sortie par ailleurs correcte 1 à 2 fois de suite.
const MAX_GENERATION_ATTEMPTS = 3;

export async function generateStructureProposal(
  cadrage: CadrageInput,
  rawSourceText: string,
  hooks: StructureGenerationHooks = {}
): Promise<StructureProposal> {
  const sourceText = truncateSourceText(rawSourceText.trim());
  if (!sourceText) {
    throw new Error("Aucun contenu exploitable trouvé dans les documents source.");
  }

  const schema = structureProposalSchema(cadrage.nbModulesSouhaite);
  let repairNote: string | undefined;
  let lastMessage = "";

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    if (attempt > 1) hooks.onRetry?.(attempt, lastMessage);
    const output = await callModel(cadrage, sourceText, repairNote, hooks.onDelta);
    let json: unknown;
    try {
      json = JSON.parse(output);
    } catch (err) {
      lastMessage = `Réponse JSON invalide ou tronquée : ${err instanceof Error ? err.message : String(err)}`;
      repairNote = `Ta précédente réponse n'était pas un JSON valide. Recommence en respectant strictement le schéma fourni.`;
      continue;
    }

    const parsed = schema.safeParse(json);
    if (parsed.success) return parsed.data;

    lastMessage = parsed.error.message;
    console.warn(`[generateStructureProposal] Sortie invalide (tentative ${attempt}/${MAX_GENERATION_ATTEMPTS}) :`, lastMessage);
    repairNote = `Ta précédente réponse ne respectait pas le schéma attendu (erreur : ${lastMessage}). Recommence en respectant strictement le schéma JSON fourni.`;
  }

  throw new Error(`Génération de la structure impossible après ${MAX_GENERATION_ATTEMPTS} tentatives : ${lastMessage}`);
}
