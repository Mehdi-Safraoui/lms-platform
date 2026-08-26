import { NextRequest, NextResponse } from "next/server";
import { requireAdminTenant } from "@/lib/api/require-admin-tenant";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

type Params = { params: Promise<{ id: string }> };

// GET /api/org/formations/[id] — formation du tenant (créée par l'admin_tenant lui-même)
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("formations")
    .select("id, title, tenant_id, is_published")
    .eq("id", id)
    .single();

  if (error || !data || data.tenant_id !== guard.tenantId) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

// PATCH /api/org/formations/[id] — pour l'instant, seule l'image de couverture
// est modifiable après création (voir RowThumb.tsx : crayon sur la vignette
// dans la liste "Formations"). Avant ça, thumbnail_url ne pouvait être défini
// qu'au moment de la création — aucun moyen d'en ajouter/changer une pour une
// formation déjà existante.
export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const supabase = createServiceRoleSupabaseClient();

  const { data: formation } = await supabase.from("formations").select("id, tenant_id").eq("id", id).single();
  if (!formation || formation.tenant_id !== guard.tenantId) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !("thumbnailUrl" in body)) {
    return NextResponse.json({ error: "thumbnailUrl requis" }, { status: 400 });
  }
  const { thumbnailUrl } = body;
  if (thumbnailUrl !== null && typeof thumbnailUrl !== "string") {
    return NextResponse.json({ error: "URL d'image invalide" }, { status: 400 });
  }

  const { error } = await supabase
    .from("formations")
    .update({ thumbnail_url: thumbnailUrl?.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { thumbnailUrl: thumbnailUrl?.trim() || null } });
}

async function deleteUploadedDocuments(supabase: Supabase, formationId: string): Promise<void> {
  const { data: sources } = await supabase.from("knowledge_sources").select("storage_url, format").eq("formation_id", formationId);
  const paths = (sources ?? []).filter((s) => s.format !== "web" && s.storage_url).map((s) => s.storage_url as string);
  if (paths.length > 0) {
    await supabase.storage.from("knowledge-sources").remove(paths);
  }
}

// DELETE /api/org/formations/[id] — carte "trouvée en creusant" : rien ne
// permettait à un Formateur de supprimer un brouillon abandonné, qui restait
// indéfiniment dans "Mes formations". Volontairement interdit sur une
// formation déjà publiée (risque réel pour des apprenants inscrits) — il
// faudrait une dépublication explicite d'abord, pas encore construite.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const supabase = createServiceRoleSupabaseClient();

  const { data: formation } = await supabase.from("formations").select("id, tenant_id, is_published").eq("id", id).single();
  if (!formation || formation.tenant_id !== guard.tenantId) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }
  if (formation.is_published) {
    return NextResponse.json({ error: "Impossible de supprimer une formation déjà publiée." }, { status: 409 });
  }

  // Les lignes (modules, leçons, quiz, chunks, knowledge_sources, cadrage,
  // structure) cascadent toutes au niveau base depuis formations — seuls les
  // fichiers réellement stockés dans Supabase Storage ne sont pas couverts par
  // une contrainte FK et doivent être nettoyés explicitement, avant que la
  // ligne knowledge_sources qui référence leur chemin ne disparaisse.
  await deleteUploadedDocuments(supabase, id);
  await supabase.from("tenant_formations").delete().eq("formation_id", id);

  const { error: deleteError } = await supabase.from("formations").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
