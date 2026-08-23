import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import FormationChat from "@/components/lessons/FormationChat";

type Props = { children: React.ReactNode; params: Promise<{ formationId: string }> };

/**
 * Enveloppe la page de présentation ET les pages de leçon d'une même formation
 * (segment dynamique [formationId] partagé) — le widget de chat est donc
 * disponible partout dans le parcours de la formation, pas seulement sur sa
 * page d'accueil. Le contrôle d'accès réel (rôle apprenant + inscription à
 * cette formation précise) est fait côté API (app/api/agent/[formationId]/
 * route.ts) — le widget s'affiche pour tout visiteur de la formation, et
 * relaie simplement l'erreur si l'API refuse.
 */
export default async function ApprenantFormationLayout({ children, params }: Props) {
  const { formationId } = await params;

  const supabase = createServiceRoleSupabaseClient();
  const { data: formation } = await supabase
    .from("formations")
    .select("title")
    .eq("id", formationId)
    .single();

  return (
    <>
      {children}
      <FormationChat formationId={formationId} formationTitle={formation?.title ?? null} />
    </>
  );
}
