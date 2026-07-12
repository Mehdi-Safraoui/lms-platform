import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/require-auth";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const POINTS_QUIZ = 20;

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard instanceof NextResponse) return guard;

  const { quiz_id, score, max_score, passed } = await req.json();
  if (!quiz_id || score === undefined || max_score === undefined || passed === undefined) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();
  const { userId, tenantId } = guard;

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
  });

  if (resultError) {
    console.error("[quiz-passed] quiz_results error:", resultError);
    return NextResponse.json({ error: resultError.message }, { status: 500 });
  }

  // Marquer la leçon comme terminée (récupérer lecon_id depuis quizzes)
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("lecon_id")
    .eq("id", quiz_id)
    .single();

  if (quiz?.lecon_id) {
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

  return NextResponse.json({ points_awarded: pointsAwarded, already_passed: alreadyPassed });
}
