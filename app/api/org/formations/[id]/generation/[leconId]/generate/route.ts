import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { touchFormation } from "@/lib/api/touch-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canAuthorFormationByAi } from "@/lib/subscription";
import { searchChunks } from "@/lib/searchChunks";
import { generateLessonContent, generateLessonQuiz, type LessonGenerationInput } from "@/lib/ai/generateLessonContent";
import type { CadrageInput } from "@/lib/ai/generateStructureProposal";
import { consumeFormationAi, quotaRefusalMessage } from "@/lib/aiGenerationQuota";

export const dynamic = "force-dynamic";
// Génération par le modèle le plus capable (OPENAI_GENERATION_MODEL) : mesuré
// à ~30-40 s par appel, et jusqu'à 3 tentatives en cas de sortie invalide.
export const maxDuration = 180;

type Params = { params: Promise<{ id: string; leconId: string }> };

const RAG_TOP_K_LESSON = 8;
const RAG_TOP_K_QUIZ = 12;

// POST /api/org/formations/[id]/generation/[leconId]/generate — (re)génère le
// contenu d'UNE leçon (bloc-contenu si "rich", questions si "quiz"). Réutilisable
// tel quel pour le bouton "Régénérer" : écrase le contenu précédent et remet
// content_validated_at à null (une régénération invalide la validation
// précédente — la structure, elle, reste intacte, seule la matérialisation en
// modules/lecons pourrait la perdre, ce que cette route ne touche jamais).
export async function POST(_req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, leconId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }
  if (!(await canAuthorFormationByAi(guard.tenantId))) {
    return NextResponse.json(
      { error: "La génération de formation par IA nécessite l'offre Création ou Entreprise.", code: "plan_upgrade_required" },
      { status: 403 }
    );
  }

  // Vérifié avant de consommer le quota : une leçon vidéo ne se génère jamais
  // par IA, inutile (et malhonnête) de facturer une génération pour un appel
  // qui échouera de toute façon.
  const { data: lecon } = await supabase
    .from("lecons")
    .select("id, title, content_type, generation_brief, module_id, modules!inner(formation_id)")
    .eq("id", leconId)
    .single();
  const leconFormationId = (lecon?.modules as unknown as { formation_id: string } | null)?.formation_id;
  if (!lecon || leconFormationId !== formationId) {
    return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  }
  if (lecon.content_type === "video") {
    return NextResponse.json({ error: "Les leçons vidéo ne se génèrent pas par IA — ajoutez directement un lien." }, { status: 400 });
  }

  const quotaResult = await consumeFormationAi(guard.tenantId, formationId);
  if (!quotaResult.allowed) {
    return NextResponse.json(
      {
        error: quotaRefusalMessage(quotaResult),
        code: "quota_exceeded",
      },
      { status: 403 }
    );
  }

  const { data: cadrageRow } = await supabase.from("formation_cadrage").select("*").eq("formation_id", formationId).maybeSingle();
  if (!cadrageRow?.completed_at) {
    return NextResponse.json({ error: "Le cadrage de cette formation n'a pas encore été validé." }, { status: 400 });
  }
  const cadrage: CadrageInput = {
    objectif: cadrageRow.objectif,
    publicVise: cadrageRow.public_vise,
    niveau: cadrageRow.niveau,
    nbModulesSouhaite: cadrageRow.nb_modules_souhaite,
    dureeEstimee: cadrageRow.duree_estimee,
    notionsAInclure: cadrageRow.notions_a_inclure ?? [],
    notionsAExclure: cadrageRow.notions_a_exclure ?? [],
  };

  try {
    if (lecon.content_type === "quiz") {
      // Le quiz teste tout le module : la requête RAG couvre les leçons
      // "rich" sœurs du même module, pas uniquement cette leçon quiz.
      const { data: siblings } = await supabase
        .from("lecons")
        .select("title, generation_brief")
        .eq("module_id", lecon.module_id)
        .eq("content_type", "rich");
      const query = (siblings ?? []).map((s) => `${s.title}. ${s.generation_brief ?? ""}`).join(" ") || lecon.title;

      const chunks = await searchChunks(query, formationId, RAG_TOP_K_QUIZ, "document");
      const input: LessonGenerationInput = {
        leconTitle: lecon.title,
        leconDescription: lecon.generation_brief ?? "",
        cadrage,
        ragContext: chunks.map((c) => c.content).join("\n\n"),
      };
      const questions = await generateLessonQuiz(input);

      await supabase.from("quizzes").delete().eq("lecon_id", leconId);
      const { data: quizRow, error: quizError } = await supabase
        .from("quizzes")
        .insert({ lecon_id: leconId, title: lecon.title, pass_score: 70 })
        .select("id")
        .single();
      if (quizError || !quizRow) throw new Error(`Échec de création du quiz : ${quizError?.message}`);

      const rows = questions.map((q, qi) => ({
        quiz_id: quizRow.id,
        question_text: q.question,
        options: q.options.map((text, oi) => ({ text, is_correct: oi === q.correctIndex })),
        order_index: qi,
        points: 1,
      }));
      const { error: questionsError } = await supabase.from("quiz_questions").insert(rows);
      if (questionsError) throw new Error(`Échec de création des questions : ${questionsError.message}`);

      await supabase.from("lecons").update({ content_validated_at: null }).eq("id", leconId);
      await touchFormation(supabase, formationId);
      return NextResponse.json({ data: { quiz: questions, quota: { used: quotaResult.used, total: quotaResult.total, formationCounted: true } } });
    }

    const query = `${lecon.title}. ${lecon.generation_brief ?? ""}`;
    const chunks = await searchChunks(query, formationId, RAG_TOP_K_LESSON, "document");
    const input: LessonGenerationInput = {
      leconTitle: lecon.title,
      leconDescription: lecon.generation_brief ?? "",
      cadrage,
      ragContext: chunks.map((c) => c.content).join("\n\n"),
    };
    const blocks = await generateLessonContent(input);

    const { error: updateError } = await supabase
      .from("lecons")
      .update({ content_blocks: blocks, content_validated_at: null, updated_at: new Date().toISOString() })
      .eq("id", leconId);
    if (updateError) throw new Error(updateError.message);

    // Désindexe immédiatement l'ancien contenu plutôt que d'attendre la
    // revalidation : si cette leçon appartient à une formation déjà publiée,
    // laisser les anciens chunks en place pendant l'édition ferait répondre le
    // chat apprenant avec du contenu périmé jusqu'à ce que le Formateur
    // revalide. Mieux vaut un "aucune info trouvée" honnête qu'une réponse
    // fausse — les chunks sont réindexés avec le nouveau contenu à la validation.
    await supabase.from("chunks").delete().eq("lesson_id", leconId);
    await touchFormation(supabase, formationId);

    return NextResponse.json({ data: { blocks, quota: { used: quotaResult.used, total: quotaResult.total, formationCounted: true } } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue lors de la génération.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
