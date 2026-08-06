import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Identifiant exact confirmé via GET /v1/models (voir .env.example).
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";
