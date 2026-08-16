import { voyage, VOYAGE_MODEL, EMBEDDING_DIMENSION } from "@/lib/voyage";

/**
 * Génère l'embedding d'un texte via Voyage AI.
 *
 * `inputType` distingue "document" (un chunk à indexer) de "query" (une question de
 * recherche) — Voyage AI optimise différemment les deux représentations, ce qui
 * améliore la pertinence de la recherche par similarité. On indexera les chunks en
 * "document" ; la recherche (carte suivante) embeddera la question en "query".
 */
export async function generateEmbedding(
  text: string,
  inputType: "document" | "query" = "document"
): Promise<number[]> {
  if (!text.trim()) {
    throw new Error("Impossible de générer un embedding pour un texte vide.");
  }

  const response = await voyage.embed({
    input: text,
    model: VOYAGE_MODEL,
    inputType,
    outputDimension: EMBEDDING_DIMENSION,
  });

  const embedding = response.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error("Voyage AI n'a renvoyé aucun embedding.");
  }
  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Dimension d'embedding inattendue : ${embedding.length} (attendu ${EMBEDDING_DIMENSION}).`);
  }

  return embedding;
}

// L'API Voyage accepte jusqu'à 128 textes par appel. On reste à 100 par marge de
// sécurité — nos chunks font ~500 tokens max (cf. lib/chunking.ts), donc même 100
// d'entre eux restent largement sous la limite de tokens par requête documentée par
// Voyage AI pour ses autres modèles (120K-320K), pas besoin de calculer un budget
// de tokens séparé en plus du compte d'éléments.
const MAX_BATCH_SIZE = 100;

/**
 * Génère les embeddings de plusieurs textes en les regroupant par batchs, plutôt
 * qu'un appel API par texte — nécessaire pour ne pas multiplier les appels sur un
 * document qui produit beaucoup de chunks. Les résultats sont retriés par `index`
 * pour garantir qu'ils correspondent exactement à l'ordre des textes fournis.
 */
export async function generateEmbeddings(
  texts: string[],
  inputType: "document" | "query" = "document"
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const response = await voyage.embed({
      input: batch,
      model: VOYAGE_MODEL,
      inputType,
      outputDimension: EMBEDDING_DIMENSION,
    });

    const data = response.data;
    if (!data || data.length !== batch.length) {
      throw new Error(`Voyage AI a renvoyé ${data?.length ?? 0} embeddings pour ${batch.length} textes envoyés.`);
    }

    const ordered = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const item of ordered) {
      if (!item.embedding || item.embedding.length !== EMBEDDING_DIMENSION) {
        throw new Error("Embedding manquant ou de dimension incorrecte dans la réponse Voyage AI.");
      }
      results.push(item.embedding);
    }
  }

  return results;
}
