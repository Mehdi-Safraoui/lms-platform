import { NextRequest, NextResponse } from "next/server";
import { requireAdminTenant } from "@/lib/api/require-admin-tenant";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { StructureProposal } from "@/lib/ai/structureProposal";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/org/formations/[id]/structure/validate — matérialise le brouillon
// (potentiellement édité par le Formateur) en vraies lignes modules/lecons,
// exactement le même schéma qu'une formation créée manuellement (mêmes tables) —
// content_blocks reste null : la génération de contenu leçon par leçon est la
// liste suivante, pas encore construite. Idempotent : une structure déjà
// validée ne peut pas être matérialisée une seconde fois (éviterait des
// modules/leçons en double).
export async function POST(_req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { data: structureRow } = await supabase
    .from("formation_structure")
    .select("proposal, validated_at")
    .eq("formation_id", formationId)
    .maybeSingle();

  if (!structureRow) {
    return NextResponse.json({ error: "Aucune structure à valider pour cette formation." }, { status: 400 });
  }
  if (structureRow.validated_at) {
    return NextResponse.json({ error: "Cette structure a déjà été validée." }, { status: 409 });
  }

  const proposal = structureRow.proposal as StructureProposal;
  if (!proposal?.modules?.length) {
    return NextResponse.json({ error: "Structure vide." }, { status: 400 });
  }

  try {
    for (let mi = 0; mi < proposal.modules.length; mi++) {
      const mod = proposal.modules[mi];
      const { data: moduleRow, error: moduleError } = await supabase
        .from("modules")
        .insert({ formation_id: formationId, title: mod.title, order_index: mi })
        .select("id")
        .single();
      if (moduleError || !moduleRow) {
        throw new Error(`Échec de création du module "${mod.title}" : ${moduleError?.message}`);
      }

      const lessonRows = mod.lessons.map((lesson, li) => ({
        module_id: moduleRow.id,
        title: lesson.title,
        content_type: lesson.contentType === "quiz" ? "quiz" : "rich",
        content_blocks: null,
        order_index: li,
      }));
      const { error: leconsError } = await supabase.from("lecons").insert(lessonRows);
      if (leconsError) {
        throw new Error(`Échec de création des leçons du module "${mod.title}" : ${leconsError.message}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue lors de la matérialisation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { error: validateError } = await supabase
    .from("formation_structure")
    .update({ validated_at: new Date().toISOString() })
    .eq("formation_id", formationId);
  if (validateError) return NextResponse.json({ error: validateError.message }, { status: 500 });

  return NextResponse.json({ data: { formationId } });
}
