import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { buildCertificatePdf, type Certificate } from "@/lib/certificates";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/certificates/[id]/pdf — PDF du certificat, généré à la demande.
// Public, comme la page de vérification /certificats/[id] : l'identifiant
// (UUID non devinable) est ce que l'apprenant partage.
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Certificat introuvable" }, { status: 404 });

  const supabase = createServiceRoleSupabaseClient();
  const { data } = await supabase.from("certificates").select("*").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Certificat introuvable" }, { status: 404 });

  const certificate = data as Certificate;
  const pdf = await buildCertificatePdf(certificate);
  const filename = `certificat-${slugify(certificate.formation_title) || "formation"}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
