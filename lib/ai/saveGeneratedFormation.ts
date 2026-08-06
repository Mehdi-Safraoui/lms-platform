import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { GeneratedFormation } from "./contentBlocks";

/**
 * Persiste une formation générée par IA (formation + modules + leçons + quiz)
 * dans les tables existantes, en réutilisant exactement le même schéma que la
 * création manuelle. Publiée à `false` par défaut : le super_admin doit relire
 * et publier explicitement depuis l'éditeur avant que ce soit visible.
 */
export async function saveGeneratedFormation(
  generated: GeneratedFormation,
  createdBy: string,
  slug: string
): Promise<string> {
  const supabase = createServiceRoleSupabaseClient();

  const { data: formation, error: formationError } = await supabase
    .from("formations")
    .insert({
      title: generated.title,
      slug,
      description: generated.description,
      niveau: generated.niveau,
      estimated_duration_minutes: generated.estimatedDurationMinutes,
      is_published: false,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (formationError || !formation) {
    throw new Error(`Échec de création de la formation : ${formationError?.message}`);
  }

  for (let mi = 0; mi < generated.modules.length; mi++) {
    const mod = generated.modules[mi];
    const { data: moduleRow, error: moduleError } = await supabase
      .from("modules")
      .insert({ formation_id: formation.id, title: mod.title, order_index: mi })
      .select("id")
      .single();
    if (moduleError || !moduleRow) {
      throw new Error(`Échec de création du module "${mod.title}" : ${moduleError?.message}`);
    }

    for (let li = 0; li < mod.lessons.length; li++) {
      const lesson = mod.lessons[li];
      const { data: leconRow, error: leconError } = await supabase
        .from("lecons")
        .insert({
          module_id: moduleRow.id,
          title: lesson.title,
          content_type: lesson.contentType === "quiz" ? "quiz" : "rich",
          content_blocks: lesson.contentType === "lesson" ? lesson.blocks : null,
          order_index: li,
        })
        .select("id")
        .single();
      if (leconError || !leconRow) {
        throw new Error(`Échec de création de la leçon "${lesson.title}" : ${leconError?.message}`);
      }

      if (lesson.contentType === "quiz" && lesson.quiz) {
        const { data: quizRow, error: quizError } = await supabase
          .from("quizzes")
          .insert({ lecon_id: leconRow.id, title: lesson.title, pass_score: 70 })
          .select("id")
          .single();
        if (quizError || !quizRow) {
          throw new Error(`Échec de création du quiz "${lesson.title}" : ${quizError?.message}`);
        }

        const questions = lesson.quiz.map((q, qi) => ({
          quiz_id: quizRow.id,
          question_text: q.question,
          options: q.options.map((text, oi) => ({ text, is_correct: oi === q.correctIndex })),
          order_index: qi,
          points: 1,
        }));
        const { error: questionsError } = await supabase.from("quiz_questions").insert(questions);
        if (questionsError) {
          throw new Error(`Échec de création des questions du quiz "${lesson.title}" : ${questionsError.message}`);
        }
      }
    }
  }

  return formation.id as string;
}
