import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api/require-super-admin";
import { searchYoutubeVideos } from "@/lib/youtube";

/**
 * Recherche de vidéos YouTube réelles pour accompagner une formation (voir
 * lib/youtube.ts) — jamais d'URL générée par le LLM, seulement de vrais résultats
 * d'API que l'admin choisit ensuite manuellement.
 */
export async function POST(req: NextRequest) {
  const guard = await requireSuperAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";

  if (!query) {
    return NextResponse.json({ error: "La requête de recherche est requise." }, { status: 400 });
  }

  try {
    const data = await searchYoutubeVideos(query, 3);
    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
