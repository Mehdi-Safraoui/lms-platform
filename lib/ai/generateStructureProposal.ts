import { zodTextFormat } from "openai/helpers/zod";
import { openai, OPENAI_GENERATION_MODEL } from "@/lib/openai";
import { structureProposalSchema, type StructureProposal } from "./structureProposal";

// La source, c'est la concaténation de TOUS les chunks-documents de la
// formation (vue d'ensemble nécessaire pour une structure cohérente, voir Point 4
// de l'architecture validée), pas un seul document.
const MAX_CHUNKS_CHARS = 90_000;

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

function truncateChunksText(text: string): string {
  if (text.length <= MAX_CHUNKS_CHARS) return text;
  console.warn(`[generateStructureProposal] Chunks source tronqués : ${text.length} → ${MAX_CHUNKS_CHARS} caractères.`);
  return text.slice(0, MAX_CHUNKS_CHARS);
}

async function callModel(cadrage: CadrageInput, chunksText: string, repairNote?: string): Promise<string> {
  const response = await openai.responses.create({
    model: OPENAI_GENERATION_MODEL,
    input: [
      { role: "system", content: buildSystemPrompt(cadrage) },
      {
        role: "user",
        content: repairNote
          ? `${repairNote}\n\n--- Extraits des documents source ---\n${chunksText}`
          : `--- Extraits des documents source ---\n${chunksText}`,
      },
    ],
    text: { format: zodTextFormat(structureProposalSchema(cadrage.nbModulesSouhaite), "structure_proposal") },
    max_output_tokens: 6_000,
  });

  if (!response.output_text) {
    throw new Error("Le modèle n'a renvoyé aucun contenu.");
  }
  return response.output_text;
}

// Budget de tentatives : la contrainte "un seul quiz, en dernière position" par module
// peut faire échouer une sortie par ailleurs correcte 1 à 2 fois de suite.
const MAX_GENERATION_ATTEMPTS = 3;

export async function generateStructureProposal(cadrage: CadrageInput, rawChunksText: string): Promise<StructureProposal> {
  const chunksText = truncateChunksText(rawChunksText.trim());
  if (!chunksText) {
    throw new Error("Aucun contenu exploitable trouvé dans les documents source.");
  }

  const schema = structureProposalSchema(cadrage.nbModulesSouhaite);
  let repairNote: string | undefined;
  let lastMessage = "";

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const output = await callModel(cadrage, chunksText, repairNote);
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
