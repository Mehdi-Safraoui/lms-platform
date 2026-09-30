import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AiAuthoringStage = "cadrage" | "structure" | "generation";

// GET /api/formations — liste les formations du catalogue global Ahead
// (tenant_id null). Ne doit jamais inclure les formations créées par un
// Formateur pour son propre tenant (V2) — voir app/api/formations/[id]/route.ts
// pour le même garde-fou côté lecture/écriture/suppression individuelle.
export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("formations")
    .select("*")
    .is("tenant_id", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Étape du flow de création par IA pour les brouillons qui en sont issus
  // (reconnus à leurs documents source ou à leur cadrage) — la liste les
  // renvoie vers cette étape plutôt que vers l'éditeur manuel.
  const draftIds = (data ?? []).filter((f) => !f.is_published).map((f) => f.id);
  const [{ data: sources }, { data: cadrages }, { data: structures }] =
    draftIds.length > 0
      ? await Promise.all([
          supabase.from("knowledge_sources").select("formation_id").in("formation_id", draftIds),
          supabase.from("formation_cadrage").select("formation_id, completed_at").in("formation_id", draftIds),
          supabase.from("formation_structure").select("formation_id, validated_at").in("formation_id", draftIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const aiDraftIds = new Set([...(sources ?? []), ...(cadrages ?? [])].map((r) => r.formation_id));
  const cadrageDone = new Set((cadrages ?? []).filter((c) => c.completed_at).map((c) => c.formation_id));
  const structureDone = new Set((structures ?? []).filter((s) => s.validated_at).map((s) => s.formation_id));

  function aiStage(id: string): AiAuthoringStage | null {
    if (!aiDraftIds.has(id)) return null;
    if (structureDone.has(id)) return "generation";
    if (cadrageDone.has(id)) return "structure";
    // /cadrage renvoie lui-même vers /sources tant qu'aucun document n'est prêt.
    return "cadrage";
  }

  return NextResponse.json({ data: (data ?? []).map((f) => ({ ...f, ai_stage: aiStage(f.id) })) });
}

// POST /api/formations — crée une formation
export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json();
  const { title, slug, description, thumbnail_url, is_published, tenant_id, niveau } = body;

  if (!title || !slug) {
    return NextResponse.json({ error: "title et slug sont requis" }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("formations")
    .insert({
      title,
      slug,
      description: description ?? null,
      thumbnail_url: thumbnail_url ?? null,
      is_published: is_published ?? false,
      tenant_id: tenant_id ?? null,
      niveau: niveau ?? null,
      created_by: guard.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
