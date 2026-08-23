import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { assertGlobalCatalogueFormation } from "@/lib/api/assert-global-catalogue-formation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/formations/[id]/modules
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: formation_id } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertGlobalCatalogueFormation(supabase, formation_id))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .eq("formation_id", formation_id)
    .order("order_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/formations/[id]/modules
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const { id: formation_id } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertGlobalCatalogueFormation(supabase, formation_id))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const { title, order_index } = body;

  if (!title) return NextResponse.json({ error: "title est requis" }, { status: 400 });

  const { data, error } = await supabase
    .from("modules")
    .insert({ formation_id, title, order_index: order_index ?? 0 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
