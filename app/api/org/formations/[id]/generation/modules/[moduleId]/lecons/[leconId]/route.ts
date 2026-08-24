import { NextRequest, NextResponse } from "next/server";
import { requireAdminTenant } from "@/lib/api/require-admin-tenant";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; moduleId: string; leconId: string }> };
type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

async function assertOwnLecon(supabase: Supabase, leconId: string, moduleId: string): Promise<boolean> {
  const { data } = await supabase.from("lecons").select("id, module_id").eq("id", leconId).single();
  return !!data && data.module_id === moduleId;
}

// PUT — renommer une leçon (le contenu lui-même se modifie via
// .../generation/[leconId], distinct : ici c'est le titre/type, pas les blocs).
export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, moduleId, leconId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId)) || !(await assertOwnLecon(supabase, leconId, moduleId))) {
    return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  }

  const { title } = await req.json().catch(() => ({}));
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  }

  const { data, error } = await supabase.from("lecons").update({ title: title.trim() }).eq("id", leconId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE — supprime la leçon (quiz/chunks associés cascadent au niveau base).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, moduleId, leconId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId)) || !(await assertOwnLecon(supabase, leconId, moduleId))) {
    return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  }

  const { count } = await supabase.from("lecons").select("*", { count: "exact", head: true }).eq("module_id", moduleId);
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: "Impossible de supprimer la dernière leçon d'un module — supprimez le module entier." }, { status: 400 });
  }

  const { error } = await supabase.from("lecons").delete().eq("id", leconId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
