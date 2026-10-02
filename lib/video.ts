/**
 * Lien de vidéo collé par le Formateur → URL à intégrer dans une iframe, ou
 * null si la plateforme n'est pas reconnue. Formats acceptés : YouTube (watch,
 * youtu.be, shorts, live, embed, mobile, nocookie), Vimeo et Loom.
 */
export function getVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    const parts = u.pathname.split("/").filter(Boolean);

    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (parts[0] === "watch") {
        const v = u.searchParams.get("v");
        return v ? `https://www.youtube.com/embed/${v}` : null;
      }
      if ((parts[0] === "shorts" || parts[0] === "live" || parts[0] === "embed" || parts[0] === "v") && parts[1]) {
        return `https://www.youtube.com/embed/${parts[1]}`;
      }
      return null;
    }
    if (host === "youtu.be") {
      return parts[0] ? `https://www.youtube.com/embed/${parts[0]}` : null;
    }

    if (host === "vimeo.com") {
      const id = parts.find((p) => /^\d+$/.test(p));
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "player.vimeo.com") return url.trim();

    if (host === "loom.com" && (parts[0] === "share" || parts[0] === "embed") && parts[1]) {
      return `https://www.loom.com/embed/${parts[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}
