import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getOrCreateSourcesSummary } from "@/lib/sourcesSummary";
import {
  suggestOpenField,
  suggestListField,
  suggestNiveau,
  suggestNbModules,
  suggestDureeMinutes,
  type CadrageField,
  type CadrageContext,
} from "@/lib/ai/suggestCadrage";

export const dynamic = "force-dynamic";
// Le premier appel peut devoir générer la synthèse (~30 s) avant la suggestion.
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

const OPEN_FIELDS: CadrageField[] = ["objectif", "public_vise"];
const LIST_FIELDS: CadrageField[] = ["notions_a_inclure", "notions_a_exclure"];

// POST /api/org/formations/[id]/cadrage/suggest — bouton "Décider pour moi" du
// stepper de cadrage : propose une réponse pour UN champ, ancrée dans les vrais
// documents source de la formation et cohérente avec les réponses déjà données
// pour les champs précédents. Le modèle reçoit la fiche de synthèse des
// documents (lib/sourcesSummary.ts), produite une fois à partir de leur texte
// complet puis réutilisée : les champs du cadrage demandent une vue
// d'ensemble, qu'une recherche vectorielle ciblée ne donnerait pas, et
// renvoyer tout le document à chacun des 7 champs serait lent et coûteux.
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
  const field: CadrageField | undefined = body?.field;
  const context: CadrageContext = body?.context ?? {};

  if (!field) {
    return NextResponse.json({ error: "Champ manquant." }, { status: 400 });
  }

  try {
    const documentContext = await getOrCreateSourcesSummary(supabase, formationId);
    if (!documentContext) {
      return NextResponse.json(
        { error: "Aucun document indexé pour cette formation — impossible de proposer une réponse." },
        { status: 400 }
      );
    }

    if (OPEN_FIELDS.includes(field)) {
      const result = await suggestOpenField(field as "objectif" | "public_vise", documentContext, context);
      return NextResponse.json({ data: result });
    }
    if (LIST_FIELDS.includes(field)) {
      const result = await suggestListField(field as "notions_a_inclure" | "notions_a_exclure", documentContext, context);
      return NextResponse.json({ data: result });
    }
    if (field === "niveau") {
      const result = await suggestNiveau(documentContext, context);
      return NextResponse.json({ data: result });
    }
    if (field === "nb_modules_souhaite") {
      const result = await suggestNbModules(documentContext, context);
      return NextResponse.json({ data: result });
    }
    if (field === "duree_estimee") {
      const result = await suggestDureeMinutes(documentContext, context);
      return NextResponse.json({ data: result });
    }
    return NextResponse.json({ error: `Champ inconnu : "${field}".` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue lors de la suggestion.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
