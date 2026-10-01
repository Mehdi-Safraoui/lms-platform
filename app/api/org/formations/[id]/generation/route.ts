import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getFormationQuota } from "@/lib/aiGenerationQuota";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

interface RawLeconRow {
  id: string;
  title: string;
  content_type: "rich" | "quiz" | "video";
  generation_brief: string | null;
  content_blocks: unknown;
  video_url: string | null;
  content_validated_at: string | null;
  order_index: number;
}

// GET /api/org/formations/[id]/generation — liste modules + leçons de la
// formation avec leur état de génération (contenu présent, validé ou non),
// pour piloter la progression côté UI (carte "afficher le contenu généré").
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { data: modules, error } = await supabase
    .from("modules")
    .select(
      "id, title, order_index, lecons(id, title, content_type, generation_brief, content_blocks, video_url, content_validated_at, order_index)"
    )
    .eq("formation_id", formationId)
    .order("order_index");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leconIds = (modules ?? []).flatMap((m) => (m.lecons as { id: string }[]).map((l) => l.id));
  const { data: quizzes } =
    leconIds.length > 0
      ? await supabase
          .from("quizzes")
          .select("lecon_id, quiz_questions(question_text, options, order_index)")
          .in("lecon_id", leconIds)
      : { data: [] as { lecon_id: string; quiz_questions: { question_text: string; options: unknown; order_index: number }[] }[] };
  const quizByLecon = new Map((quizzes ?? []).map((q) => [q.lecon_id, q.quiz_questions]));

  const data = (modules ?? [])
    .sort((a, b) => a.order_index - b.order_index)
    .map((mod) => ({
      id: mod.id,
      title: mod.title,
      lecons: (mod.lecons as RawLeconRow[])
        .sort((a, b) => a.order_index - b.order_index)
        .map((l) => {
          const quizQuestions = (quizByLecon.get(l.id) ?? []).sort((a, b) => a.order_index - b.order_index);
          const hasContent =
            l.content_type === "quiz" ? quizQuestions.length > 0
            : l.content_type === "video" ? !!l.video_url
            : !!l.content_blocks;
          return {
            id: l.id,
            title: l.title,
            contentType: l.content_type,
            generationBrief: l.generation_brief,
            hasContent,
            contentBlocks: l.content_blocks,
            videoUrl: l.video_url,
            quizQuestions: l.content_type === "quiz" ? quizQuestions : null,
            validatedAt: l.content_validated_at,
          };
        }),
    }));

  const quota = await getFormationQuota(guard.tenantId, formationId);

  return NextResponse.json({
    data: { modules: data, quota },
  });
}
