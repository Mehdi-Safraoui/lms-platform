export function getVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());

    // YouTube watch: youtube.com/watch?v=ID
    if ((u.hostname === "www.youtube.com" || u.hostname === "youtube.com") && u.pathname === "/watch") {
      const v = u.searchParams.get("v");
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
    // YouTube short: youtu.be/ID
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    // YouTube embed: already in embed format
    if ((u.hostname === "www.youtube.com" || u.hostname === "youtube.com") && u.pathname.startsWith("/embed/")) {
      return url.trim();
    }

    // Vimeo standard: vimeo.com/ID
    if (u.hostname === "vimeo.com" || u.hostname === "www.vimeo.com") {
      const id = u.pathname.slice(1).split("/")[0];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    // Vimeo player: already in embed format
    if (u.hostname === "player.vimeo.com") return url.trim();

    return null;
  } catch {
    return null;
  }
}
