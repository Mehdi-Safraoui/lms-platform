import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; moduleId: string }> };

// GET /api/formations/[id]/modules/[moduleId]/lecons
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { moduleId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("lecons")
    .select("*")
    .eq("module_id", moduleId)
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/formations/[id]/modules/[moduleId]/lecons
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { moduleId } = await params;
  const body = await req.json();
  const { title, content_type, content_markdown, video_url, order_index, duration_minutes, is_preview } = body;

  if (!title || !content_type) {
    return NextResponse.json({ error: "title et content_type sont requis" }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("lecons")
    .insert({
      module_id: moduleId,
      title,
      content_type,
      content_markdown: content_markdown ?? null,
      video_url: video_url ?? null,
      order_index: order_index ?? 0,
      duration_minutes: duration_minutes ?? null,
      is_preview: is_preview ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
