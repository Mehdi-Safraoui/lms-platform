import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/formations/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("formations").select("*").eq("id", id).single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
  }
  return NextResponse.json({ data });
}

// PUT /api/formations/[id] — mise à jour partielle
export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const body = await req.json();
  const { title, slug, description, thumbnail_url, is_published, tenant_id, niveau } = body;

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("formations")
    .update({
      ...(title !== undefined && { title }),
      ...(slug !== undefined && { slug }),
      ...(description !== undefined && { description }),
      ...(thumbnail_url !== undefined && { thumbnail_url }),
      ...(is_published !== undefined && { is_published }),
      ...(tenant_id !== undefined && { tenant_id }),
      ...(niveau !== undefined && { niveau }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
  }
  return NextResponse.json({ data });
}

// DELETE /api/formations/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("formations").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
