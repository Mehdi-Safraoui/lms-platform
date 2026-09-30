import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export interface QuotaResult {
  allowed: boolean;
  used: number;
  quota: number | null;
}

/**
 * Vérifie ET consomme une unité de quota de génération IA pour ce tenant, de
 * façon atomique (voir la fonction SQL consume_ai_generation_quota) — appelé
 * AVANT le vrai appel au modèle, pour bloquer sans jamais lancer une
 * génération si le quota est déjà atteint. Contrepartie assumée : un échec de
 * génération après consommation (rare — generateLessonContent/Quiz retentent
 * déjà 3 fois en interne avant d'abandonner) consomme quand même 1 unité,
 * puisque de vrais appels au modèle ont réellement eu lieu.
 */
export async function consumeAiGenerationQuota(tenantId: string | null): Promise<QuotaResult> {
  // Catalogue global (super_admin) : pas de quota.
  if (tenantId === null) return { allowed: true, used: 0, quota: null };

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.rpc("consume_ai_generation_quota", { p_tenant_id: tenantId }).single();

  if (error || !data) {
    throw new Error(`Échec de la vérification du quota : ${error?.message ?? "réponse vide"}`);
  }
  return data as QuotaResult;
}

/** Lecture seule, pour l'affichage du quota restant côté UI. */
export async function getAiGenerationQuota(tenantId: string | null): Promise<QuotaResult> {
  if (tenantId === null) return { allowed: true, used: 0, quota: null };

  const supabase = createServiceRoleSupabaseClient();
  const { data } = await supabase.from("tenants").select("ai_generation_quota, ai_generation_used").eq("id", tenantId).single();
  return { allowed: true, used: data?.ai_generation_used ?? 0, quota: data?.ai_generation_quota ?? null };
}
