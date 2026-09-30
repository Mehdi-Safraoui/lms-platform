import { NextRequest, NextResponse } from "next/server";
import { requireFormationAuthor } from "@/lib/api/require-formation-author";
import { assertOwnFormation } from "@/lib/api/assert-own-formation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { LESSON_MEDIA_BUCKET } from "@/lib/knowledgeSourceStorage";

export const dynamic = "force-dynamic";

// Sous la limite de body des Serverless Functions Vercel (~4,5 Mo), comme
// l'upload des documents source.
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

type Params = { params: Promise<{ id: string }> };

// POST /api/org/formations/[id]/media — upload d'une image de leçon (bloc
// "image_text", typiquement une capture d'écran). Bucket public
// "lesson-media" : l'image est lue directement par le navigateur de
// l'apprenant, via une URL non devinable ({formationId}/{uuid}.{ext}) mais
// sans contrôle d'accès — choix validé pour du contenu de formation.
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await requireFormationAuthor();
  if (guard instanceof NextResponse) return guard;

  const { id: formationId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  if (!(await assertOwnFormation(supabase, formationId, guard.tenantId))) {
    return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucune image reçue." }, { status: 400 });
  }
  const extension = EXTENSIONS[file.type];
  if (!extension) {
    return NextResponse.json({ error: "Format non supporté. Utilisez PNG, JPEG, WebP ou GIF." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `Image trop lourde (${(file.size / 1024 / 1024).toFixed(1)} Mo). Limite : 4 Mo.` },
      { status: 413 }
    );
  }

  const path = `${formationId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from(LESSON_MEDIA_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) {
    return NextResponse.json({ error: `Échec de l'upload : ${error.message}` }, { status: 500 });
  }

  const { data } = supabase.storage.from(LESSON_MEDIA_BUCKET).getPublicUrl(path);
  return NextResponse.json({ data: { url: data.publicUrl } }, { status: 201 });
}
