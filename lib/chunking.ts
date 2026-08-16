import { encode } from "gpt-tokenizer";

// Cible ~500 tokens/chunk avec ~50 tokens de chevauchement, comme demandé par la card.
// Comptage de tokens via gpt-tokenizer (BPE cl100k) : pas exactement le tokenizer de
// Voyage AI (pas encore intégré, carte suivante), mais un ordre de grandeur fiable et
// pur JS — largement suffisant pour dimensionner des chunks.
const DEFAULT_TARGET_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 50;

export interface TextChunk {
  content: string;
  position: number;
  charStart: number;
  charEnd: number;
  tokenCount: number;
}

export interface ChunkRecordDraft {
  tenant_id: string;
  formation_id: string;
  knowledge_source_id: string;
  content: string;
  metadata: {
    position: number;
    char_start: number;
    char_end: number;
    token_count: number;
  };
}

function estimateTokens(text: string): number {
  return encode(text).length;
}

/**
 * Découpe un texte en phrases, en respectant d'abord les paragraphes (séparés par une
 * ligne vide) puis en coupant à l'intérieur sur la ponctuation finale (. ! ?) suivie
 * d'une majuscule/chiffre/guillemet. Heuristique simple (pas d'analyse linguistique
 * réelle), mais suffisante pour ne jamais couper une phrase en deux — l'objectif de
 * la carte 3 (cohérence des chunks).
 */
function splitIntoSentences(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const sentences: string[] = [];
  for (const paragraph of paragraphs) {
    const parts = paragraph.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý0-9"«])/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) sentences.push(trimmed);
    }
  }
  return sentences;
}

/**
 * Localise le début/fin d'un chunk dans le texte source d'origine, en cherchant sa
 * première et sa dernière phrase. Les plages de deux chunks consécutifs se chevauchent
 * légèrement par construction (c'est le but du overlap, pas un bug).
 */
function locateInSource(source: string, sentences: string[], content: string): { charStart: number; charEnd: number } {
  const first = sentences[0];
  const last = sentences[sentences.length - 1];
  const charStart = source.indexOf(first);
  if (charStart === -1) return { charStart: 0, charEnd: content.length };
  const lastIdx = source.indexOf(last, charStart);
  const charEnd = lastIdx >= 0 ? lastIdx + last.length : charStart + content.length;
  return { charStart, charEnd };
}

/**
 * Découpe un texte en chunks de ~targetTokens tokens, avec ~overlapTokens de
 * chevauchement entre chunks consécutifs pour ne pas perdre le contexte à la frontière.
 * Ne coupe jamais une phrase en deux : les phrases sont l'unité atomique.
 */
export function chunkText(
  text: string,
  options?: { targetTokens?: number; overlapTokens?: number }
): TextChunk[] {
  const targetTokens = options?.targetTokens ?? DEFAULT_TARGET_TOKENS;
  const overlapTokens = options?.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;

  const source = text.trim();
  const sentences = splitIntoSentences(source);
  if (sentences.length === 0) return [];

  const chunks: TextChunk[] = [];
  let position = 0;
  let bucket: string[] = [];
  let bucketTokens = 0;

  function flush() {
    if (bucket.length === 0) return;
    const content = bucket.join(" ");
    const { charStart, charEnd } = locateInSource(source, bucket, content);
    chunks.push({ content, position, charStart, charEnd, tokenCount: bucketTokens });
    position += 1;
  }

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    if (bucketTokens > 0 && bucketTokens + sentenceTokens > targetTokens) {
      flush();

      // Chevauchement : on repart des dernières phrases du chunk qu'on vient de
      // fermer, jusqu'à atteindre ~overlapTokens.
      const overlapSentences: string[] = [];
      let overlapCount = 0;
      for (let j = bucket.length - 1; j >= 0 && overlapCount < overlapTokens; j--) {
        overlapSentences.unshift(bucket[j]);
        overlapCount += estimateTokens(bucket[j]);
      }
      bucket = overlapSentences;
      bucketTokens = overlapCount;
    }

    bucket.push(sentence);
    bucketTokens += sentenceTokens;
  }
  flush();

  return chunks;
}

/**
 * Prépare les chunks d'un document pour insertion dans la table `chunks` — sans
 * l'embedding (pas encore généré, carte suivante "Génération des embeddings et
 * insertion dans pgvector"). tenant_id/formation_id/knowledge_source_id sont déjà les
 * colonnes dédiées de la table ; position/char_start/char_end/token_count vont dans
 * la colonne metadata (jsonb).
 */
export function buildChunkRecords(
  text: string,
  context: { tenantId: string; formationId: string; knowledgeSourceId: string },
  options?: { targetTokens?: number; overlapTokens?: number }
): ChunkRecordDraft[] {
  return chunkText(text, options).map((chunk) => ({
    tenant_id: context.tenantId,
    formation_id: context.formationId,
    knowledge_source_id: context.knowledgeSourceId,
    content: chunk.content,
    metadata: {
      position: chunk.position,
      char_start: chunk.charStart,
      char_end: chunk.charEnd,
      token_count: chunk.tokenCount,
    },
  }));
}
