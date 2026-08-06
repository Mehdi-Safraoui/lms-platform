import { zodTextFormat } from "openai/helpers/zod";
import { openai, OPENAI_MODEL } from "@/lib/openai";
import { generatedFormationSchema, type GeneratedFormation } from "./contentBlocks";

// Garde-fou : un document extrêmement long dépasserait la fenêtre de contexte.
// Limitation connue à revisiter si on doit un jour supporter de très gros documents
// (découpage + résumé progressif) — pour l'instant, on tronque proprement.
const MAX_SOURCE_CHARS = 60_000;

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
   - "callout" pour une définition clé, une astuce, un avertissement ou un point de vigilance présent dans le document.
   - "comparison" UNIQUEMENT si le document compare explicitement 2-3 options/outils/approches.
   - "feature_grid" UNIQUEMENT si le document énumère plusieurs outils/fonctionnalités/cas d'usage distincts (2 à 6).
   - "highlight" pour LA conclusion ou recommandation la plus importante de la leçon (à utiliser avec parcimonie, 0 ou 1 par leçon).
   Ne force jamais un "comparison" ou "feature_grid" si le contenu ne s'y prête pas — une leçon peut très bien n'avoir que heading/paragraph/callout.
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

/**
 * Génère une formation complète (modules + leçons + contenu riche) à partir du texte
 * brut d'un document source. Valide systématiquement la sortie du modèle avec le schéma
 * Zod (défense en profondeur, indépendamment du mode strict côté OpenAI) et retente une
 * fois avec un message de correction si la validation échoue.
 */
export async function generateFormationFromText(rawSourceText: string): Promise<GeneratedFormation> {
  const sourceText = truncateSourceText(rawSourceText.trim());
  if (!sourceText) {
    throw new Error("Le document ne contient aucun texte exploitable.");
  }

  const firstOutput = await callModel(sourceText);
  const firstParsed = generatedFormationSchema.safeParse(JSON.parse(firstOutput));
  if (firstParsed.success) return firstParsed.data;

  console.warn("[generateFormation] Sortie invalide, nouvelle tentative avec correction :", firstParsed.error.message);

  const repairNote = `Ta précédente réponse ne respectait pas le schéma attendu (erreur : ${firstParsed.error.message}). Recommence en respectant strictement le schéma JSON fourni.`;
  const secondOutput = await callModel(sourceText, repairNote);
  const secondParsed = generatedFormationSchema.safeParse(JSON.parse(secondOutput));
  if (secondParsed.success) return secondParsed.data;

  throw new Error(`Génération IA impossible après 2 tentatives : ${secondParsed.error.message}`);
}
