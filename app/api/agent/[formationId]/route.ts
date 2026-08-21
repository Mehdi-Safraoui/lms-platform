import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/require-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { searchChunks, type ChunkSearchResult } from "@/lib/searchChunks";
import { openai, OPENAI_MODEL } from "@/lib/openai";

type Params = { params: Promise<{ formationId: string }> };

const MAX_QUESTION_LENGTH = 2000;
const TOP_K = 5;

// Sous ce seuil, un chunk est considéré comme non pertinent (bruit de fond de la
// recherche vectorielle plutôt qu'une vraie correspondance) et n'est pas transmis
// au LLM comme contexte — voir lib/searchChunks.ts : la fonction retourne toujours
// les topK chunks les plus proches, même s'ils ne sont pas réellement liés à la
// question. Seuil calibré empiriquement (voir tests de searchChunks), à réajuster
// si besoin avec plus de recul.
const RELEVANCE_THRESHOLD = 0.4;

const SYSTEM_PROMPT = `Tu es un assistant pédagogique. Réponds uniquement à partir du contexte fourni. Si la réponse n'est pas dans le contexte, dis-le clairement sans inventer ni deviner — ne complète jamais une information partielle du contexte par une supposition, même plausible. Réponds toujours dans la langue utilisée par l'apprenant dans sa question, quelle que soit la langue du contexte fourni.`;

const NO_CONTEXT_PLACEHOLDER =
  "Aucun extrait pertinent n'a été trouvé dans le contenu de cette formation pour répondre à cette question.";

/**
 * Reçoit une question d'apprenant pour l'agent conversationnel d'une formation.
 * Pipeline : validation + isolation tenant/formation/inscription → recherche des
 * chunks pertinents (searchChunks, qui gère l'embedding de la question) →
 * construction du prompt avec le contexte retrouvé → appel du LLM → réponse.
 */
export async function POST(req: Request, { params }: Params) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { formationId } = await params;

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!question) {
    return NextResponse.json({ error: "La question est requise." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Question trop longue (${MAX_QUESTION_LENGTH} caractères max).` },
      { status: 400 }
    );
  }

  const supabase = createServiceRoleSupabaseClient();

  // Isolation : la formation doit appartenir au tenant de l'apprenant et être publiée
  const { data: formation } = await supabase
    .from("formations")
    .select("id")
    .eq("id", formationId)
    .eq("tenant_id", guard.tenantId)
    .eq("is_published", true)
    .single();

  if (!formation) {
    return NextResponse.json({ error: "Formation introuvable." }, { status: 404 });
  }

  // L'apprenant doit être inscrit à cette formation pour interroger son contenu
  const { data: enrollment } = await supabase
    .from("user_enrollments")
    .select("id")
    .eq("user_id", guard.userId)
    .eq("formation_id", formationId)
    .single();

  if (!enrollment) {
    return NextResponse.json({ error: "Vous n'êtes pas inscrit à cette formation." }, { status: 403 });
  }

  // Recherche vectorielle isolée par tenant + formation (voir lib/searchChunks.ts)
  let chunks: ChunkSearchResult[];
  try {
    chunks = await searchChunks(question, guard.tenantId, formationId, TOP_K);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: `Échec de la recherche de contexte : ${message}` }, { status: 500 });
  }

  const relevantChunks = chunks.filter((c) => c.similarity >= RELEVANCE_THRESHOLD);

  // Même quand aucun chunk n'est pertinent, le message de refus passe par le LLM
  // (avec un contexte explicitement vide) plutôt que d'être codé en dur : ça permet
  // de le formuler dans la langue de la question, sans risque d'hallucination
  // puisqu'aucun contenu réel n'est fourni comme contexte.
  const context =
    relevantChunks.length > 0
      ? relevantChunks.map((c, i) => `[Extrait ${i + 1}]\n${c.content}`).join("\n\n")
      : NO_CONTEXT_PLACEHOLDER;

  let answer: string;
  try {
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `--- Extraits du cours ---\n${context}\n\n--- Question de l'apprenant ---\n${question}`,
        },
      ],
      max_output_tokens: 1000,
    });

    if (!response.output_text) {
      throw new Error("Le modèle n'a renvoyé aucun contenu.");
    }
    answer = response.output_text;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: `Échec de la génération de la réponse : ${message}` }, { status: 500 });
  }

  return NextResponse.json({
    answer,
    sources: relevantChunks.map((c) => ({ id: c.id, similarity: c.similarity })),
  });
}
