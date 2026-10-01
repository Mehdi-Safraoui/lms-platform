import { notFound, redirect } from "next/navigation";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";
import { hasActiveSubscription } from "@/lib/subscription";
import FormationContentPreview, {
  type PreviewModule,
  type PreviewLesson,
  type PreviewQuiz,
} from "@/components/lessons/FormationContentPreview";
import CatalogueToggle from "../CatalogueToggle";

type Props = { params: Promise<{ id: string }> };

export default async function CatalogueFormationPreviewPage({ params }: Props) {
  const { id: formationId } = await params;
  const dbUser = await getCurrentUser();
  if (!dbUser) notFound();

  const supabase = createServiceRoleSupabaseClient();
  if (!dbUser?.tenant_id) notFound();
  if (!(await hasActiveSubscription(dbUser.tenant_id))) redirect("/pricing");

  const [{ data: formation }, { data: tenantFormation }] = await Promise.all([
    supabase
      .from("formations")
      .select("id, title, description, niveau, estimated_duration_minutes")
      .eq("id", formationId)
      .eq("is_published", true)
      .is("tenant_id", null)
      .single(),
    supabase
      .from("tenant_formations")
      .select("formation_id")
      .eq("tenant_id", dbUser.tenant_id)
      .eq("formation_id", formationId)
      .maybeSingle(),
  ]);
  if (!formation) notFound();
  const enabled = !!tenantFormation;

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
      backHref="/org/catalogue"
      backLabel="Catalogue"
      title={formation.title}
      description={formation.description}
      niveau={formation.niveau}
      estimatedDurationMinutes={formation.estimated_duration_minutes}
      modules={(modules ?? []) as PreviewModule[]}
      leconsByModule={leconsByModule}
      quizByLecon={quizByLecon}
      headerRight={<CatalogueToggle formationId={formation.id} enabled={enabled} />}
    />
  );
}
