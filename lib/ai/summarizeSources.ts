import { openai, OPENAI_GENERATION_MODEL } from "@/lib/openai";

// Même plafond que la proposition de structure (lib/ai/generateStructureProposal.ts) :
// la synthèse lit le texte complet des documents, pas seulement leur début.
const MAX_SOURCE_CHARS = 400_000;

const SYSTEM_PROMPT = `Tu es un ingénieur pédagogique. On te fournit le texte complet des documents source d'une future formation professionnelle. Rédige une fiche de synthèse qui servira ensuite, à la place des documents eux-mêmes, à proposer le cadrage de la formation (objectif, public visé, niveau, nombre de modules, durée, notions à inclure ou exclure).

Structure la fiche avec exactement ces rubriques, en français, en texte simple :
1. Sujet et finalité — de quoi parlent les documents et à quoi ils doivent servir.
2. Plan du contenu — les grandes parties dans l'ordre du document, chacune en une ligne avec les sous-thèmes principaux ; indique pour chaque partie son poids approximatif (en % du volume total).
3. Public apparent — à qui s'adressent les documents, prérequis éventuels, indices (vocabulaire, exemples, avertissements).
4. Niveau de difficulté — débutant, intermédiaire ou avancé, avec la justification.
5. Notions clés — 8 à 15 notions essentielles, une par ligne.
6. Notions périphériques — sujets mentionnés mais secondaires ou hors du cœur du propos, une par ligne (rubrique vide si aucun).
7. Volume — estimation du volume de contenu (nombre de pages ou de sections), utile pour dimensionner la formation.

Règles : n'invente rien qui ne soit pas dans les documents ; couvre l'ensemble des documents, pas seulement leur début ; reste factuel et concis (1 500 mots maximum).`;

/**
 * Fiche de synthèse des documents source d'une formation — générée une fois,
 * puis réutilisée par chaque "Décider pour moi" du cadrage (voir
 * lib/sourcesSummary.ts).
 */
export async function summarizeSources(sourceText: string): Promise<string> {
  const text = sourceText.length <= MAX_SOURCE_CHARS ? sourceText : sourceText.slice(0, MAX_SOURCE_CHARS);

  const response = await openai.responses.create({
    model: OPENAI_GENERATION_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `--- Documents source (texte complet) ---\n${text}` },
    ],
    max_output_tokens: 8_000,
  });

  const summary = response.output_text?.trim();
  if (!summary) throw new Error("Le modèle n'a renvoyé aucune synthèse.");
  return summary;
}
