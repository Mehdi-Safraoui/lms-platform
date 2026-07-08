import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/formations — liste toutes les formations
export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("formations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
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
