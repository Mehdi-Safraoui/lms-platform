"use client";

import { useState } from "react";
import { Video, Link2, Search, Loader2 } from "lucide-react";
import type { YoutubeVideoResult } from "@/lib/youtube";
import styles from "./videoStep.module.css";

type Phase = "ask" | "paste" | "search" | "results";

interface Props {
  formationId: string;
  suggestedQuery: string;
  onDone: () => void;
}

/**
 * Étape post-génération : proposer une vidéo d'accompagnement pour la formation.
 * Toujours un choix humain final — soit un lien collé et vérifié, soit une vidéo
 * choisie parmi de vrais résultats de recherche YouTube. Le LLM ne propose qu'une
 * requête de recherche de départ (éditable), jamais une URL.
 */
export default function VideoStep({ formationId, suggestedQuery, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>("ask");
  const [pastedUrl, setPastedUrl] = useState("");
  // Garde-fou défensif : si suggestedQuery arrive vide/absente pour une raison
  // imprévue côté appelant, on ne veut pas planter tout l'écran post-génération.
  const [query, setQuery] = useState(suggestedQuery || "");
  const [candidates, setCandidates] = useState<YoutubeVideoResult[]>([]);
  const [pastedPreview, setPastedPreview] = useState<YoutubeVideoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResolvePaste() {
    if (!pastedUrl.trim()) return;
    setLoading(true);
    setError(null);
    setPastedPreview(null);
    try {
      const res = await fetch("/api/admin/youtube/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: pastedUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur lors de la vérification du lien.");
      setPastedPreview(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/youtube/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur lors de la recherche.");
      setCandidates(json.data);
      setPhase("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(video: YoutubeVideoResult) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/formations/${formationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos: [video] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur lors de l'enregistrement.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau.");
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.icon}><Video size={20} /></span>
        <div>
          <p className={styles.title}>Vidéo d&apos;accompagnement</p>
          <p className={styles.subtitle}>Facultatif — pour aider les apprenants à mieux comprendre le sujet.</p>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {phase === "ask" && (
        <div className={styles.choices}>
          <button type="button" className={styles.choiceBtn} onClick={() => setPhase("paste")}>
            <Link2 size={16} /> Coller un lien YouTube
          </button>
          <button type="button" className={styles.choiceBtn} onClick={() => setPhase("search")}>
            <Search size={16} /> Laisser l&apos;IA suggérer des vidéos
          </button>
          <button type="button" className={styles.skipBtn} onClick={onDone} disabled={saving}>
            Non merci, continuer sans vidéo
          </button>
        </div>
      )}

      {phase === "paste" && (
        <div className={styles.panel}>
          <div className={styles.row}>
            <input
              className={styles.input}
              placeholder="https://www.youtube.com/watch?v=..."
              value={pastedUrl}
              onChange={(e) => { setPastedUrl(e.target.value); setPastedPreview(null); }}
            />
            <button type="button" className={styles.btnSmall} onClick={handleResolvePaste} disabled={loading || !pastedUrl.trim()}>
              {loading ? <Loader2 size={14} className={styles.spin} /> : "Vérifier"}
            </button>
          </div>

          {pastedPreview && (
            <VideoCard video={pastedPreview} onChoose={() => handleSave(pastedPreview)} saving={saving} />
          )}

          <button type="button" className={styles.backBtn} onClick={() => { setPhase("ask"); setPastedPreview(null); setError(null); }}>
            ← Retour
          </button>
        </div>
      )}

      {phase === "search" && (
        <div className={styles.panel}>
          <div className={styles.row}>
            <input
              className={styles.input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sujet de la recherche"
            />
            <button type="button" className={styles.btnSmall} onClick={handleSearch} disabled={loading || !query.trim()}>
              {loading ? <Loader2 size={14} className={styles.spin} /> : "Rechercher"}
            </button>
          </div>
          <button type="button" className={styles.backBtn} onClick={() => setPhase("ask")}>
            ← Retour
          </button>
        </div>
      )}

      {phase === "results" && (
        <div className={styles.panel}>
          {candidates.length === 0 ? (
            <p className={styles.hint}>Aucun résultat pertinent trouvé.</p>
          ) : (
            <div className={styles.results}>
              {candidates.map((video) => (
                <VideoCard key={video.videoId} video={video} onChoose={() => handleSave(video)} saving={saving} />
              ))}
            </div>
          )}
          <button type="button" className={styles.backBtn} onClick={() => setPhase("search")}>
            ← Nouvelle recherche
          </button>
        </div>
      )}
    </div>
  );
}

function VideoCard({ video, onChoose, saving }: { video: YoutubeVideoResult; onChoose: () => void; saving: boolean }) {
  return (
    <div className={styles.card}>
      {video.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- miniature externe YouTube, pas un asset local
        <img src={video.thumbnailUrl} alt="" className={styles.thumbnail} />
      )}
      <div className={styles.cardBody}>
        <span className={styles.cardTitle}>{video.title}</span>
        <span className={styles.cardChannel}>{video.channelTitle}</span>
      </div>
      <button type="button" className={styles.btnSmall} onClick={onChoose} disabled={saving}>
        {saving ? <Loader2 size={14} className={styles.spin} /> : "Choisir"}
      </button>
    </div>
  );
}
