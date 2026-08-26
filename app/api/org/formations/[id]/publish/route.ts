import { NextRequest, NextResponse } from "next/server";
import { requireAdminTenant } from "@/lib/api/require-admin-tenant";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// POST /api/org/formations/[id]/publish — carte "Une fois toutes les leçons
// validées, permettre la publication de la formation complète". Exige que
// TOUTES les leçons soient validées (content_validated_at non nul) avant de
// publier — cohérent avec le human-in-the-loop de toute la liste précédente.
//
// Publier ne fait pas QUE passer is_published à true : sans insérer une ligne
// tenant_formations, la formation resterait invisible pour les apprenants du
// tenant (leur page "Mes formations" ne lit que cette table, voir
// app/(dashboard)/apprenant/page.tsx — trou découvert en creusant cette carte).
// Elle n'apparaît jamais dans /org/catalogue (filtré sur tenant_id IS NULL),
// donc la carte "visible uniquement dans le tenant du Formateur" est garantie
// par construction, sans code supplémentaire à écrire pour ça.
export async function POST(_req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { data: modules } = await supabase
    .from("modules")
    .select("lecons(id, content_validated_at)")
    .eq("formation_id", formationId);
  const allLecons = (modules ?? []).flatMap((m) => m.lecons as { id: string; content_validated_at: string | null }[]);

  if (allLecons.length === 0) {
    return NextResponse.json({ error: "Cette formation n'a aucune leçon." }, { status: 400 });
  }
  const unvalidatedCount = allLecons.filter((l) => !l.content_validated_at).length;
  if (unvalidatedCount > 0) {
    return NextResponse.json(
      { error: `${unvalidatedCount} leçon(s) sur ${allLecons.length} n'ont pas encore été validées.` },
      { status: 400 }
    );
  }

  const { error: publishError } = await supabase
    .from("formations")
    .update({ is_published: true, updated_at: new Date().toISOString() })
    .eq("id", formationId);
  if (publishError) return NextResponse.json({ error: publishError.message }, { status: 500 });

  const { data: existingLink } = await supabase
    .from("tenant_formations")
    .select("tenant_id")
    .eq("tenant_id", guard.tenantId)
    .eq("formation_id", formationId)
    .maybeSingle();
  if (!existingLink) {
    const { error: linkError } = await supabase
      .from("tenant_formations")
      .insert({ tenant_id: guard.tenantId, formation_id: formationId });
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  return NextResponse.json({ data: { formationId, published: true } });
}
