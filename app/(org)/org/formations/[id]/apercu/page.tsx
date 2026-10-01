import { redirect, notFound } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";
import FormationContentPreview, {
  type PreviewModule,
  type PreviewLesson,
  type PreviewQuiz,
} from "@/components/lessons/FormationContentPreview";

type Props = { params: Promise<{ id: string }> };

// Vue de lecture seule du contenu d'une formation créée par ce tenant via
// l'assistant IA — jusqu'ici la seule façon de "voir" une formation depuis
// /org/formations était d'entrer dans son éditeur (structure/génération), pas
// de la relire telle qu'un apprenant la verrait. Réutilise exactement le même
// rendu que le catalogue global (voir FormationContentPreview), avec un
// contrôle d'accès direct par tenant_id plutôt que la double logique
// catalogue/tenant_formations (une formation "Mes formations" appartient
// toujours directement à ce tenant).
export default async function FormationApercuPage({ params }: Props) {
  const { id: formationId } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/sign-in");

  const supabase = createServiceRoleSupabaseClient();

  if (!currentUser?.tenant_id || currentUser.role !== "admin_tenant") {
    redirect("/org");
  }

  const { data: formation } = await supabase
    .from("formations")
    .select("id, title, description, niveau, estimated_duration_minutes")
    .eq("id", formationId)
    .eq("tenant_id", currentUser.tenant_id)
    .single();
  if (!formation) notFound();

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, order_index")
    .eq("formation_id", formationId)
    .order("order_index");

  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: allLecons } = moduleIds.length > 0
    ? await supabase
        .from("lecons")
        .select("id, module_id, title, content_type, content_markdown, content_blocks, video_url, order_index")
        .in("module_id", moduleIds)
        .order("order_index")
    : { data: [] as (PreviewLesson & { module_id: string; order_index: number })[] };

  const leconsByModule: Record<string, PreviewLesson[]> = {};
  (allLecons ?? []).forEach((l) => {
    leconsByModule[l.module_id] = [...(leconsByModule[l.module_id] ?? []), l];
  });

  const quizLeconIds = (allLecons ?? []).filter((l) => l.content_type === "quiz").map((l) => l.id);
  const { data: quizzes } = quizLeconIds.length > 0
    ? await supabase
        .from("quizzes")
        .select("lecon_id, title, pass_score, quiz_questions(id, question_text, options, order_index)")
        .in("lecon_id", quizLeconIds)
    : { data: [] as { lecon_id: string; title: string; pass_score: number; quiz_questions: PreviewQuiz["quiz_questions"] }[] };

  const quizByLecon: Record<string, PreviewQuiz> = {};
  (quizzes ?? []).forEach((q) => { quizByLecon[q.lecon_id] = q; });

  return (
    <FormationContentPreview
      backHref="/org/formations"
      backLabel="Mes formations"
      title={formation.title}
      description={formation.description}
      niveau={formation.niveau}
      estimatedDurationMinutes={formation.estimated_duration_minutes}
      modules={(modules ?? []) as PreviewModule[]}
      leconsByModule={leconsByModule}
      quizByLecon={quizByLecon}
    />
  );
}
