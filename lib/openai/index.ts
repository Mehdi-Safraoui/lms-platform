import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Identifiants exacts confirmés via GET /v1/models (voir .env.example).
// Génération de formation (cadrage, structure, leçons, quiz) : modèle le plus
// capable. Chat apprenant : modèle plus léger, appelé à chaque question.
export const OPENAI_GENERATION_MODEL = process.env.OPENAI_MODEL_GENERATION || "gpt-6.1-sol";
export const OPENAI_CHAT_MODEL = process.env.OPENAI_MODEL_CHAT || "gpt-6-luna";
