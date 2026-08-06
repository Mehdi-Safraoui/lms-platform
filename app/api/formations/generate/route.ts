import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { detectDocumentType, extractTextFromDocument } from "@/lib/documentExtraction";
import { generateFormationFromText } from "@/lib/ai/generateFormation";
import { saveGeneratedFormation } from "@/lib/ai/saveGeneratedFormation";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";
// La génération (extraction + appel LLM + écriture DB) peut prendre plus que les 10s par défaut.
export const maxDuration = 120;

// Alignée sur la limite par défaut du body des Serverless Functions Node.js de Vercel (~4.5 Mo).
// À revalider une fois déployé — si la formule d'hébergement diffère, ajuster ici.
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

async function uniqueSlug(baseTitle: string): Promise<string> {
  const supabase = createServiceRoleSupabaseClient();
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

// POST /api/formations/generate — upload PDF/Word → génération IA → formation en base (non publiée)
export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide, fichier manquant." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }

  if (!detectDocumentType(file.name)) {
    return NextResponse.json(
      { error: `Format non supporté : "${file.name}". Utilisez un PDF ou un .docx.` },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (${Math.round(file.size / 1024 / 1024)} Mo). Limite : ${MAX_FILE_SIZE_BYTES / 1024 / 1024} Mo.` },
      { status: 413 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const sourceText = await extractTextFromDocument(buffer, file.name);
    const generated = await generateFormationFromText(sourceText);
    const slug = await uniqueSlug(generated.title);
    const formationId = await saveGeneratedFormation(generated, guard.userId, slug);

    return NextResponse.json({ data: { id: formationId } }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/formations/generate]", err);
    const message = err instanceof Error ? err.message : "Erreur inconnue lors de la génération.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
