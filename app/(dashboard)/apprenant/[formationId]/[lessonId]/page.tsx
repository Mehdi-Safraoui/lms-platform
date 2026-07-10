import { notFound } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import LessonView from "./LessonView";

type Props = { params: Promise<{ formationId: string; lessonId: string }> };

export default async function ApprenantLessonPage({ params }: Props) {
  const { formationId, lessonId } = await params;
  const supabase = createServiceRoleSupabaseClient();

  const [{ data: formation }, { data: lecon }, { data: allModules }] = await Promise.all([
    supabase.from("formations").select("id, title, is_published").eq("id", formationId).single(),
    supabase.from("lecons").select("id, title, content_type, content_markdown, video_url").eq("id", lessonId).single(),
    supabase.from("modules").select("id, order_index, lecons(id, title, order_index)").eq("formation_id", formationId).order("order_index"),
  ]);

  if (!formation || !formation.is_published || !lecon) notFound();

  const allLessons = (allModules ?? [])
    .sort((a, b) => a.order_index - b.order_index)
    .flatMap((m) => [...((m.lecons as { id: string; title: string; order_index: number }[]) ?? [])].sort((a, b) => a.order_index - b.order_index));

  const currentIdx = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  let quizData = null;
  if (lecon.content_type === "quiz") {
    const { data } = await supabase
      .from("quizzes")
      .select("id, title, pass_score, quiz_questions(*)")
      .eq("lecon_id", lessonId)
      .single();
    quizData = data ?? null;
  }

  return (
    <LessonView
      formationId={formationId}
      formationTitle={formation.title}
      lessonTitle={lecon.title}
      contentType={lecon.content_type}
      contentMarkdown={lecon.content_markdown}
      videoUrl={lecon.video_url}
      quizData={quizData}
      prevLesson={prevLesson}
      nextLesson={nextLesson}
    />
  );
}
