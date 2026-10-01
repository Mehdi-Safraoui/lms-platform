"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Sparkles, Wand2, Share2, ShieldCheck, PenTool, BarChart3,
  BookOpen, Brain, Rocket, Target, Lightbulb, Users,
  Search, Monitor, CheckCircle2, AlertTriangle, Info, Star,
  ChevronDown, ChevronUp, Copy, Check, ImageIcon, Video, Terminal,
} from "lucide-react";
import type { ContentBlock } from "@/lib/ai/contentBlocks";
import { getVideoEmbedUrl } from "@/lib/video";
import { renderInlineMarkdown as md } from "./inlineMarkdown";
import styles from "./blocks.module.css";

const Markdown = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => ({ default: mod.default.Markdown })),
  { ssr: false }
);

const FEATURE_ICONS: Record<string, typeof Sparkles> = {
  sparkles: Sparkles,
  wand: Wand2,
  network: Share2,
  shield: ShieldCheck,
  pen: PenTool,
  chart: BarChart3,
  book: BookOpen,
  brain: Brain,
  rocket: Rocket,
  target: Target,
  lightbulb: Lightbulb,
  users: Users,
  search: Search,
  monitor: Monitor,
  check: CheckCircle2,
  warning: AlertTriangle,
};

const CALLOUT_ICONS = {
  info: Info,
  tip: Sparkles,
  warning: AlertTriangle,
  success: CheckCircle2,
  objective: Target,
  example: Lightbulb,
};

function InlineMarkdown({ text }: { text: string }) {
  return (
    <div className={styles.inlineMarkdown} data-color-mode="light">
      <Markdown source={text} />
    </div>
  );
}

function ExerciseBlockView({ prompt, answer }: { prompt: string; answer: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={styles.exercise}>
      <span className={styles.exerciseIcon}>
        <PenTool size={22} />
      </span>
      <div className={styles.exerciseBody}>
        <strong>Exercice</strong>
        <div className={styles.exercisePrompt}>
          <InlineMarkdown text={prompt} />
        </div>
        <button
          type="button"
          className={styles.exerciseToggle}
          onClick={() => setRevealed((r) => !r)}
          aria-expanded={revealed}
        >
          {revealed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {revealed ? "Masquer la correction" : "Voir la correction"}
        </button>
        {revealed && (
          <div className={styles.exerciseAnswer}>
            <InlineMarkdown text={answer} />
          </div>
        )}
      </div>
    </div>
  );
}

function PromptBlockView({ title, prompt, tip }: { title: string; prompt: string; tip: string | null }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.prompt}>
      <Terminal size={30} strokeWidth={1.8} className={styles.promptIcon} aria-hidden="true" />
      <div className={styles.promptHeader}>
        <span className={styles.promptLabel}>Prompt à copier</span>
        <span className={styles.promptTitle}>{title}</span>
        <pre className={styles.promptText}>{prompt}</pre>
        {tip && <p className={styles.promptTip}>{md(tip)}</p>}
      </div>
      <button type="button" className={styles.promptCopy} onClick={copy} aria-live="polite">
        {copied ? <Check size={17} /> : <Copy size={17} />}
        {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}

/**
 * showPlaceholders : dans l'aperçu du Formateur, les images et vidéos
 * suggérées par l'IA mais pas encore ajoutées s'affichent comme des
 * emplacements à remplir ; côté apprenant (par défaut), elles sont masquées.
 */
export default function BlockRenderer({ blocks, showPlaceholders = false }: { blocks: ContentBlock[]; showPlaceholders?: boolean }) {
  return (
    <div className={styles.blocks}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading": {
            const Tag = block.level === 2 ? "h2" : "h3";
            return (
              <Tag key={i} className={block.level === 2 ? styles.h2 : styles.h3}>
                {block.text}
              </Tag>
            );
          }

          case "paragraph":
            return (
              <div key={i} className={styles.paragraph}>
                <InlineMarkdown text={block.text} />
              </div>
            );

          case "list": {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <ListTag key={i} className={styles.list}>
                {block.items.map((item, j) => (
                  <li key={j}>{md(item)}</li>
                ))}
              </ListTag>
            );
          }

          case "callout": {
            const Icon = CALLOUT_ICONS[block.variant];
            return (
              <div key={i} className={`${styles.callout} ${styles[`callout_${block.variant}`] ?? ""}`}>
                <span className={styles.calloutIcon} aria-hidden="true">
                  <Icon size={50} strokeWidth={1.8} />
                </span>
                <span className={styles.calloutRule} aria-hidden="true" />
                <div className={styles.calloutBody}>
                  <strong className={styles.calloutLabel}>{md(block.title)}</strong>
                  <p>{md(block.text)}</p>
                </div>
              </div>
            );
          }

          case "comparison":
            return (
              <div key={i} className={styles.comparisonBlock}>
                {block.title && <span className={styles.comparisonTitle}>{block.title}</span>}
                <div
                  className={styles.comparisonGrid}
                  style={{ gridTemplateColumns: `repeat(${block.columns.length}, 1fr)` }}
                >
                  {block.columns.map((col, j) => (
                    <div
                      key={j}
                      className={`${styles.comparisonCol} ${col.emphasis === "primary" ? styles.comparisonColPrimary : ""}`}
                    >
                      <span className={styles.comparisonColLabel}>{col.label}</span>
                      <ul className={styles.comparisonColItems}>
                        {col.items.map((item, k) => (
                          <li key={k}>{md(item)}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );

          case "feature_grid":
            return (
              <div key={i} className={styles.featureGrid}>
                {block.items.map((item, j) => {
                  const Icon = FEATURE_ICONS[item.icon] ?? Sparkles;
                  return (
                    <div key={j} className={styles.featureCard}>
                      <span className={styles.featureIcon} aria-hidden="true">
                        <Icon size={19} />
                      </span>
                      <span className={styles.featureTitle}>{item.title}</span>
                      <p className={styles.featureDesc}>{md(item.description)}</p>
                    </div>
                  );
                })}
              </div>
            );

          case "highlight":
            return (
              <div key={i} className={styles.highlight}>
                <span className={styles.highlightIcon} aria-hidden="true">
                  <Star size={20} fill="currentColor" />
                </span>
                <div className={styles.highlightBody}>
                  <strong>{md(block.title)}</strong>
                  <p>{md(block.text)}</p>
                </div>
              </div>
            );

          case "exercise":
            return <ExerciseBlockView key={i} prompt={block.prompt} answer={block.answer} />;

          case "image_text": {
            const hasImage = !!block.image_url;
            const showImage = hasImage || showPlaceholders;
            return (
              <figure
                key={i}
                className={`${styles.imageText} ${showImage ? styles[`imageText_${block.layout}`] : ""}`}
              >
                {showImage && (
                  <div className={styles.imageTextMedia}>
                    {hasImage ? (
                      // Image uploadée par le Formateur (Supabase Storage) : pas
                      // d'optimisation next/image pour un domaine non configuré.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={block.image_url!} alt={block.image_description} className={styles.imageTextImg} />
                    ) : (
                      <div className={styles.mediaPlaceholder}>
                        <ImageIcon size={20} />
                        <span>Image à ajouter : {block.image_description}</span>
                      </div>
                    )}
                    {block.caption && <figcaption className={styles.imageTextCaption}>{md(block.caption)}</figcaption>}
                  </div>
                )}
                <div className={styles.imageTextBody}>
                  <InlineMarkdown text={block.text} />
                </div>
              </figure>
            );
          }

          case "video": {
            const embedUrl = block.url ? getVideoEmbedUrl(block.url) : null;
            if (!embedUrl && !showPlaceholders) return null;
            return (
              <figure key={i} className={styles.videoBlock}>
                {embedUrl ? (
                  <div className={styles.videoFrame}>
                    <iframe
                      src={embedUrl}
                      title={block.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className={styles.mediaPlaceholder}>
                    <Video size={20} />
                    <span>Vidéo à ajouter : {block.title} (recherche suggérée : « {block.search_query} »)</span>
                  </div>
                )}
                {(block.caption || embedUrl) && (
                  <figcaption className={styles.videoCaption}>
                    <strong>{block.title}</strong>
                    {block.caption && <span> — {md(block.caption)}</span>}
                  </figcaption>
                )}
              </figure>
            );
          }

          case "prompt":
            return <PromptBlockView key={i} title={block.title} prompt={block.prompt} tip={block.tip} />;

          default:
            return null;
        }
      })}
    </div>
  );
}
