import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getOrCreateSourcesSummary } from "@/lib/sourcesSummary";
import { suggestFullCadrage, type CadrageContext } from "@/lib/ai/suggestCadrage";

export const dynamic = "force-dynamic";
// Le premier appel peut devoir générer la synthèse (~30 s) avant la suggestion.
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

// POST /api/org/formations/[id]/cadrage/suggest — bouton "Décider pour moi" du
// stepper de cadrage : propose TOUT le cadrage en un seul appel (les 7 champs),
// ancré dans les vrais documents source de la formation et cohérent avec les
// réponses déjà données (reprises telles quelles). Le stepper préremplit
// ensuite chaque étape sans nouvel appel, et ne relance une proposition que si
// le Formateur s'écarte d'une valeur proposée. Le modèle reçoit la fiche de
// synthèse des documents (lib/sourcesSummary.ts), produite une fois à partir
// de leur texte complet puis réutilisée : les champs du cadrage demandent une
// vue d'ensemble, qu'une recherche vectorielle ciblée ne donnerait pas.
//
// Ne compte PAS dans ai_generation_quota — décision produit (aide à la saisie,
// pas une génération de formation), voir échange avec l'encadrant.
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const context: CadrageContext = body?.context ?? {};

  try {
    const documentContext = await getOrCreateSourcesSummary(supabase, formationId);
    if (!documentContext) {
      return NextResponse.json(
        { error: "Aucun document indexé pour cette formation — impossible de proposer une réponse." },
        { status: 400 }
      );
    }
    return NextResponse.json({ data: await suggestFullCadrage(documentContext, context) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue lors de la suggestion.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
