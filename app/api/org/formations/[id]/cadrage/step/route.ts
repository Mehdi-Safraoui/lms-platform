import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import {
  reformulateOpenField,
  reformulateListField,
  type OpenCadrageField,
  type ListCadrageField,
} from "@/lib/ai/reformulateCadrage";
import { withAiUsage } from "@/lib/aiUsage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// duree_estimee n'est plus une réponse libre reformulée par l'IA : c'est un
// sélecteur par tranches de 30 min côté client (voir CadrageClient.tsx), donc
// jamais envoyé à cette route.
const OPEN_FIELDS: OpenCadrageField[] = ["objectif", "public_vise"];
const LIST_FIELDS: ListCadrageField[] = ["notions_a_inclure", "notions_a_exclure"];
const MAX_ANSWER_LENGTH = 2000;

// POST /api/org/formations/[id]/cadrage/step — reformule une réponse libre du
// stepper de cadrage (un champ à la fois, appelé à chaque étape du skill) via
// l'IA, sans rien persister — l'enregistrement définitif se fait au clic sur
// "Valider le cadrage" (POST /api/org/formations/[id]/cadrage).
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const field = body?.field;
  const rawAnswer = body?.rawAnswer;

  if (typeof rawAnswer !== "string" || !rawAnswer.trim()) {
    return NextResponse.json({ error: "Réponse manquante." }, { status: 400 });
  }
  if (rawAnswer.length > MAX_ANSWER_LENGTH) {
    return NextResponse.json({ error: "Réponse trop longue." }, { status: 400 });
  }

  try {
    if (OPEN_FIELDS.includes(field)) {
      const result = await withAiUsage({ tenantId: guard.tenantId, formationId, userId: guard.userId, feature: "cadrage" }, () => reformulateOpenField(field, rawAnswer.trim()));
      return NextResponse.json({ data: result });
    }
    if (LIST_FIELDS.includes(field)) {
      const result = await withAiUsage({ tenantId: guard.tenantId, formationId, userId: guard.userId, feature: "cadrage" }, () => reformulateListField(field, rawAnswer.trim()));
      return NextResponse.json({ data: result });
    }
    return NextResponse.json({ error: `Champ inconnu : "${field}".` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue lors de la reformulation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
