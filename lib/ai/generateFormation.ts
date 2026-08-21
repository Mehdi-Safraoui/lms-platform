import { zodTextFormat } from "openai/helpers/zod";
import { openai, OPENAI_MODEL } from "@/lib/openai";
import { generatedFormationSchema, type GeneratedFormation } from "./contentBlocks";

// Garde-fou : un document extrêmement long dépasserait la fenêtre de contexte.
// Limitation connue à revisiter si on doit un jour supporter de très gros documents
// (découpage + résumé progressif) — pour l'instant, on tronque proprement.
const MAX_SOURCE_CHARS = 60_000;

// Garde-fou symétrique, trouvé en testant des documents très courts : le schéma
// impose structurellement au moins 2 modules de 2 leçons chacune (voir
// contentBlocks.ts), donc en dessous d'un certain volume de contenu réel, le LLM
// n'a pas d'autre choix que d'inventer de la matière pour remplir ce minimum —
// exactement ce que la règle 1 du prompt interdit. Vérifié empiriquement : un texte
// de 562 caractères produisait déjà des leçons avec des titres vides ou fabriqués.
// Seuil volontairement conservateur.
const MIN_SOURCE_CHARS = 1500;

const SYSTEM_PROMPT = `Tu es un ingénieur pédagogique qui conçoit des formations professionnelles pour Ahead, un organisme de formation en IA générative.

On te donne le texte brut extrait d'un document source (PDF ou Word) fourni par un formateur. Ta mission : transformer ce contenu en une formation complète, structurée et visuellement soignée, en respectant strictement le schéma JSON demandé.

Règles impératives :
1. Tout le contenu doit être dérivé du document source. N'invente pas de faits, mais tu peux reformuler, structurer et enrichir la présentation pour la rendre pédagogique.
2. Découpe le contenu en modules cohérents (chacun un thème clair du document), puis en leçons courtes et digestes à l'intérieur de chaque module.
3. Chaque module doit contenir EXACTEMENT UNE SEULE leçon de type "quiz" (contentType: "quiz"), et elle doit être la DERNIÈRE leçon du module, avec 3 à 5 questions qui testent la compréhension de l'ensemble du module. Ne crée jamais deux leçons quiz dans un même module. Les leçons de type "quiz" n'ont pas de "blocks" (mets null) mais ont un tableau "quiz".
4. Les leçons de type "lesson" ont un tableau "blocks" (jamais vide) et "quiz" à null.
5. Varie les types de blocs pour un rendu vivant, mais uniquement quand c'est pertinent par rapport au contenu réel :
   - "heading" pour structurer les sous-parties d'une leçon.
   - "paragraph" pour l'explication de fond (markdown inline autorisé : **gras**, *italique*, [lien](url)).
   - "list" pour une énumération.
   - "callout" avec la variante adaptée : "info" pour une définition clé, "tip" pour une astuce, "warning" pour un avertissement/point de vigilance, "success" pour une bonne pratique validée par le document, "objective" pour l'objectif pédagogique de la section (ce que l'apprenant doit savoir faire à la fin — dérivé du contenu, pas générique), "example" pour un exemple concret EFFECTIVEMENT présent dans le document (jamais un exemple inventé).
   - "comparison" UNIQUEMENT si le document compare explicitement 2-3 options/outils/approches.
   - "feature_grid" UNIQUEMENT si le document énumère plusieurs outils/fonctionnalités/cas d'usage distincts (2 à 6).
   - "highlight" pour LA conclusion ou recommandation la plus importante de la leçon (à utiliser avec parcimonie, 0 ou 1 par leçon).
   - "exercise" UNIQUEMENT si un exercice pratique a du sens pour ce que la leçon vient d'enseigner. Le champ "prompt" contient la consigne, le champ "answer" contient la correction ou une piste de solution — les deux sont dérivés du contenu du document, jamais l'un sans l'autre. À utiliser avec parcimonie (0 ou 1 par leçon).
   Ne force jamais un "comparison", "feature_grid" ou "exercise" si le contenu ne s'y prête pas — une leçon peut très bien n'avoir que heading/paragraph/callout.
6. Pour "feature_grid", choisis l'icône la plus pertinente dans la liste autorisée (fournie par le schéma) pour chaque item.
7. "niveau" doit refléter le niveau réel du contenu (débutant si accessible sans prérequis, avancé si très technique).
8. "estimatedDurationMinutes" doit être une estimation réaliste du temps total de la formation (lecture + quiz), pas une valeur arbitraire.
9. Réponds uniquement avec les données structurées demandées — pas de texte hors schéma.`;

function truncateSourceText(text: string): string {
  if (text.length <= MAX_SOURCE_CHARS) return text;
  console.warn(
    `[generateFormation] Document source tronqué : ${text.length} → ${MAX_SOURCE_CHARS} caractères.`
  );
  return text.slice(0, MAX_SOURCE_CHARS);
}

async function callModel(sourceText: string, repairNote?: string): Promise<string> {
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: repairNote
          ? `${repairNote}\n\n--- Document source ---\n${sourceText}`
          : `--- Document source ---\n${sourceText}`,
      },
    ],
    text: {
      format: zodTextFormat(generatedFormationSchema, "formation"),
    },
    max_output_tokens: 16_000,
  });

  if (!response.output_text) {
    throw new Error("Le modèle n'a renvoyé aucun contenu.");
  }
  return response.output_text;
}

type ParseResult =
  | { ok: true; data: GeneratedFormation }
  | { ok: false; message: string };

/**
 * Corrige déterministiquement le nombre/la position des leçons "quiz" par module,
 * AVANT la validation Zod, au lieu de compter sur le LLM pour ne jamais se tromper.
 * Constaté empiriquement : sur un module couvrant plusieurs sous-thèmes (plusieurs
 * menaces, plusieurs techniques...), le modèle a une vraie tendance à créer un quiz
 * par sous-thème plutôt qu'un seul quiz de synthèse — et cette erreur peut survivre
 * à plusieurs tentatives de suite (vu : 3, puis 2, puis 3 leçons quiz sur le même
 * module, jamais 1). Plutôt que de re-générer toute la formation en espérant que
 * le modèle corrige de lui-même, on fusionne ici les leçons quiz en trop (leurs
 * questions sont regroupées, plafonnées à 5) et on la replace en dernière position —
 * ce qui satisfait la règle du schéma à coup sûr, sans dépendre du hasard du modèle.
 * S'il manque carrément un quiz (0 leçon quiz dans un module), on ne fabrique rien :
 * ça reste une vraie erreur de génération, remontée normalement par Zod.
 */
function normalizeQuizPlacement(json: unknown): unknown {
  if (typeof json !== "object" || json === null || !("modules" in json)) return json;
  const root = json as { modules?: unknown };
  if (!Array.isArray(root.modules)) return json;

  root.modules = root.modules.map((mod) => {
    if (typeof mod !== "object" || mod === null || !("lessons" in mod)) return mod;
    const m = mod as { lessons?: unknown };
    if (!Array.isArray(m.lessons)) return mod;

    type LooseLesson = { contentType?: string; quiz?: unknown };
    const lessons = m.lessons as LooseLesson[];
    const quizLessons = lessons.filter((l) => l?.contentType === "quiz");
    const otherLessons = lessons.filter((l) => l?.contentType !== "quiz");

    if (quizLessons.length === 0) return mod; // rien à corriger, Zod le signalera si besoin.

    const mergedQuestions = quizLessons.flatMap((l) => (Array.isArray(l.quiz) ? l.quiz : [])).slice(0, 5);
    const finalQuizLesson = { ...quizLessons[0], quiz: mergedQuestions };

    return { ...mod, lessons: [...otherLessons, finalQuizLesson] };
  });

  return root;
}

/**
 * Parse + valide la sortie du modèle. Un JSON invalide/tronqué (ex : réponse coupée
 * par max_output_tokens) est traité exactement comme un échec de validation Zod —
 * avant ce correctif, JSON.parse() pouvait lever une exception non rattrapée qui
 * court-circuitait la tentative de correction automatique dès le premier essai.
 */
function parseModelOutput(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      message: `Réponse JSON invalide ou tronquée : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  json = normalizeQuizPlacement(json);
  const parsed = generatedFormationSchema.safeParse(json);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, message: parsed.error.message };
}

// 3 tentatives au total (1 initiale + 2 corrections), pas 2 : constaté empiriquement
// qu'un document par ailleurs parfaitement valide peut échouer 2 fois de suite sur
// la règle "exactement un quiz par module" (le modèle oscille entre 0 et 2 leçons
// quiz avant de se stabiliser) — un budget de correction trop court fait échouer
// des documents qui n'ont rien d'anormal.
const MAX_GENERATION_ATTEMPTS = 3;

/**
 * Génère une formation complète (modules + leçons + contenu riche) à partir du texte
 * brut d'un document source. Valide systématiquement la sortie du modèle avec le schéma
 * Zod (défense en profondeur, indépendamment du mode strict côté OpenAI) et retente
 * avec un message de correction si la validation échoue, jusqu'à MAX_GENERATION_ATTEMPTS.
 */
export async function generateFormationFromText(rawSourceText: string): Promise<GeneratedFormation> {
  const sourceText = truncateSourceText(rawSourceText.trim());
  if (!sourceText) {
    throw new Error("Le document ne contient aucun texte exploitable.");
  }
  if (sourceText.length < MIN_SOURCE_CHARS) {
    throw new Error(
      `Ce document ne contient pas assez de contenu pour générer une formation complète (${sourceText.length} caractères extraits, ${MIN_SOURCE_CHARS} recommandés). Utilisez un document plus détaillé.`
    );
  }

  let repairNote: string | undefined;
  let lastMessage = "";

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const output = await callModel(sourceText, repairNote);
    const result = parseModelOutput(output);
    if (result.ok) return result.data;

    lastMessage = result.message;
    console.warn(`[generateFormation] Sortie invalide (tentative ${attempt}/${MAX_GENERATION_ATTEMPTS}) :`, lastMessage);
    repairNote = `Ta précédente réponse ne respectait pas le schéma attendu (erreur : ${lastMessage}). Recommence en respectant strictement le schéma JSON fourni.`;
  }

  throw new Error(`Génération IA impossible après ${MAX_GENERATION_ATTEMPTS} tentatives : ${lastMessage}`);
}
