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

// .min(1) sur tous les champs texte obligatoires ci-dessous : sans ça, un titre ou
// un texte vide ("") passe la validation Zod sans broncher (une chaîne vide reste
// un `string` valide). Trouvé en testant un document source trop court : le modèle
// avait produit des leçons avec des titres vides, silencieusement acceptées. Avec
// .min(1), ce cas déclenche la tentative de correction automatique comme n'importe
// quelle autre sortie invalide.

const headingBlock = z.object({
  type: z.literal("heading"),
  level: z.union([z.literal(2), z.literal(3)]),
  text: z.string().min(1),
});

const paragraphBlock = z.object({
  type: z.literal("paragraph"),
  // Peut contenir du markdown inline simple : **gras**, *italique*, [texte](url).
  text: z.string().min(1),
});

const listBlock = z.object({
  type: z.literal("list"),
  ordered: z.boolean(),
  items: z.array(z.string().min(1)).min(2).max(10),
});

const calloutBlock = z.object({
  type: z.literal("callout"),
  variant: z.enum(["info", "tip", "warning", "success", "objective", "example"]),
  title: z.string().min(1),
  text: z.string().min(1),
});

const comparisonColumn = z.object({
  label: z.string().min(1),
  // "primary" = colonne mise en avant visuellement (ex: la recommandation).
  emphasis: z.enum(["neutral", "primary"]),
  items: z.array(z.string().min(1)).min(1).max(8),
});

const comparisonBlock = z.object({
  type: z.literal("comparison"),
  title: z.string().nullable(),
  columns: z.array(comparisonColumn).min(2).max(3),
});

const featureItem = z.object({
  icon: z.enum(ICON_KEYS),
  title: z.string().min(1),
  description: z.string().min(1),
});

const featureGridBlock = z.object({
  type: z.literal("feature_grid"),
  items: z.array(featureItem).min(2).max(6),
});

const highlightBlock = z.object({
  type: z.literal("highlight"),
  title: z.string().min(1),
  text: z.string().min(1),
});

const exerciseBlock = z.object({
  type: z.literal("exercise"),
  // Les deux champs sont obligatoires (pas de .nullable()/.optional()) : impossible
  // pour le LLM de produire une consigne sans sa correction — si l'un des deux
  // manque, la validation Zod échoue et déclenche la tentative de correction.
  prompt: z.string().min(1),
  answer: z.string().min(1),
});

// Image + texte. L'IA ne fournit JAMAIS l'image elle-même (image_url forcé à
// null après génération, voir generateLessonContent) : elle place un
// emplacement quand un visuel aiderait vraiment (capture d'écran d'un outil,
// schéma) et décrit précisément l'image attendue dans image_description, qui
// sert ensuite de consigne au Formateur puis de texte alternatif. Tant que
// l'image n'est pas ajoutée, l'apprenant ne voit que le texte.
const imageTextBlock = z.object({
  type: z.literal("image_text"),
  layout: z.enum(["image_left", "image_right", "image_full"]),
  image_url: z.string().nullable(),
  image_description: z.string().min(1),
  caption: z.string().nullable(),
  // Peut contenir du markdown inline simple, comme "paragraph".
  text: z.string().min(1),
});

// Vidéo YouTube dans la leçon. Même règle que le reste du projet : jamais
// d'URL proposée par le LLM (url forcé à null après génération) — il propose
// une recherche (search_query), le Formateur choisit parmi de vrais résultats
// YouTube ou colle un lien. Sans lien, le bloc n'est pas affiché à l'apprenant.
const videoBlock = z.object({
  type: z.literal("video"),
  url: z.string().nullable(),
  title: z.string().min(1),
  search_query: z.string().min(1),
  caption: z.string().nullable(),
});

// Prompt prêt à copier-coller par l'apprenant dans un outil d'IA.
const promptBlock = z.object({
  type: z.literal("prompt"),
  title: z.string().min(1),
  prompt: z.string().min(1),
  // Conseil d'utilisation ou résultat attendu (optionnel).
  tip: z.string().nullable(),
});

export const contentBlockSchema = z.discriminatedUnion("type", [
  headingBlock,
  paragraphBlock,
  listBlock,
  calloutBlock,
  comparisonBlock,
  featureGridBlock,
  highlightBlock,
  exerciseBlock,
  imageTextBlock,
  videoBlock,
  promptBlock,
]);

export type ContentBlock = z.infer<typeof contentBlockSchema>;

export const quizQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(6),
  correctIndex: z.number().int().min(0),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
