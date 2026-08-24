import { NextRequest, NextResponse } from "next/server";
import { requireAdminTenant } from "@/lib/api/require-admin-tenant";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; leconId: string }> };

// PUT /api/org/formations/[id]/generation/[leconId] — enregistre le contenu
// édité manuellement par le Formateur dans l'éditeur (BlockEditor, carte
// "permettre au Formateur d'éditer le contenu généré directement dans
// l'éditeur"). Toute modification — édition manuelle comme régénération IA —
// invalide la validation précédente : voir POST .../generate pour la même
// règle appliquée côté régénération.
export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, leconId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { data: lecon } = await supabase
    .from("lecons")
    .select("id, content_type, modules!inner(formation_id)")
    .eq("id", leconId)
    .single();
  const leconFormationId = (lecon?.modules as unknown as { formation_id: string } | null)?.formation_id;
  if (!lecon || leconFormationId !== formationId) {
    return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
  }
  if (lecon.content_type !== "rich") {
    return NextResponse.json({ error: "Seules les leçons de contenu peuvent être éditées ici." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.blocks)) {
    return NextResponse.json({ error: "Blocs de contenu invalides." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lecons")
    .update({ content_blocks: body.blocks, content_validated_at: null, updated_at: new Date().toISOString() })
    .eq("id", leconId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Même raisonnement que POST .../generate : ne jamais laisser des chunks
  // périmés servir de réponse au chat apprenant pendant qu'une leçon déjà
  // publiée est en cours de retouche.
  await supabase.from("chunks").delete().eq("lesson_id", leconId);

  return NextResponse.json({ data });
}
