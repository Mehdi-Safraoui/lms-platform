import { z } from "zod";

/**
 * Structure légère (titres + courtes descriptions), sans contenu de leçon :
 * un plan à valider par le Formateur avant toute génération de contenu réel
 * (carte 44).
 */
const structureLessonSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  contentType: z.enum(["lesson", "quiz"]),
});

export type StructureLesson = z.infer<typeof structureLessonSchema>;

const structureModuleSchema = z
  .object({
    title: z.string().min(1),
    lessons: z.array(structureLessonSchema).min(2).max(8),
  })
  .superRefine((mod, ctx) => {
    // Même règle que la génération V1 (lib/ai/contentBlocks.ts) : un module se
    // termine par exactement une leçon quiz — la génération de contenu leçon
    // par leçon (liste suivante) réutilise le même pipeline, donc la structure
    // proposée ici doit déjà respecter cette contrainte pour rester cohérente.
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

export type StructureModule = z.infer<typeof structureModuleSchema>;

export function structureProposalSchema(nbModulesSouhaite: number) {
  return z.object({
    modules: z.array(structureModuleSchema).length(nbModulesSouhaite),
  });
}

export type StructureProposal = { modules: StructureModule[] };
