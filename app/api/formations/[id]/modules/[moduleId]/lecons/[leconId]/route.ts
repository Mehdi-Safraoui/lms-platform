import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; moduleId: string; leconId: string }> };

// GET /api/formations/[id]/modules/[moduleId]/lecons/[leconId]
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { leconId } = await params;
  const supabase = createServiceRoleSupabaseClient();
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

  const { leconId } = await params;
  const body = await req.json();
  const { title, content_type, content_markdown, video_url, order_index, duration_minutes, is_preview } = body;

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("lecons")
    .update({
      ...(title !== undefined && { title }),
      ...(content_type !== undefined && { content_type }),
      ...(content_markdown !== undefined && { content_markdown }),
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
  return NextResponse.json({ data });
}

// DELETE /api/formations/[id]/modules/[moduleId]/lecons/[leconId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { leconId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("lecons").delete().eq("id", leconId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
