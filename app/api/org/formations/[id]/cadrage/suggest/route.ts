import { NextRequest, NextResponse } from "next/server";
import { requireAdminTenant } from "@/lib/api/require-admin-tenant";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
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
export const maxDuration = 30;

type Params = { params: Promise<{ id: string }> };

const OPEN_FIELDS: CadrageField[] = ["objectif", "public_vise"];
const LIST_FIELDS: CadrageField[] = ["notions_a_inclure", "notions_a_exclure"];

// POST /api/org/formations/[id]/cadrage/suggest — bouton "Décider pour moi" du
// stepper de cadrage : propose une réponse pour UN champ, ancrée dans les vrais
// documents source de la formation (mêmes chunks-documents que la proposition
// de structure — voir structure/generate/route.ts, une vue d'ensemble, pas une
// recherche vectorielle ciblée) et cohérente avec les réponses déjà données
// pour les champs précédents.
//
// Ne compte PAS dans ai_generation_quota — décision produit (aide à la saisie,
// pas une génération de formation), voir échange avec l'encadrant.
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
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

  const { data: chunks, error: chunksError } = await supabase
    .from("chunks")
    .select("content")
    .eq("formation_id", formationId)
    .not("knowledge_source_id", "is", null);
  if (chunksError) return NextResponse.json({ error: chunksError.message }, { status: 500 });
  if (!chunks || chunks.length === 0) {
    return NextResponse.json(
      { error: "Aucun document indexé pour cette formation — impossible de proposer une réponse." },
      { status: 400 }
    );
  }
  const documentContext = chunks.map((c) => c.content).join("\n\n");

  try {
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
