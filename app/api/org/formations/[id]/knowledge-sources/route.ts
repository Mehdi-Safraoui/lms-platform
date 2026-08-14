import { NextRequest, NextResponse } from "next/server";
import { requireAdminTenant } from "@/lib/api/require-admin-tenant";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { canCreateFormationByAi } from "@/lib/subscription";
import { detectKnowledgeSourceFormat } from "@/lib/documentExtraction";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Même limite qu'en V1 pour la génération de formation IA — contrainte body
// size des Serverless Functions Vercel (~4,5 Mo par défaut).
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

type Params = { params: Promise<{ id: string }> };
type SupabaseClient = ReturnType<typeof createServiceRoleSupabaseClient>;

async function assertOwnFormation(supabase: SupabaseClient, formationId: string, tenantId: string): Promise<boolean> {
  const { data } = await supabase.from("formations").select("id, tenant_id").eq("id", formationId).single();
  return !!data && data.tenant_id === tenantId;
}

// GET /api/org/formations/[id]/knowledge-sources — liste les sources déjà uploadées
export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("knowledge_sources")
    .select("*")
    .eq("formation_id", formationId)
    .order("uploaded_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/org/formations/[id]/knowledge-sources — upload d'un fichier OU d'une URL web
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireAdminTenant();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  if (!(await canCreateFormationByAi(guard.tenantId))) {
    return NextResponse.json(
      { error: "La génération de formation par IA nécessite l'offre Création ou Entreprise.", code: "plan_upgrade_required" },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const url = formData.get("url");
  const file = formData.get("file");

  // Cas URL web : pas de fichier à stocker, juste l'URL — l'extraction
  // (scraping) est prévue dans une carte suivante, pas encore construite.
  if (typeof url === "string" && url.trim()) {
    const { data, error } = await supabase
      .from("knowledge_sources")
      .insert({
        tenant_id: guard.tenantId,
        formation_id: formationId,
        file_name: url.trim(),
        format: "web",
        storage_url: url.trim(),
        ingestion_status: "en_attente",
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier ni URL reçu." }, { status: 400 });
  }

  const format = detectKnowledgeSourceFormat(file.name);
  if (!format) {
    return NextResponse.json(
      { error: `Format non supporté : "${file.name}". Utilisez PDF, Word (.docx), PowerPoint (.pptx) ou texte brut (.txt).` },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (${Math.round(file.size / 1024 / 1024)} Mo). Limite : ${MAX_FILE_SIZE_BYTES / 1024 / 1024} Mo.` },
      { status: 413 }
    );
  }

  // Id généré à l'avance pour construire le chemin de stockage
  // {tenant_id}/{knowledge_source_id}/{file_name} avant l'insert DB.
  const knowledgeSourceId = crypto.randomUUID();
  const storagePath = `${guard.tenantId}/${knowledgeSourceId}/${file.name}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("knowledge-sources")
    .upload(storagePath, buffer, { contentType: file.type || undefined, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `Échec de l'upload : ${uploadError.message}` }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("knowledge_sources")
    .insert({
      id: knowledgeSourceId,
      tenant_id: guard.tenantId,
      formation_id: formationId,
      file_name: file.name,
      format,
      storage_url: storagePath,
      ingestion_status: "en_attente",
    })
    .select()
    .single();

  if (error) {
    // Nettoyage best-effort si l'insert DB échoue après un upload déjà réussi.
    await supabase.storage.from("knowledge-sources").remove([storagePath]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
