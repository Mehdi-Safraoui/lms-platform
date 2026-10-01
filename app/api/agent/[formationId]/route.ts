import { NextResponse } from "next/server";
import { requireAuth, type AuthGuard } from "@/lib/api/require-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { searchChunks, type ChunkSearchResult } from "@/lib/searchChunks";
import { openai, OPENAI_CHAT_MODEL } from "@/lib/openai";
import { recordOpenAiUsage, withAiUsage, type AiUsageContext } from "@/lib/aiUsage";

type Params = { params: Promise<{ formationId: string }> };
type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

const MAX_QUESTION_LENGTH = 2000;
const TOP_K = 5;

// Sous ce seuil, un chunk est considéré comme non pertinent (bruit de fond de la
// recherche vectorielle plutôt qu'une vraie correspondance) et n'est pas transmis
// au LLM comme contexte — voir lib/searchChunks.ts : la fonction retourne toujours
// les topK chunks les plus proches, même s'ils ne sont pas réellement liés à la
// question.
//
// 0.4 (valeur initiale) s'est révélé trop strict en conditions réelles : une
// vraie question ("C'est quoi les trois mesures essentielles ?", réponse
// présente mot pour mot dans le cours) obtenait un score de 0.281, en dessous
// du seuil — refus alors que le contenu existait. Recalibré à 0.25 après avoir
// comparé des scores réels sur plusieurs formations : questions légitimes
// 0.28-0.61, questions hors sujet 0.14-0.29 (chevauchement partiel, inévitable
// avec un seuil unique). Le filet de sécurité contre l'hallucination n'est pas
// ce seuil à lui seul : même testé avec un chunk hors-sujet forcé au-delà du
// seuil, le LLM (system prompt) a correctement identifié qu'il ne répondait
// pas à la question plutôt que d'improviser — vérifié en conditions réelles.
const RELEVANCE_THRESHOLD = 0.25;

const SYSTEM_PROMPT = `Tu es un assistant pédagogique. Réponds uniquement à partir du contexte fourni. Si la réponse n'est pas dans le contexte, dis-le clairement sans inventer ni deviner — ne complète jamais une information partielle du contexte par une supposition, même plausible. Réponds toujours dans la langue utilisée par l'apprenant dans sa question, quelle que soit la langue du contexte fourni.`;

const NO_CONTEXT_PLACEHOLDER =
  "Aucun extrait pertinent n'a été trouvé dans le contenu de cette formation pour répondre à cette question.";

/**
 * Vérifications communes à GET (lecture de l'historique) et POST (nouvelle
 * question) : authentification, rôle apprenant, formation publiée du bon
 * tenant, et inscription de l'apprenant à cette formation précise.
 */
async function authorizeAccess(
  supabase: Supabase,
  guard: AuthGuard,
  formationId: string
): Promise<NextResponse | null> {
  // requireAuth() ne renseigne pas le rôle — or user_enrollments seul ne
  // suffit pas à garantir "apprenant uniquement" : rien n'empêche un tuteur
  // ou un admin_tenant de s'inscrire à une formation de son propre tenant
  // (la page d'inscription ne filtre pas non plus par rôle), ce qui leur
  // donnerait sinon accès au chat au même titre qu'un apprenant.
  const { data: currentUser } = await supabase.from("users").select("role").eq("id", guard.userId).single();
  if (currentUser?.role !== "apprenant") {
    return NextResponse.json({ error: "Réservé aux apprenants." }, { status: 403 });
  }

  const { data: formation } = await supabase
    .from("formations")
    .select("id, tenant_id")
    .eq("id", formationId)
    .eq("is_published", true)
    .single();

  if (!formation) {
    return NextResponse.json({ error: "Formation introuvable." }, { status: 404 });
  }

  // Isolation : soit la formation appartient directement au tenant de
  // l'apprenant, soit (formation du catalogue global, tenant_id null — ex.
  // V1/super_admin) le tenant doit l'avoir activée via tenant_formations.
  if (formation.tenant_id) {
    if (formation.tenant_id !== guard.tenantId) {
      return NextResponse.json({ error: "Formation introuvable." }, { status: 404 });
    }
  } else {
    const { data: link } = await supabase
      .from("tenant_formations")
      .select("formation_id")
      .eq("tenant_id", guard.tenantId)
      .eq("formation_id", formationId)
      .maybeSingle();
    if (!link) {
      return NextResponse.json({ error: "Formation introuvable." }, { status: 404 });
    }
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

  return null;
}

/**
 * Historique de la conversation de l'apprenant courant pour cette formation
 * (table agent_messages), le plus ancien en premier.
 */
export async function GET(_req: Request, { params }: Params) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  const denied = await authorizeAccess(supabase, guard, formationId);
  if (denied) return denied;

  const { data: messages, error } = await supabase
    .from("agent_messages")
    .select("role, content, created_at, sources")
    .eq("user_id", guard.userId)
    .eq("formation_id", formationId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Impossible de charger l'historique." }, { status: 500 });
  }

  return NextResponse.json({ messages: messages ?? [] });
}

/**
 * Reçoit une question d'apprenant pour l'agent conversationnel d'une formation.
 * Pipeline : validation + isolation tenant/formation/inscription → recherche des
 * chunks pertinents (searchChunks, qui gère l'embedding de la question) →
 * construction du prompt avec le contexte retrouvé → appel du LLM → réponse.
 * La question et la réponse sont enregistrées dans agent_messages pour
 * l'historique — la question est enregistrée avant l'appel au LLM, pour ne
 * pas perdre la trace de ce qui a été demandé si la génération échoue.
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

  const denied = await authorizeAccess(supabase, guard, formationId);
  if (denied) return denied;

  await supabase.from("agent_messages").insert({
    tenant_id: guard.tenantId,
    user_id: guard.userId,
    formation_id: formationId,
    role: "user",
    content: question,
  });

  // Coût IA imputé à l'entreprise de l'apprenant, y compris sur une formation
  // du catalogue Ahead.
  const usageContext: AiUsageContext = { tenantId: guard.tenantId, formationId, userId: guard.userId, feature: "chat" };

  // Recherche vectorielle isolée par formation (voir lib/searchChunks.ts) —
  // l'accès à cette formation précise vient d'être vérifié ci-dessus.
  let chunks: ChunkSearchResult[];
  try {
    chunks = await withAiUsage(usageContext, () => searchChunks(question, formationId, TOP_K, "lesson"));
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
      model: OPENAI_CHAT_MODEL,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `--- Extraits du cours ---\n${context}\n\n--- Question de l'apprenant ---\n${question}`,
        },
      ],
      max_output_tokens: 1000,
    });
    await withAiUsage(usageContext, () => recordOpenAiUsage(response.model, response.usage));

    if (!response.output_text) {
      throw new Error("Le modèle n'a renvoyé aucun contenu.");
    }
    answer = response.output_text;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: `Échec de la génération de la réponse : ${message}` }, { status: 500 });
  }

  // Titres des leçons sources, résolus à part plutôt que laissés au LLM : on
  // ne fait confiance qu'aux chunks réellement retrouvés pour dire d'où vient
  // une réponse, jamais à ce que le modèle affirmerait lui-même sur sa propre
  // source (même risque d'hallucination que le reste du contenu généré).
  const lessonIds = [...new Set(relevantChunks.map((c) => c.lessonId).filter((id): id is string => !!id))];
  let lessonTitles: Record<string, string> = {};
  if (lessonIds.length > 0) {
    const { data: lecons } = await supabase.from("lecons").select("id, title").in("id", lessonIds);
    lessonTitles = Object.fromEntries((lecons ?? []).map((l) => [l.id, l.title]));
  }

  const sources = relevantChunks.map((c) => ({
    id: c.id,
    similarity: c.similarity,
    lessonId: c.lessonId,
    lessonTitle: c.lessonId ? (lessonTitles[c.lessonId] ?? null) : null,
  }));

  // sources persisté avec le message pour que la citation reste visible après
  // un rechargement de page (l'historique GET la relit telle quelle).
  await supabase.from("agent_messages").insert({
    tenant_id: guard.tenantId,
    user_id: guard.userId,
    formation_id: formationId,
    role: "assistant",
    content: answer,
    sources,
  });

  return NextResponse.json({ answer, sources });
}
