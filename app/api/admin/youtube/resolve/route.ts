import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { extractYoutubeVideoId, resolveYoutubeVideoById } from "@/lib/youtube";

/**
 * Valide un lien YouTube collé par l'admin et retourne ses vraies métadonnées
 * (titre, chaîne, miniature) — permet le chemin "je colle un lien moi-même" du flow
 * vidéo, en s'assurant que la vidéo existe réellement avant de la sauvegarder.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const input = typeof body?.url === "string" ? body.url.trim() : "";

  if (!input) {
    return NextResponse.json({ error: "Un lien ou un identifiant YouTube est requis." }, { status: 400 });
  }

  const videoId = extractYoutubeVideoId(input);
  if (!videoId) {
    return NextResponse.json({ error: "Lien YouTube non reconnu." }, { status: 400 });
  }

  try {
    const video = await resolveYoutubeVideoById(videoId);
    if (!video) {
      return NextResponse.json({ error: "Cette vidéo est introuvable ou n'est plus disponible." }, { status: 404 });
    }
    return NextResponse.json({ data: video });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
