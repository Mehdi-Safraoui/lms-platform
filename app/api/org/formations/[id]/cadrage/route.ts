import { NextRequest, NextResponse } from "next/server";
import { requireAdminTenant } from "@/lib/api/require-admin-tenant";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const NIVEAUX = ["debutant", "intermediaire", "avance"] as const;

// GET /api/org/formations/[id]/cadrage — relit les réponses déjà enregistrées
// (permet de reprendre le stepper là où le Formateur l'a laissé).
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { data } = await supabase.from("formation_cadrage").select("*").eq("formation_id", formationId).maybeSingle();
  return NextResponse.json({ data });
}

// POST /api/org/formations/[id]/cadrage — enregistre le cadrage complet (dernière
// étape du stepper, "Valider le cadrage") — un seul upsert plutôt qu'une écriture
// par étape, le state intermédiaire du stepper vit côté client jusqu'à validation.
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const { objectif, public_vise, niveau, nb_modules_souhaite, duree_estimee, notions_a_inclure, notions_a_exclure } = body;

  if (typeof objectif !== "string" || !objectif.trim()) {
    return NextResponse.json({ error: "Objectif manquant." }, { status: 400 });
  }
  if (typeof public_vise !== "string" || !public_vise.trim()) {
    return NextResponse.json({ error: "Public visé manquant." }, { status: 400 });
  }
  if (!NIVEAUX.includes(niveau)) {
    return NextResponse.json({ error: "Niveau invalide." }, { status: 400 });
  }
  if (!Number.isInteger(nb_modules_souhaite) || nb_modules_souhaite < 1 || nb_modules_souhaite > 20) {
    return NextResponse.json({ error: "Nombre de modules invalide (1 à 20)." }, { status: 400 });
  }
  if (typeof duree_estimee !== "string" || !duree_estimee.trim()) {
    return NextResponse.json({ error: "Durée estimée manquante." }, { status: 400 });
  }
  if (!Array.isArray(notions_a_inclure) || !notions_a_inclure.every((n) => typeof n === "string")) {
    return NextResponse.json({ error: "Notions à inclure invalides." }, { status: 400 });
  }
  if (!Array.isArray(notions_a_exclure) || !notions_a_exclure.every((n) => typeof n === "string")) {
    return NextResponse.json({ error: "Notions à exclure invalides." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("formation_cadrage")
    .upsert(
      {
        formation_id: formationId,
        objectif: objectif.trim(),
        public_vise: public_vise.trim(),
        niveau,
        nb_modules_souhaite,
        duree_estimee: duree_estimee.trim(),
        notions_a_inclure,
        notions_a_exclure,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "formation_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
