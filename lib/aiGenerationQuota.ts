import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";

/**
 * Quota de création par IA : nombre de FORMATIONS par mois calendaire (heure
 * de Paris), stocké dans tenants.ai_generation_quota (null = illimité). Une
 * formation est comptée une fois, à la première génération de sa structure ;
 * ses leçons et régénérations sont ensuite incluses (voir la fonction SQL
 * consume_formation_ai, migration 20261001000000).
 */
export interface FormationQuota {
  /** Formations IA déjà comptées ce mois-ci. */
  used: number;
  /** null = illimité (et toujours null pour le catalogue global). */
  total: number | null;
  /** Cette formation est-elle déjà comptée (ses générations sont alors incluses) ? */
  formationCounted: boolean;
}

export interface ConsumeResult extends FormationQuota {
  allowed: boolean;
  reason: "quota" | "formation_cap" | "not_found" | null;
}

/**
 * Plafond de générations IA (structure, leçons, quiz, régénérations) pour une
 * même formation — garde-fou contre un usage abusif, largement au-dessus d'un
 * usage normal (une formation de 50 leçons régénérées deux fois ≈ 150).
 */
export const MAX_GENERATIONS_PER_FORMATION = 300;

/** Décalage de l'heure de Paris par rapport à UTC à un instant donné (1 ou 2 h). */
function parisOffsetMs(date: Date): number {
  return new Date(date.toLocaleString("en-US", { timeZone: "Europe/Paris" })).getTime() -
    new Date(date.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
}

/** Minuit du 1er du mois en cours à Paris, en ISO UTC — même borne que consume_formation_ai. */
function monthStartParisIso(): string {
  const parisNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const firstDayUtc = Date.UTC(parisNow.getFullYear(), parisNow.getMonth(), 1);
  return new Date(firstDayUtc - parisOffsetMs(new Date(firstDayUtc))).toISOString();
}

/**
 * Vérifie ET consomme, de façon atomique, avant tout appel réel au modèle.
 * tenantId null = super_admin sur le catalogue global : jamais limité.
 */
export async function consumeFormationAi(tenantId: string | null, formationId: string): Promise<ConsumeResult> {
  if (tenantId === null) return { allowed: true, reason: null, used: 0, total: null, formationCounted: true };

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .rpc("consume_formation_ai", {
      p_tenant_id: tenantId,
      p_formation_id: formationId,
      p_max_per_formation: MAX_GENERATIONS_PER_FORMATION,
    })
    .single();

  if (error || !data) {
    throw new Error(`Échec de la vérification du quota : ${error?.message ?? "réponse vide"}`);
  }
  const row = data as { allowed: boolean; reason: ConsumeResult["reason"]; used: number; quota: number | null };
  return { allowed: row.allowed, reason: row.reason, used: row.used, total: row.quota, formationCounted: row.allowed || row.reason === "formation_cap" };
}

/** Lecture seule, pour l'affichage (création d'une formation, étape Génération). */
export async function getFormationQuota(tenantId: string | null, formationId?: string): Promise<FormationQuota> {
  if (tenantId === null) return { used: 0, total: null, formationCounted: true };

  const supabase = createServiceRoleSupabaseClient();
  const [{ data: tenant }, { count }, { data: formation }] = await Promise.all([
    supabase.from("tenants").select("ai_generation_quota").eq("id", tenantId).single(),
    supabase
      .from("formations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("ai_started_at", monthStartParisIso()),
    formationId
      ? supabase.from("formations").select("ai_started_at").eq("id", formationId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    used: count ?? 0,
    total: tenant?.ai_generation_quota ?? null,
    formationCounted: !!formation?.ai_started_at,
  };
}

/** Message affiché quand la génération est refusée. */
export function quotaRefusalMessage(result: ConsumeResult): string {
  if (result.reason === "formation_cap") {
    return `Limite de ${MAX_GENERATIONS_PER_FORMATION} générations IA atteinte pour cette formation. Contactez Ahead si vous avez besoin d'aller plus loin.`;
  }
  return `Quota de formations IA atteint ce mois-ci (${result.used}/${result.total}). Il se renouvelle le 1er du mois — contactez Ahead pour l'augmenter.`;
}
