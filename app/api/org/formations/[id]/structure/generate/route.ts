import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canAuthorFormationByAi } from "@/lib/subscription";
import { generateStructureProposal, type CadrageInput } from "@/lib/ai/generateStructureProposal";

export const dynamic = "force-dynamic";
// Génération par le modèle le plus capable (OPENAI_GENERATION_MODEL) : mesuré
// à ~30-40 s par appel, et jusqu'à 3 tentatives en cas de sortie invalide.
export const maxDuration = 180;

type Params = { params: Promise<{ id: string }> };

// POST /api/org/formations/[id]/structure/generate — génère (ou régénère) la
// proposition de structure à partir du cadrage + de TOUS les chunks-documents de
// la formation (pas une recherche vectorielle ciblée : on veut une vue
// d'ensemble, voir Point 4 de l'architecture validée). Écrase tout brouillon
// existant non encore validé.
export async function POST(_req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }
  if (!(await canAuthorFormationByAi(guard.tenantId))) {
    return NextResponse.json(
      { error: "La génération de formation par IA nécessite l'offre Création ou Entreprise.", code: "plan_upgrade_required" },
      { status: 403 }
    );
  }

  const { data: existing } = await supabase
    .from("formation_structure")
    .select("validated_at")
    .eq("formation_id", formationId)
    .maybeSingle();
  if (existing?.validated_at) {
    return NextResponse.json({ error: "Cette structure a déjà été validée." }, { status: 409 });
  }

  const { data: cadrage } = await supabase.from("formation_cadrage").select("*").eq("formation_id", formationId).maybeSingle();
  if (!cadrage?.completed_at) {
    return NextResponse.json({ error: "Le cadrage de cette formation n'a pas encore été validé." }, { status: 400 });
  }

  const { data: chunks, error: chunksError } = await supabase
    .from("chunks")
    .select("content")
    .eq("formation_id", formationId)
    .not("knowledge_source_id", "is", null);
  if (chunksError) return NextResponse.json({ error: chunksError.message }, { status: 500 });
  if (!chunks || chunks.length === 0) {
    return NextResponse.json({ error: "Aucun document indexé pour cette formation." }, { status: 400 });
  }

  const cadrageInput: CadrageInput = {
    objectif: cadrage.objectif,
    publicVise: cadrage.public_vise,
    niveau: cadrage.niveau,
    nbModulesSouhaite: cadrage.nb_modules_souhaite,
    dureeEstimee: cadrage.duree_estimee,
    notionsAInclure: cadrage.notions_a_inclure ?? [],
    notionsAExclure: cadrage.notions_a_exclure ?? [],
  };

  try {
    const proposal = await generateStructureProposal(cadrageInput, chunks.map((c) => c.content).join("\n\n"));

    const { data, error } = await supabase
      .from("formation_structure")
      .upsert(
        { formation_id: formationId, proposal, updated_at: new Date().toISOString() },
        { onConflict: "formation_id" }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue lors de la génération.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
