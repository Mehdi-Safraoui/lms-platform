import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/require-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { isQuizAccessibleToTenant } from "@/lib/formationTenantAccess";

export const dynamic = "force-dynamic";

const POINTS_QUIZ = 20;

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  // Le navigateur n'envoie que les réponses choisies : le score est calculé
  // ici, à partir des bonnes réponses en base (avant, il était calculé côté
  // client et accepté tel quel — un apprenant pouvait se déclarer "réussi").
  const body = await req.json().catch(() => null);
  const quiz_id: unknown = body?.quiz_id;
  const rawAnswers: unknown = body?.answers;
  if (typeof quiz_id !== "string" || !Array.isArray(rawAnswers)) {
    return NextResponse.json({ error: "Réponses manquantes — rechargez la page et réessayez." }, { status: 400 });
  }
  const selected = new Map<string, number>();
  for (const a of rawAnswers as { question_id?: unknown; option_index?: unknown }[]) {
    if (typeof a?.question_id === "string" && Number.isInteger(a.option_index)) {
      selected.set(a.question_id, a.option_index as number);
    }
  }

  const supabase = createServiceRoleSupabaseClient();
  const { userId, tenantId } = guard;

  if (!(await isQuizAccessibleToTenant(supabase, tenantId, quiz_id))) {
    return NextResponse.json({ error: "Quiz introuvable" }, { status: 404 });
  }

  const { data: quizRow } = await supabase
    .from("quizzes")
    .select("pass_score, quiz_questions(id, options, points)")
    .eq("id", quiz_id)
    .single();
  const questions = (quizRow?.quiz_questions ?? []) as { id: string; options: { is_correct: boolean }[]; points: number }[];
  if (!quizRow || questions.length === 0) {
    return NextResponse.json({ error: "Quiz introuvable" }, { status: 404 });
  }

  let score = 0;
  let max_score = 0;
  const graded = questions.map((q) => {
    const optionIndex = selected.get(q.id) ?? -1;
    const correctIndex = q.options.findIndex((o) => o.is_correct === true);
    const correct = optionIndex >= 0 && q.options[optionIndex]?.is_correct === true;
    max_score += q.points;
    if (correct) score += q.points;
    return { question_id: q.id, option_index: optionIndex, correct_index: correctIndex, correct };
  });
  const percent = max_score > 0 ? Math.round((score / max_score) * 100) : 0;
  const passed = percent >= quizRow.pass_score;

  // Vérifier si l'utilisateur a déjà réussi ce quiz
  const { data: previousPass } = await supabase
    .from("quiz_results")
    .select("id")
    .eq("user_id", userId)
    .eq("quiz_id", quiz_id)
    .eq("passed", true)
    .maybeSingle();

  const alreadyPassed = !!previousPass;

  // Enregistrer le résultat
  const { error: resultError } = await supabase.from("quiz_results").insert({
    user_id: userId,
    quiz_id,
    tenant_id: tenantId,
    score,
    max_score,
    passed,
    // Réponse par question — alimente l'analyse des quiz du tableau de suivi.
    answers: graded.map(({ question_id, option_index, correct }) => ({ question_id, option_index, correct })),
  });

  if (resultError) {
    console.error("[quiz-passed] quiz_results error:", resultError);
    return NextResponse.json({ error: resultError.message }, { status: 500 });
  }

  // La leçon quiz n'est terminée qu'une fois le quiz RÉUSSI : avant, une
  // tentative ratée la marquait aussi terminée, si bien qu'on pouvait
  // atteindre 100 % d'une formation sans réussir aucun quiz.
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("lecon_id")
    .eq("id", quiz_id)
    .single();

  if (passed && quiz?.lecon_id) {
    await supabase.from("progress").upsert(
      {
        user_id: userId,
        lecon_id: quiz.lecon_id,
        tenant_id: tenantId,
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lecon_id" }
    );
  }

  // Créditer les points si c'est la première réussite
  let pointsAwarded = 0;
  if (passed && !alreadyPassed) {
    const { data: userRow } = await supabase
      .from("users")
      .select("total_points")
      .eq("id", userId)
      .single();

    await supabase
      .from("users")
      .update({ total_points: (userRow?.total_points ?? 0) + POINTS_QUIZ })
      .eq("id", userId);

    pointsAwarded = POINTS_QUIZ;
  }

  return NextResponse.json({
    points_awarded: pointsAwarded,
    already_passed: alreadyPassed,
    score,
    max_score,
    percent,
    passed,
    correction: graded.map(({ question_id, correct_index }) => ({ question_id, correct_index })),
  });
}
