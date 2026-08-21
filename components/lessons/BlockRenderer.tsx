"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Sparkles, Wand2, Share2, ShieldCheck, PenTool, BarChart3,
  BookOpen, Brain, Rocket, Target, Lightbulb, Users,
  Search, Monitor, CheckCircle2, AlertTriangle, Info, Star,
  ChevronDown, ChevronUp,
} from "lucide-react";
import type { ContentBlock } from "@/lib/ai/contentBlocks";
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
  tip: Lightbulb,
  warning: AlertTriangle,
  success: CheckCircle2,
  objective: Target,
  example: BookOpen,
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
        <PenTool size={18} />
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

export default function BlockRenderer({ blocks }: { blocks: ContentBlock[] }) {
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
                  <li key={j}>{item}</li>
                ))}
              </ListTag>
            );
          }

          case "callout": {
            const Icon = CALLOUT_ICONS[block.variant];
            return (
              <div key={i} className={`${styles.callout} ${styles[`callout_${block.variant}`]}`}>
                <span className={styles.calloutIcon}>
                  <Icon size={18} />
                </span>
                <div className={styles.calloutBody}>
                  <strong>{block.title}</strong>
                  <p>{block.text}</p>
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
                          <li key={k}>{item}</li>
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
                      <span className={styles.featureIcon}>
                        <Icon size={18} />
                      </span>
                      <span className={styles.featureTitle}>{item.title}</span>
                      <p className={styles.featureDesc}>{item.description}</p>
                    </div>
                  );
                })}
              </div>
            );

          case "highlight":
            return (
              <div key={i} className={styles.highlight}>
                <span className={styles.highlightIcon}>
                  <Star size={18} />
                </span>
                <div className={styles.highlightBody}>
                  <strong>{block.title}</strong>
                  <p>{block.text}</p>
                </div>
              </div>
            );

          case "exercise":
            return <ExerciseBlockView key={i} prompt={block.prompt} answer={block.answer} />;

          default:
            return null;
        }
      })}
    </div>
  );
}
