import { z } from "zod";

/**
 * Jeu d'icônes autorisé pour les blocs "feature_grid".
 * Volontairement limité : chaque clé doit pouvoir être mappée vers une icône Lucide
 * précise côté renderer, donc on ne laisse pas le LLM inventer une valeur libre.
 */
export const ICON_KEYS = [
  "sparkles", "wand", "network", "shield", "pen", "chart",
  "book", "brain", "rocket", "target", "lightbulb", "users",
  "search", "monitor", "check", "warning",
] as const;

const headingBlock = z.object({
  type: z.literal("heading"),
  level: z.union([z.literal(2), z.literal(3)]),
  text: z.string(),
});

const paragraphBlock = z.object({
  type: z.literal("paragraph"),
  // Peut contenir du markdown inline simple : **gras**, *italique*, [texte](url).
  text: z.string(),
});

const listBlock = z.object({
  type: z.literal("list"),
  ordered: z.boolean(),
  items: z.array(z.string()).min(2).max(10),
});

const calloutBlock = z.object({
  type: z.literal("callout"),
  variant: z.enum(["info", "tip", "warning", "success"]),
  title: z.string(),
  text: z.string(),
});

const comparisonColumn = z.object({
  label: z.string(),
  // "primary" = colonne mise en avant visuellement (ex: la recommandation).
  emphasis: z.enum(["neutral", "primary"]),
  items: z.array(z.string()).min(1).max(8),
});

const comparisonBlock = z.object({
  type: z.literal("comparison"),
  title: z.string().nullable(),
  columns: z.array(comparisonColumn).min(2).max(3),
});

const featureItem = z.object({
  icon: z.enum(ICON_KEYS),
  title: z.string(),
  description: z.string(),
});

const featureGridBlock = z.object({
  type: z.literal("feature_grid"),
  items: z.array(featureItem).min(2).max(6),
});

const highlightBlock = z.object({
  type: z.literal("highlight"),
  title: z.string(),
  text: z.string(),
});

export const contentBlockSchema = z.discriminatedUnion("type", [
  headingBlock,
  paragraphBlock,
  listBlock,
  calloutBlock,
  comparisonBlock,
  featureGridBlock,
  highlightBlock,
]);

export type ContentBlock = z.infer<typeof contentBlockSchema>;

const quizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  correctIndex: z.number().int().min(0),
});

const lessonSchema = z.object({
  title: z.string(),
  contentType: z.enum(["lesson", "quiz"]),
  // Présent seulement si contentType === "lesson".
  blocks: z.array(contentBlockSchema).nullable(),
  // Présent seulement si contentType === "quiz".
  quiz: z.array(quizQuestionSchema).nullable(),
});

export type GeneratedLesson = z.infer<typeof lessonSchema>;

const moduleSchema = z
  .object({
    title: z.string(),
    lessons: z.array(lessonSchema).min(2).max(8),
  })
  .superRefine((mod, ctx) => {
    // Règle métier (pas représentable en JSON Schema strict côté OpenAI) :
    // exactement une leçon quiz par module, obligatoirement en dernière position.
    // Sert de garde-fou après coup — si le modèle duplique ou déplace un quiz,
    // la validation échoue et déclenche la tentative de correction.
    const quizIndices = mod.lessons.reduce<number[]>((acc, l, i) => {
      if (l.contentType === "quiz") acc.push(i);
      return acc;
    }, []);
    if (quizIndices.length !== 1) {
      ctx.addIssue({
        code: "custom",
        message: `Le module "${mod.title}" doit contenir exactement une leçon de type "quiz" (trouvé : ${quizIndices.length}).`,
        path: ["lessons"],
      });
    } else if (quizIndices[0] !== mod.lessons.length - 1) {
      ctx.addIssue({
        code: "custom",
        message: `Le module "${mod.title}" doit se terminer par sa leçon de type "quiz".`,
        path: ["lessons"],
      });
    }
  });

export const generatedFormationSchema = z.object({
  title: z.string(),
  description: z.string(),
  niveau: z.enum(["debutant", "intermediaire", "avance"]),
  estimatedDurationMinutes: z.number().int().positive(),
  modules: z.array(moduleSchema).min(2).max(10),
});

export type GeneratedFormation = z.infer<typeof generatedFormationSchema>;
