import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, OPENAI_GENERATION_MODEL } from "@/lib/openai";
import { recordOpenAiUsage } from "@/lib/aiUsage";
import { contentBlockSchema, quizQuestionSchema, type ContentBlock, type QuizQuestion } from "./contentBlocks";
import type { CadrageInput } from "./generateStructureProposal";

// La source est le contexte RAG déjà filtré pour cette leçon (topK chunks),
// pas un document entier, donc un plafond modeste suffit largement.
const MAX_CONTEXT_CHARS = 40_000;

export interface LessonGenerationInput {
  leconTitle: string;
  leconDescription: string;
  cadrage: CadrageInput;
  ragContext: string;
}

function truncate(text: string): string {
  if (text.length <= MAX_CONTEXT_CHARS) return text;
  return text.slice(0, MAX_CONTEXT_CHARS);
}

function cadrageBlock(cadrage: CadrageInput): string {
  return `Cadrage de la formation :
- Objectif global : ${cadrage.objectif}
- Public visé : ${cadrage.publicVise}
- Niveau : ${cadrage.niveau}
- Notions à absolument couvrir : ${cadrage.notionsAInclure.length ? cadrage.notionsAInclure.join(", ") : "aucune précisée"}
- Notions à exclure : ${cadrage.notionsAExclure.length ? cadrage.notionsAExclure.join(", ") : "aucune"}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Contenu (leçon de type "lesson") — règles de blocs héritées de l'ancienne
// génération en un coup (retirée), adaptées à une seule leçon à la fois.
// ─────────────────────────────────────────────────────────────────────────

const lessonContentSchema = z.object({
  blocks: z.array(contentBlockSchema).min(1),
});

const LESSON_SYSTEM_PROMPT = (input: LessonGenerationInput) => `Tu es un ingénieur pédagogique qui conçoit des formations professionnelles pour Ahead, un organisme de formation en IA générative.

Tu dois rédiger le contenu d'UNE SEULE leçon, à partir d'extraits de documents source et du cadrage de la formation. Cette leçon fait partie d'une structure déjà validée par le Formateur — respecte son titre et sa description, ne les redéfinis pas.

Titre de la leçon : ${input.leconTitle}
Description attendue de la leçon : ${input.leconDescription}

${cadrageBlock(input.cadrage)}

Règles impératives :
1. Tout le contenu doit être dérivé des extraits fournis. N'invente pas de faits, mais tu peux reformuler, structurer et enrichir la présentation pour la rendre pédagogique.
2. Respecte le niveau et le public visé du cadrage dans le ton et le vocabulaire employés.
3. Ne mentionne jamais une notion listée dans "notions à exclure".
4. Varie les types de blocs pour un rendu vivant, mais uniquement quand c'est pertinent par rapport au contenu réel :
   - "heading" pour structurer les sous-parties de la leçon.
   - "paragraph" pour l'explication de fond (markdown inline autorisé : **gras**, *italique*, [lien](url)).
   - "list" pour une énumération.
   - "callout" avec la variante adaptée : "info" pour une définition clé, "tip" pour une astuce, "warning" pour un avertissement/point de vigilance, "success" pour une bonne pratique validée par les extraits, "objective" pour l'objectif pédagogique de la leçon (ce que l'apprenant doit savoir faire à la fin — dérivé du contenu, pas générique), "example" pour un exemple concret EFFECTIVEMENT présent dans les extraits (jamais un exemple inventé).
   - "comparison" UNIQUEMENT si les extraits comparent explicitement 2-3 options/outils/approches.
   - "feature_grid" UNIQUEMENT si les extraits énumèrent plusieurs outils/fonctionnalités/cas d'usage distincts (2 à 6).
   - "highlight" pour LA conclusion ou recommandation la plus importante de la leçon (à utiliser avec parcimonie, 0 ou 1 par leçon).
   - "exercise" UNIQUEMENT si un exercice pratique a du sens pour ce que la leçon vient d'enseigner. Le champ "prompt" contient la consigne, le champ "answer" contient la correction — les deux dérivés des extraits, jamais l'un sans l'autre. À utiliser avec parcimonie (0 ou 1 par leçon).
   - "prompt" quand la leçon apprend à formuler une demande à une IA et qu'un exemple concret de prompt, dérivé des extraits, peut être copié-collé tel quel par l'apprenant : "prompt" contient le texte exact à copier (écrit à la première personne, prêt à l'emploi, avec des [crochets] pour les éléments à personnaliser), "title" dit à quoi il sert, "tip" (ou null) un conseil d'utilisation ou le résultat attendu. 0 à 3 par leçon.
   - "image_text" UNIQUEMENT quand un visuel aiderait vraiment l'apprenant (capture d'écran de l'interface d'un outil présenté dans les extraits, schéma décrit par les extraits). Tu ne fournis jamais l'image : "image_url" vaut toujours null, et "image_description" décrit précisément l'image que le Formateur devra ajouter (ex. "Capture d'écran de l'écran Projets de Claude, bouton « Nouveau projet » en haut à droite"). "text" explique ce que montre l'image ; "layout" vaut "image_left" ou "image_right" pour une capture accompagnée d'une explication, "image_full" pour un visuel large (schéma, tableau de bord) ; "caption" (ou null) est une courte légende. 0 à 2 par leçon.
   - "video" UNIQUEMENT si une démonstration vidéo d'une manipulation (tutoriel, démo d'un outil) aiderait vraiment. Tu ne fournis jamais de lien : "url" vaut toujours null, "search_query" est une requête YouTube précise pour trouver une vraie vidéo pertinente, "title" le sujet de la vidéo attendue, "caption" (ou null) ce que l'apprenant doit y observer. 0 ou 1 par leçon.
   Ne force jamais un "comparison", "feature_grid", "exercise", "image_text" ou "video" si le contenu ne s'y prête pas — une leçon peut très bien n'avoir que heading/paragraph/callout.
5. Pour "feature_grid", choisis l'icône la plus pertinente dans la liste autorisée (fournie par le schéma) pour chaque item.
6. Réponds uniquement avec les données structurées demandées — pas de texte hors schéma.`;

const MAX_ATTEMPTS = 3;

/**
 * Images et vidéos ne viennent jamais du modèle (un lien inventé pointerait
 * vers un contenu inexistant ou inapproprié) : même si le schéma lui laisse
 * un champ, il est vidé ici — seul le Formateur les ajoute, dans l'éditeur.
 */
function withoutGeneratedMedia(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((block) => {
    if (block.type === "image_text") return { ...block, image_url: null };
    if (block.type === "video") return { ...block, url: null };
    return block;
  });
}

export async function generateLessonContent(input: LessonGenerationInput): Promise<ContentBlock[]> {
  const context = truncate(input.ragContext.trim());
  if (!context) {
    throw new Error("Aucun extrait pertinent trouvé pour cette leçon.");
  }

  let repairNote: string | undefined;
  let lastMessage = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await openai.responses.create({
      model: OPENAI_GENERATION_MODEL,
      input: [
        { role: "system", content: LESSON_SYSTEM_PROMPT(input) },
        {
          role: "user",
          content: repairNote
            ? `${repairNote}\n\n--- Extraits pertinents ---\n${context}`
            : `--- Extraits pertinents ---\n${context}`,
        },
      ],
      text: { format: zodTextFormat(lessonContentSchema, "lesson_content") },
      max_output_tokens: 8_000,
    });
    await recordOpenAiUsage(response.model, response.usage);

    if (!response.output_text) {
      lastMessage = "Le modèle n'a renvoyé aucun contenu.";
      repairNote = "Ta précédente réponse était vide. Recommence en respectant strictement le schéma fourni.";
      continue;
    }

    let json: unknown;
    try {
      json = JSON.parse(response.output_text);
    } catch (err) {
      lastMessage = `Réponse JSON invalide ou tronquée : ${err instanceof Error ? err.message : String(err)}`;
      repairNote = "Ta précédente réponse n'était pas un JSON valide. Recommence en respectant strictement le schéma fourni.";
      continue;
    }

    const parsed = lessonContentSchema.safeParse(json);
    if (parsed.success) return withoutGeneratedMedia(parsed.data.blocks);

    lastMessage = parsed.error.message;
    console.warn(`[generateLessonContent] Sortie invalide (tentative ${attempt}/${MAX_ATTEMPTS}) :`, lastMessage);
    repairNote = `Ta précédente réponse ne respectait pas le schéma attendu (erreur : ${lastMessage}). Recommence en respectant strictement le schéma JSON fourni.`;
  }

  throw new Error(`Génération du contenu impossible après ${MAX_ATTEMPTS} tentatives : ${lastMessage}`);
}

// ─────────────────────────────────────────────────────────────────────────
// Quiz (leçon de type "quiz") — même contrainte que V1 : 3 à 5 questions qui
// testent la compréhension de l'ensemble du module, pas uniquement de cette
// leçon (ragContext couvre donc tout le module, voir l'appelant).
// ─────────────────────────────────────────────────────────────────────────

const quizContentSchema = z.object({
  questions: z.array(quizQuestionSchema).min(3).max(5),
});

const QUIZ_SYSTEM_PROMPT = (input: LessonGenerationInput) => `Tu es un ingénieur pédagogique qui conçoit des formations professionnelles pour Ahead.

Tu dois rédiger le quiz de fin de module "${input.leconTitle}" (${input.leconDescription}), à partir d'extraits de documents source et du cadrage de la formation. Ce quiz teste la compréhension de l'ensemble du module, pas d'une seule leçon.

${cadrageBlock(input.cadrage)}

Règles impératives :
1. Produis 3 à 5 questions à choix multiples (2 à 6 options chacune), dérivées uniquement des extraits fournis.
2. Chaque question doit avoir exactement une bonne réponse (correctIndex pointant vers l'option correcte).
3. Ne pose jamais de question sur une notion listée dans "notions à exclure".
4. Adapte la difficulté au niveau du cadrage.
5. Réponds uniquement avec les données structurées demandées — pas de texte hors schéma.`;

export async function generateLessonQuiz(input: LessonGenerationInput): Promise<QuizQuestion[]> {
  const context = truncate(input.ragContext.trim());
  if (!context) {
    throw new Error("Aucun extrait pertinent trouvé pour ce quiz.");
  }

  let repairNote: string | undefined;
  let lastMessage = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await openai.responses.create({
      model: OPENAI_GENERATION_MODEL,
      input: [
        { role: "system", content: QUIZ_SYSTEM_PROMPT(input) },
        {
          role: "user",
          content: repairNote
            ? `${repairNote}\n\n--- Extraits pertinents du module ---\n${context}`
            : `--- Extraits pertinents du module ---\n${context}`,
        },
      ],
      text: { format: zodTextFormat(quizContentSchema, "quiz_content") },
      max_output_tokens: 3_000,
    });
    await recordOpenAiUsage(response.model, response.usage);

    if (!response.output_text) {
      lastMessage = "Le modèle n'a renvoyé aucun contenu.";
      repairNote = "Ta précédente réponse était vide. Recommence en respectant strictement le schéma fourni.";
      continue;
    }

    let json: unknown;
    try {
      json = JSON.parse(response.output_text);
    } catch (err) {
      lastMessage = `Réponse JSON invalide ou tronquée : ${err instanceof Error ? err.message : String(err)}`;
      repairNote = "Ta précédente réponse n'était pas un JSON valide. Recommence en respectant strictement le schéma fourni.";
      continue;
    }

    const parsed = quizContentSchema.safeParse(json);
    if (parsed.success) return parsed.data.questions;

    lastMessage = parsed.error.message;
    console.warn(`[generateLessonQuiz] Sortie invalide (tentative ${attempt}/${MAX_ATTEMPTS}) :`, lastMessage);
    repairNote = `Ta précédente réponse ne respectait pas le schéma attendu (erreur : ${lastMessage}). Recommence en respectant strictement le schéma JSON fourni.`;
  }

  throw new Error(`Génération du quiz impossible après ${MAX_ATTEMPTS} tentatives : ${lastMessage}`);
}
