import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; moduleId: string; leconId: string }> };

// GET /quiz — quiz + questions for a lecon
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { leconId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from("quizzes")
    .select("*, quiz_questions(*)")
    .eq("lecon_id", leconId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? null });
}

// POST /quiz — create quiz (called on first save)
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { leconId } = await params;
  const { title, pass_score = 70, questions = [] } = await req.json();

  const supabase = createServiceRoleSupabaseClient();

  const { data: quiz, error } = await supabase
    .from("quizzes")
    .insert({ lecon_id: leconId, title, pass_score })
    .select()
    .single();

  if (error) {
    console.error("[quiz POST] insert quizzes error:", JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (questions.length > 0) {
    const { error: qErr } = await supabase.from("quiz_questions").insert(
      questions.map((q: { question_text: string; options: object; points?: number }, i: number) => ({
        quiz_id: quiz.id,
        question_text: q.question_text,
        options: q.options,
        order_index: i,
        points: q.points ?? 1,
      }))
    );
    if (qErr) console.error("[quiz POST] insert quiz_questions error:", JSON.stringify(qErr));
  }

  const { data: full } = await supabase
    .from("quizzes")
    .select("*, quiz_questions(*)")
    .eq("id", quiz.id)
    .single();

  return NextResponse.json({ data: full }, { status: 201 });
}

// PUT /quiz — update quiz + replace all questions
export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { leconId } = await params;
  const { title, pass_score, questions = [] } = await req.json();

  const supabase = createServiceRoleSupabaseClient();

  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id")
    .eq("lecon_id", leconId)
    .single();

  if (!quiz) return NextResponse.json({ error: "Quiz introuvable" }, { status: 404 });

  await supabase
    .from("quizzes")
    .update({ title, pass_score, updated_at: new Date().toISOString() })
    .eq("id", quiz.id);

  await supabase.from("quiz_questions").delete().eq("quiz_id", quiz.id);

  if (questions.length > 0) {
    await supabase.from("quiz_questions").insert(
      questions.map((q: { question_text: string; options: object; points?: number }, i: number) => ({
        quiz_id: quiz.id,
        question_text: q.question_text,
        options: q.options,
        order_index: i,
        points: q.points ?? 1,
      }))
    );
  }

  const { data: full } = await supabase
    .from("quizzes")
    .select("*, quiz_questions(*)")
    .eq("id", quiz.id)
    .single();

  return NextResponse.json({ data: full });
}

// DELETE /quiz
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { leconId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("quizzes").delete().eq("lecon_id", leconId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
