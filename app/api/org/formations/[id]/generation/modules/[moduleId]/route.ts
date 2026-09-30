import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { touchFormation } from "@/lib/api/touch-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; moduleId: string }> };
type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

async function assertOwnModule(supabase: Supabase, moduleId: string, formationId: string): Promise<boolean> {
  const { data } = await supabase.from("modules").select("id, formation_id").eq("id", moduleId).single();
  return !!data && data.formation_id === formationId;
}

// PUT /api/org/formations/[id]/generation/modules/[moduleId] — renommer.
// Interdit sur une formation publiée — trouvé en creusant la carte "ajouter un
// module/une leçon après publication" : le bouton était bien caché côté
// client, mais rien n'empêchait un appel API direct de renommer/supprimer un
// module d'une formation déjà vue par des apprenants.
export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, moduleId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId)) || !(await assertOwnModule(supabase, moduleId, formationId))) {
    return NextResponse.json({ error: "Module introuvable" }, { status: 404 });
  }
  const { data: formation } = await supabase.from("formations").select("is_published").eq("id", formationId).single();
  if (formation?.is_published) {
    return NextResponse.json({ error: "Impossible de renommer un module d'une formation déjà publiée." }, { status: 409 });
  }

  const { title } = await req.json().catch(() => ({}));
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  }

  const { data, error } = await supabase.from("modules").update({ title: title.trim() }).eq("id", moduleId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await touchFormation(supabase, formationId);
  return NextResponse.json({ data });
}

// DELETE /api/org/formations/[id]/generation/modules/[moduleId] — supprime le
// module et tout ce qu'il contient (leçons, quiz, chunks — cascade base).
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, moduleId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId)) || !(await assertOwnModule(supabase, moduleId, formationId))) {
    return NextResponse.json({ error: "Module introuvable" }, { status: 404 });
  }
  const { data: formation } = await supabase.from("formations").select("is_published").eq("id", formationId).single();
  if (formation?.is_published) {
    return NextResponse.json({ error: "Impossible de supprimer un module d'une formation déjà publiée." }, { status: 409 });
  }

  const { count } = await supabase.from("modules").select("*", { count: "exact", head: true }).eq("formation_id", formationId);
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: "Impossible de supprimer le dernier module de la formation." }, { status: 400 });
  }

  const { error } = await supabase.from("modules").delete().eq("id", moduleId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await touchFormation(supabase, formationId);
  return new NextResponse(null, { status: 204 });
}
