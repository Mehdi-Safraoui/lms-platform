import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/org/formations/[id]/structure — relit le brouillon de structure
// (généré puis potentiellement édité côté client) pour reprendre où on en était.
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { data } = await supabase.from("formation_structure").select("*").eq("formation_id", formationId).maybeSingle();
  return NextResponse.json({ data });
}

// PUT /api/org/formations/[id]/structure — enregistre le brouillon tel qu'édité
// par le Formateur (renommer/réordonner/ajouter/supprimer, carte 45) sans jamais
// relancer l'IA — la génération est un appel séparé (POST .../structure/generate).
export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("formation_structure")
    .select("validated_at")
    .eq("formation_id", formationId)
    .maybeSingle();
  if (existing?.validated_at) {
    return NextResponse.json({ error: "Cette structure a déjà été validée." }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.proposal || typeof body.proposal !== "object" || !Array.isArray(body.proposal.modules)) {
    return NextResponse.json({ error: "Structure invalide." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("formation_structure")
    .upsert(
      { formation_id: formationId, proposal: body.proposal, updated_at: new Date().toISOString() },
      { onConflict: "formation_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
