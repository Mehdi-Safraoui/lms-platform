import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { assertGlobalCatalogueFormation } from "@/lib/api/assert-global-catalogue-formation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; moduleId: string }> };

// GET /api/formations/[id]/modules/[moduleId]
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, moduleId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertGlobalCatalogueFormation(supabase, formationId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { data, error } = await supabase.from("modules").select("*").eq("id", moduleId).single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
  }
  return NextResponse.json({ data });
}

// PUT /api/formations/[id]/modules/[moduleId]
export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, moduleId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertGlobalCatalogueFormation(supabase, formationId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const { title, order_index } = body;

  const { data, error } = await supabase
    .from("modules")
    .update({
      ...(title !== undefined && { title }),
      ...(order_index !== undefined && { order_index }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", moduleId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
  }
  return NextResponse.json({ data });
}

// DELETE /api/formations/[id]/modules/[moduleId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, moduleId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertGlobalCatalogueFormation(supabase, formationId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { error } = await supabase.from("modules").delete().eq("id", moduleId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
