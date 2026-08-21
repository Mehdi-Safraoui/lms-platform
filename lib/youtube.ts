/**
 * Recherche et résolution de vidéos YouTube réelles via la YouTube Data API v3.
 *
 * Principe anti-hallucination : le LLM ne produit jamais d'URL/ID de vidéo — il
 * propose au mieux une requête de recherche. Toute donnée vidéo qui atteint la base
 * (id, titre, miniature) vient de cette API, jamais d'une génération de texte.
 */

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YoutubeVideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  url: string;
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY n'est pas configurée.");
  return key;
}

function videoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Recherche jusqu'à `maxResults` vidéos réelles correspondant à la requête.
 * Ne renvoie jamais rien d'inventé : soit de vraies vidéos existantes, soit un
 * tableau vide si l'API ne retourne aucun résultat exploitable.
 */
export async function searchYoutubeVideos(query: string, maxResults = 3): Promise<YoutubeVideoResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = new URL(`${YOUTUBE_API_BASE}/search`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("q", trimmed);
  url.searchParams.set("safeSearch", "strict");
  url.searchParams.set("key", getApiKey());

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Échec de la recherche YouTube (${res.status}) : ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const items: unknown[] = Array.isArray(json.items) ? json.items : [];

  return items
    .map((item): YoutubeVideoResult | null => {
      const it = item as { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: Record<string, { url?: string }> } };
      const videoId = it.id?.videoId;
      if (!videoId) return null;
      return {
        videoId,
        title: it.snippet?.title ?? "",
        channelTitle: it.snippet?.channelTitle ?? "",
        thumbnailUrl: it.snippet?.thumbnails?.medium?.url ?? it.snippet?.thumbnails?.default?.url ?? "",
        url: videoUrl(videoId),
      };
    })
    .filter((v): v is YoutubeVideoResult => v !== null);
}

/**
 * Extrait un videoId depuis une URL YouTube dans ses formats usuels
 * (watch?v=, youtu.be/, /embed/, /shorts/), ou l'accepte tel quel si c'est déjà
 * un id brut (11 caractères alphanumériques/-/_).
 */
export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (url.hostname.endsWith("youtube.com")) {
      const vParam = url.searchParams.get("v");
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;
      const match = url.pathname.match(/\/(embed|shorts)\/([a-zA-Z0-9_-]{11})/);
      if (match) return match[2];
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Vérifie qu'un videoId correspond à une vraie vidéo existante et publique, et
 * retourne ses vraies métadonnées. Retourne null si la vidéo n'existe pas / n'est
 * plus disponible — jamais de résultat partiel ou inventé.
 */
export async function resolveYoutubeVideoById(videoId: string): Promise<YoutubeVideoResult | null> {
  const url = new URL(`${YOUTUBE_API_BASE}/videos`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", getApiKey());

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Échec de la vérification YouTube (${res.status}) : ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const item = Array.isArray(json.items) ? json.items[0] : null;
  if (!item) return null;

  return {
    videoId,
    title: item.snippet?.title ?? "",
    channelTitle: item.snippet?.channelTitle ?? "",
    thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? "",
    url: videoUrl(videoId),
  };
}
