import { NextRequest, NextResponse } from "next/server";
import { requireAdminTenant } from "@/lib/api/require-admin-tenant";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { touchFormation } from "@/lib/api/touch-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; moduleId: string }> };

// POST /api/org/formations/[id]/generation/modules/[moduleId]/lecons —
// ajoute une leçon vide à un module existant, structure déjà validée ou non.
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId, moduleId } = await params;
  const supabase = createServiceRoleSupabaseClient();
  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }
  const { data: mod } = await supabase.from("modules").select("id, formation_id").eq("id", moduleId).single();
  if (!mod || mod.formation_id !== formationId) {
    return NextResponse.json({ error: "Module introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Nouvelle leçon";
  const contentType = body.contentType === "quiz" ? "quiz" : body.contentType === "video" ? "video" : "rich";

  const { count } = await supabase.from("lecons").select("*", { count: "exact", head: true }).eq("module_id", moduleId);

  const { data, error } = await supabase
    .from("lecons")
    .insert({ module_id: moduleId, title, content_type: contentType, content_blocks: null, order_index: count ?? 0 })
    .select("id, title, content_type, generation_brief, content_blocks, video_url, content_validated_at, order_index")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await touchFormation(supabase, formationId);
  return NextResponse.json({ data }, { status: 201 });
}
