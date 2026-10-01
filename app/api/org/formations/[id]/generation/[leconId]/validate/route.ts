import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { touchFormation } from "@/lib/api/touch-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { embedAndInsertLessonChunks } from "@/lib/chunkLesson";
import { withAiUsage } from "@/lib/aiUsage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; leconId: string }> };

// POST /api/org/formations/[id]/generation/[leconId]/validate — carte "Bouton
// Valider et passer à la leçon suivante". Marque la leçon comme validée par le
// Formateur et indexe son contenu pour le chat RAG apprenant (même hook que la
// route d'édition V1, mais avec le vrai tenant_id cette fois — cette formation
// appartient à un tenant, contrairement au catalogue global du super_admin).
export async function POST(_req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, leconId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { data: lecon } = await supabase
    .from("lecons")
    .select("id, content_type, content_blocks, video_url, modules!inner(formation_id)")
    .eq("id", leconId)
    .single();
  const leconFormationId = (lecon?.modules as unknown as { formation_id: string } | null)?.formation_id;
  if (!lecon || leconFormationId !== formationId) {
    return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  }

  if (lecon.content_type === "rich") {
    if (!lecon.content_blocks) {
      return NextResponse.json({ error: "Cette leçon n'a pas encore de contenu généré." }, { status: 400 });
    }
  } else if (lecon.content_type === "video") {
    if (!lecon.video_url) {
      return NextResponse.json({ error: "Cette leçon n'a pas encore de lien vidéo." }, { status: 400 });
    }
  } else {
    const { count } = await supabase
      .from("quizzes")
      .select("quiz_questions(id)", { count: "exact", head: true })
      .eq("lecon_id", leconId);
    if (!count) {
      return NextResponse.json({ error: "Ce quiz n'a pas encore été généré." }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("lecons")
    .update({ content_validated_at: new Date().toISOString() })
    .eq("id", leconId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await touchFormation(supabase, formationId);

  if (lecon.content_type === "rich") {
    try {
      await withAiUsage({ tenantId: guard.tenantId, formationId, userId: guard.userId, feature: "indexation_lecons" }, () =>
        embedAndInsertLessonChunks(leconId, formationId, guard.tenantId, lecon.content_blocks)
      );
    } catch (err) {
      console.error(`[generation validate] Indexation RAG échouée pour la leçon ${leconId}:`, err);
    }
  }

  return NextResponse.json({ data });
}
