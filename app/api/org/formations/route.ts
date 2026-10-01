import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canAuthorFormationByAi } from "@/lib/subscription";
import { slugify } from "@/lib/slug";
import { getFormationQuota } from "@/lib/aiGenerationQuota";

export const dynamic = "force-dynamic";

async function uniqueSlug(
  supabase: ReturnType<typeof createServiceRoleSupabaseClient>,
  baseTitle: string
): Promise<string> {
  const base = slugify(baseTitle) || "formation";
  let candidate = base;
  let suffix = 2;
  while (true) {
    const { data } = await supabase.from("formations").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

// POST /api/org/formations — crée une formation brouillon privée au tenant
// (point de départ du flow "création de formation par IA", V2) — ou, pour le
// super_admin, une formation brouillon du catalogue global (tenant_id null).
export async function POST(req: NextRequest) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  if (!(await canAuthorFormationByAi(guard.tenantId))) {
    return NextResponse.json(
      { error: "La génération de formation par IA nécessite l'offre Création ou Entreprise.", code: "plan_upgrade_required" },
      { status: 403 }
    );
  }

  // Quota du mois déjà atteint : inutile de créer un brouillon dont la
  // structure ne pourra pas être générée (la consommation réelle a lieu à la
  // première génération de structure, voir consume_formation_ai).
  const quota = await getFormationQuota(guard.tenantId);
  if (quota.total !== null && quota.used >= quota.total) {
    return NextResponse.json(
      {
        error: `Quota de formations IA atteint ce mois-ci (${quota.used}/${quota.total}). Il se renouvelle le 1er du mois — contactez Ahead pour l'augmenter.`,
        code: "quota_exceeded",
      },
      { status: 403 }
    );
  }

  const { title, thumbnailUrl } = await req.json();
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400 });
  }
  if (thumbnailUrl !== undefined && thumbnailUrl !== null && typeof thumbnailUrl !== "string") {
    return NextResponse.json({ error: "URL d'image invalide" }, { status: 400 });
  }

  const supabase = createServiceRoleSupabaseClient();
  const slug = await uniqueSlug(supabase, title);

  const { data, error } = await supabase
    .from("formations")
    .insert({
      title: title.trim(),
      slug,
      tenant_id: guard.tenantId,
      is_published: false,
      created_by: guard.userId,
      thumbnail_url: thumbnailUrl?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
