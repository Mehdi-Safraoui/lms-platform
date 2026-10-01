import type { ContentBlock } from "@/lib/ai/contentBlocks";

const WORDS_PER_MINUTE = 200;

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Temps de lecture d'une leçon riche, d'après le nombre de mots de ses blocs. */
export function estimateBlocksReadingMinutes(blocks: ContentBlock[] | null | undefined): number {
  if (!blocks) return 1;
  const count = blocks.reduce((total, block) => {
    switch (block.type) {
      case "heading":
      case "paragraph":
        return total + words(block.text);
      case "list":
        return total + words(block.items.join(" "));
      case "callout":
      case "highlight":
        return total + words(`${block.title} ${block.text}`);
      case "comparison":
        return total + words(block.columns.flatMap((c) => c.items).join(" "));
      case "feature_grid":
        return total + words(block.items.map((it) => `${it.title} ${it.description}`).join(" "));
      case "exercise":
        return total + words(`${block.prompt} ${block.answer}`);
      case "image_text":
        return total + words(block.text);
      case "prompt":
        return total + words(`${block.title} ${block.prompt}`);
      default:
        return total;
    }
  }, 0);
  return Math.max(1, Math.round(count / WORDS_PER_MINUTE));
}

export function estimateMarkdownReadingMinutes(markdown: string | null | undefined): number {
  if (!markdown) return 1;
  return Math.max(1, Math.round(words(markdown) / WORDS_PER_MINUTE));
}

/**
 * Durée estimée d'une leçon, en minutes : lecture pour une leçon riche ou
 * markdown, une minute par question pour un quiz. null pour une vidéo, dont la
 * durée n'est pas connue.
 */
export function lessonMinutes(lesson: {
  content_type: string;
  content_blocks?: ContentBlock[] | null;
  content_markdown?: string | null;
  quiz_question_count?: number;
}): number | null {
  if (lesson.content_type === "video") return null;
  if (lesson.content_type === "quiz") return Math.max(2, lesson.quiz_question_count ?? 5);
  if (lesson.content_type === "markdown") return estimateMarkdownReadingMinutes(lesson.content_markdown);
  return estimateBlocksReadingMinutes(lesson.content_blocks);
}

/** « 6 min », « 2 h 50 ». */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
