import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

/**
 * Vérifie qu'une formation est réellement accessible au tenant donné : soit
 * elle lui appartient directement (formation créée par son propre Formateur,
 * V2), soit c'est une formation du catalogue global (tenant_id null) que ce
 * tenant a explicitement activée via tenant_formations.
 *
 * Trouvé en auditant l'app (pas construit aujourd'hui) : ni la page détail
 * formation ni la page leçon côté apprenant ne faisaient cette vérification —
 * elles ne filtraient que sur is_published. N'importe quel apprenant
 * authentifié pouvait donc lire le contenu complet de n'importe quelle
 * formation publiée d'une autre entreprise en connaissant son id, et
 * s'auto-inscrire sur n'importe quel formationId via POST /api/enrollments
 * sans aucune validation. Même logique que authorizeAccess() dans
 * app/api/agent/[formationId]/route.ts, extraite ici pour être réutilisée à
 * la fois côté pages apprenant et côté route d'inscription.
 */
export async function isFormationAccessibleToTenant(
  supabase: Supabase,
  tenantId: string | null,
  formation: { id: string; tenant_id: string | null }
): Promise<boolean> {
  if (!tenantId) return false;

  if (formation.tenant_id) {
    return formation.tenant_id === tenantId;
  }

  const { data } = await supabase
    .from("tenant_formations")
    .select("formation_id")
    .eq("tenant_id", tenantId)
    .eq("formation_id", formation.id)
    .maybeSingle();
  return !!data;
}

/**
 * Résout un lecon_id jusqu'à sa formation et vérifie qu'elle est accessible au
 * tenant donné — utilisé par les routes progress/* qui reçoivent un lecon_id
 * envoyé par le client sans autre garantie qu'il appartient à une formation que
 * son tenant peut réellement suivre (sinon un apprenant pouvait s'auto-créditer
 * des points / marquer des leçons "terminées" sur n'importe quel lecon_id
 * deviné, même d'une autre entreprise).
 */
export async function isLeconAccessibleToTenant(
  supabase: Supabase,
  tenantId: string | null,
  leconId: string
): Promise<boolean> {
  if (!tenantId) return false;

  const { data: lecon } = await supabase.from("lecons").select("module_id").eq("id", leconId).maybeSingle();
  if (!lecon) return false;

  const { data: mod } = await supabase.from("modules").select("formation_id").eq("id", lecon.module_id).maybeSingle();
  if (!mod) return false;

  const { data: formation } = await supabase
    .from("formations")
    .select("id, tenant_id")
    .eq("id", mod.formation_id)
    .maybeSingle();
  if (!formation) return false;

  return isFormationAccessibleToTenant(supabase, tenantId, formation);
}

/**
 * Même vérification que isLeconAccessibleToTenant, mais à partir d'un quiz_id
 * (route progress/quiz-passed) — un quiz appartient à une leçon.
 */
export async function isQuizAccessibleToTenant(
  supabase: Supabase,
  tenantId: string | null,
  quizId: string
): Promise<boolean> {
  if (!tenantId) return false;

  const { data: quiz } = await supabase.from("quizzes").select("lecon_id").eq("id", quizId).maybeSingle();
  if (!quiz) return false;

  return isLeconAccessibleToTenant(supabase, tenantId, quiz.lecon_id);
}
