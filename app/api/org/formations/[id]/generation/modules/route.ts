import { NextRequest, NextResponse } from "next/server";
import { requireAdminTenant } from "@/lib/api/require-admin-tenant";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/org/formations/[id]/generation/modules — ajoute un module (avec
// une première leçon vide) à une structure déjà validée. Carte "trouvée en
// creusant" : une fois "Valider la structure" cliqué, rien ne permettait plus
// d'ajouter/retirer un module ou une leçon si le Formateur réalisait en
// pleine génération qu'il en manquait un.
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Nouveau module";

  const { count } = await supabase.from("modules").select("*", { count: "exact", head: true }).eq("formation_id", formationId);

  const { data: moduleRow, error: moduleError } = await supabase
    .from("modules")
    .insert({ formation_id: formationId, title, order_index: count ?? 0 })
    .select("id, title, order_index")
    .single();
  if (moduleError || !moduleRow) return NextResponse.json({ error: moduleError?.message ?? "Échec de création." }, { status: 500 });

  const { data: leconRow, error: leconError } = await supabase
    .from("lecons")
    .insert({ module_id: moduleRow.id, title: "Nouvelle leçon", content_type: "rich", content_blocks: null, order_index: 0 })
    .select("id, title, content_type, generation_brief, content_blocks, content_validated_at, order_index")
    .single();
  if (leconError) return NextResponse.json({ error: leconError.message }, { status: 500 });

  return NextResponse.json({ data: { ...moduleRow, lecons: [leconRow] } }, { status: 201 });
}
