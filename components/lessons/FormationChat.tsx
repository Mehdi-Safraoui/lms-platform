"use client";

import * as React from "react";
import { MessageCircle, X, Send, BookOpen } from "lucide-react";
import styles from "./formationChat.module.css";

interface ChatSource {
  lessonId: string | null;
  lessonTitle: string | null;
}

type ChatMessage = { role: "user" | "assistant"; content: string; sources?: ChatSource[] };

interface Props {
  formationId: string;
  formationTitle: string | null;
}

/**
 * Titres de leçons distincts référencés par une réponse, formatés en une
 * phrase de citation. Construit uniquement à partir des sources renvoyées par
 * l'API (chunks réellement retrouvés) — jamais du texte de la réponse
 * elle-même, pour ne pas faire confiance au LLM sur sa propre source.
 */
function citationLine(sources: ChatSource[] | undefined): string | null {
  if (!sources) return null;
  const titles = [...new Set(sources.map((s) => s.lessonTitle).filter((t): t is string => !!t))];
  if (titles.length === 0) return null;
  if (titles.length === 1) return `Cette information vient de la leçon : ${titles[0]}`;
  return `Ces informations viennent des leçons : ${titles.join(", ")}`;
}

/**
 * Fenêtre de chat de l'agent pédagogique, avec historique persistant
 * (table agent_messages, voir app/api/agent/[formationId]/route.ts) —
 * chargé à la première ouverture du panneau plutôt qu'au montage du
 * composant (celui-ci est monté sur toutes les pages de la formation via le
 * layout, même quand l'apprenant n'ouvre jamais le chat).
 */
export default function FormationChat({ formationId, formationTitle }: Props) {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  // "idle" fait aussi office d'état "en cours de chargement" tant que le
  // panneau est ouvert : évite d'appeler setState de façon synchrone en tout
  // début d'effet (seuls les callbacks .then()/.catch(), asynchrones, le font).
  const [historyState, setHistoryState] = React.useState<"idle" | "loaded" | "error">("idle");
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const historyFetched = React.useRef(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open || historyFetched.current) return;
    historyFetched.current = true;
    fetch(`/api/agent/${formationId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: { messages: { role: "user" | "assistant"; content: string; sources?: ChatSource[] }[] }) => {
        setMessages(data.messages.map((m) => ({ role: m.role, content: m.content, sources: m.sources })));
        setHistoryState("loaded");
      })
      .catch(() => setHistoryState("error"));
  }, [open, formationId]);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || sending) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/agent/${formationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error ?? "Impossible d'obtenir une réponse pour le moment.");
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer, sources: data.sources }]);
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setSending(false);
    }
  }

  const showEmptyState = historyState === "loaded" && messages.length === 0 && !sending;

  return (
    <div className={styles.root}>
      {open && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <div className={styles.headerText}>
              <span className={styles.headerTitle}>Assistant de formation</span>
              {formationTitle && <span className={styles.headerSubtitle}>{formationTitle}</span>}
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              aria-label="Fermer l'assistant"
            >
              <X size={18} />
            </button>
          </div>

          <div className={styles.messages} ref={listRef}>
            {historyState === "idle" && <p className={styles.empty}>Chargement de l&apos;historique…</p>}
            {historyState === "error" && (
              <p className={styles.error}>Impossible de charger l&apos;historique de la conversation.</p>
            )}
            {showEmptyState && (
              <p className={styles.empty}>
                Posez une question sur le contenu de cette formation — je réponds uniquement à partir de ce
                qu&apos;elle contient.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`${styles.messageGroup} ${m.role === "user" ? styles.messageGroupUser : styles.messageGroupAssistant}`}
              >
                <div className={m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant}>{m.content}</div>
                {m.role === "assistant" && citationLine(m.sources) && (
                  <div className={styles.citation}>
                    <BookOpen size={12} />
                    {citationLine(m.sources)}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className={`${styles.messageGroup} ${styles.messageGroupAssistant}`}>
                <div className={`${styles.bubbleAssistant} ${styles.typing}`} aria-label="L'assistant rédige une réponse">
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                  <span className={styles.typingDot} />
                </div>
              </div>
            )}
            {error && <p className={styles.error}>{error}</p>}
          </div>

          <form className={styles.inputRow} onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question…"
              disabled={sending}
              className={styles.input}
            />
            <button type="submit" className={styles.sendBtn} disabled={sending || !input.trim()} aria-label="Envoyer">
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className={styles.launcher}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant de formation"}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
