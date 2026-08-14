import { NextRequest, NextResponse } from "next/server";
import { requireAdminTenant } from "@/lib/api/require-admin-tenant";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canCreateFormationByAi } from "@/lib/subscription";
import { slugify } from "@/lib/slug";

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
// (point de départ du flow "création de formation par IA", V2).
export async function POST(req: NextRequest) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  if (!(await canCreateFormationByAi(guard.tenantId))) {
    return NextResponse.json(
      { error: "La génération de formation par IA nécessite l'offre Création ou Entreprise.", code: "plan_upgrade_required" },
      { status: 403 }
    );
  }

  const { title } = await req.json();
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Titre requis" }, { status: 400 });
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
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
