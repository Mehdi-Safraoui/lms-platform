import { VoyageAIClient } from "voyageai";

// maxRetries : le SDK gère déjà nativement les retries avec backoff sur les erreurs
// transitoires (429, 5xx) — on augmente juste un peu la valeur par défaut (2) pour
// être plus tolérant en cas de rate limiting sur de gros documents.
export const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY, maxRetries: 4 });

// Modèle confirmé dans le cahier des charges — dimension 1024, alignée sur
// chunks.embedding (vector(1024), supabase/migrations/20260812000000_*.sql).
export const VOYAGE_MODEL = process.env.VOYAGE_MODEL || "voyage-3";
export const EMBEDDING_DIMENSION = 1024;
