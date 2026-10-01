import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getOrCreateSourcesSummary } from "@/lib/sourcesSummary";
import { withAiUsage } from "@/lib/aiUsage";

export const dynamic = "force-dynamic";
// Génération de la synthèse à partir du texte complet des documents (~30 s).
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

// POST /api/org/formations/[id]/cadrage/summary — prépare la fiche de synthèse
// des documents (lib/sourcesSummary.ts) dès l'ouverture du cadrage, pour que
// le premier "Décider pour moi" n'ait pas à attendre sa génération. Sans effet
// si la synthèse existe déjà pour les mêmes documents.
export async function POST(_req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  try {
    const summary = await withAiUsage({ tenantId: guard.tenantId, formationId, userId: guard.userId, feature: "cadrage" }, () => getOrCreateSourcesSummary(supabase, formationId));
    return NextResponse.json({ data: { ready: summary !== null } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue lors de la synthèse.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
