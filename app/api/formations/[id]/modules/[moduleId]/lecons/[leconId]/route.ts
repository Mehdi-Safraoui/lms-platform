import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { embedAndInsertLessonChunks } from "@/lib/chunkLesson";
import { assertGlobalCatalogueFormation } from "@/lib/api/assert-global-catalogue-formation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; moduleId: string; leconId: string }> };

// GET /api/formations/[id]/modules/[moduleId]/lecons/[leconId]
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, leconId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertGlobalCatalogueFormation(supabase, formationId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { data, error } = await supabase.from("lecons").select("*").eq("id", leconId).single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
  }
  return NextResponse.json({ data });
}

// PUT /api/formations/[id]/modules/[moduleId]/lecons/[leconId]
export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, leconId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertGlobalCatalogueFormation(supabase, formationId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const { title, content_type, content_markdown, content_blocks, video_url, order_index, duration_minutes, is_preview } = body;

  const { data, error } = await supabase
    .from("lecons")
    .update({
      ...(title !== undefined && { title }),
      ...(content_type !== undefined && { content_type }),
      ...(content_markdown !== undefined && { content_markdown }),
      ...(content_blocks !== undefined && { content_blocks }),
      ...(video_url !== undefined && { video_url }),
      ...(order_index !== undefined && { order_index }),
      ...(duration_minutes !== undefined && { duration_minutes }),
      ...(is_preview !== undefined && { is_preview }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", leconId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
  }

  if (content_blocks !== undefined || content_type !== undefined) {
    try {
      const blocks = data.content_type === "rich" ? data.content_blocks : null;
      await embedAndInsertLessonChunks(leconId, formationId, null, blocks);
    } catch (err) {
      console.error(`[lecons PUT] Indexation RAG échouée pour la leçon ${leconId}:`, err);
    }
  }

  return NextResponse.json({ data });
}

// DELETE /api/formations/[id]/modules/[moduleId]/lecons/[leconId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, leconId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertGlobalCatalogueFormation(supabase, formationId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { error } = await supabase.from("lecons").delete().eq("id", leconId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
