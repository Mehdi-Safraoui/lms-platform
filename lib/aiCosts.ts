import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { costUsd, isPricedModel } from "@/lib/aiPricing";
import { currentMonthKey, lastSixMonths } from "@/lib/tenantUsage";

type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

/**
 * Coût IA réel par entreprise, à partir des tokens enregistrés à chaque appel
 * (lib/aiUsage.ts) et des tarifs publics (lib/aiPricing.ts). Le suivi commence
 * au déploiement de cette fonctionnalité : les appels antérieurs ne sont pas
 * connus.
 */
export const FEATURE_LABEL: Record<string, string> = {
  sources: "Indexation des documents",
  cadrage: "Cadrage",
  structure: "Structure",
  lecons: "Leçons et quiz",
  indexation_lecons: "Indexation des leçons",
  chat: "Chat apprenant",
  non_attribue: "Non attribué",
};

interface SummaryRow {
  tenant_id: string | null;
  month: string;
  feature: string;
  formation_id: string | null;
  provider: string;
  model: string;
  long_context: boolean;
  calls: number;
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
}

interface PricedRow extends SummaryRow {
  usd: number;
}

async function loadRows(supabase: Supabase, since: string, tenantId: string | null = null): Promise<{ rows: PricedRow[]; unpricedModels: string[] }> {
  const { data, error } = await supabase.rpc("ai_usage_summary", { p_since: since, p_tenant_id: tenantId });
  if (error) {
    // Migration 20261001000002 pas encore appliquée : pas de suivi plutôt qu'une page en erreur.
    console.error("[aiCosts] ai_usage_summary :", error.message);
    return { rows: [], unpricedModels: [] };
  }
  const unpriced = new Set<string>();
  const rows = ((data ?? []) as SummaryRow[]).map((r) => {
    const row = {
      ...r,
      calls: Number(r.calls),
      input_tokens: Number(r.input_tokens),
      cached_input_tokens: Number(r.cached_input_tokens),
      cache_write_tokens: Number(r.cache_write_tokens),
      output_tokens: Number(r.output_tokens),
    };
    if (!isPricedModel(row.model)) unpriced.add(row.model);
    const usd =
      costUsd({
        model: row.model,
        longContext: row.long_context,
        inputTokens: row.input_tokens,
        cachedInputTokens: row.cached_input_tokens,
        cacheWriteTokens: row.cache_write_tokens,
        outputTokens: row.output_tokens,
      }) ?? 0;
    return { ...row, usd };
  });
  return { rows, unpricedModels: [...unpriced] };
}

function sum(rows: PricedRow[]): number {
  return rows.reduce((total, r) => total + r.usd, 0);
}

function monthStartUtcIso(monthKey: string): string {
  // Début du mois à Paris, avec une marge d'un jour : le filtre fin se fait
  // ensuite sur la clé de mois calculée en base, à l'heure de Paris.
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1) - 24 * 3600 * 1000).toISOString();
}

export interface AiCostsOverview {
  /** Coût du mois en cours par entreprise (clé = tenant_id). */
  byTenant: Map<string, number>;
  totalUsd: number;
  /** Formations du catalogue Ahead (créées par le super_admin). */
  catalogueUsd: number;
  unattributedUsd: number;
  unpricedModels: string[];
}

/** Mois en cours, toutes entreprises (liste super_admin). */
export async function getAiCostsOverview(supabase: Supabase): Promise<AiCostsOverview> {
  const month = currentMonthKey();
  const { rows, unpricedModels } = await loadRows(supabase, monthStartUtcIso(month));
  const current = rows.filter((r) => r.month === month);

  const byTenant = new Map<string, number>();
  for (const r of current) {
    if (r.tenant_id) byTenant.set(r.tenant_id, (byTenant.get(r.tenant_id) ?? 0) + r.usd);
  }
  return {
    byTenant,
    totalUsd: sum(current),
    catalogueUsd: sum(current.filter((r) => !r.tenant_id && r.feature !== "non_attribue")),
    unattributedUsd: sum(current.filter((r) => !r.tenant_id && r.feature === "non_attribue")),
    unpricedModels,
  };
}

export interface TenantAiCosts {
  thisMonthUsd: number;
  sixMonthsUsd: number;
  history: { month: string; label: string; usd: number }[];
  /** Postes du mois en cours, du plus coûteux au moins coûteux. */
  byFeature: { feature: string; label: string; usd: number; calls: number; tokens: number }[];
  /** Coût cumulé de chaque formation depuis le début du suivi (clé = formation_id). */
  byFormation: Record<string, number>;
  unpricedModels: string[];
}

/** Détail pour une entreprise (fiche super_admin). */
export async function getTenantAiCosts(supabase: Supabase, tenantId: string): Promise<TenantAiCosts> {
  const { rows, unpricedModels } = await loadRows(supabase, "2026-01-01T00:00:00Z", tenantId);
  const months = lastSixMonths();
  const month = currentMonthKey();
  const current = rows.filter((r) => r.month === month);

  const features = new Map<string, { usd: number; calls: number; tokens: number }>();
  for (const r of current) {
    const f = features.get(r.feature) ?? { usd: 0, calls: 0, tokens: 0 };
    f.usd += r.usd;
    f.calls += r.calls;
    f.tokens += r.input_tokens + r.output_tokens;
    features.set(r.feature, f);
  }

  const byFormation: Record<string, number> = {};
  for (const r of rows) {
    if (r.formation_id) byFormation[r.formation_id] = (byFormation[r.formation_id] ?? 0) + r.usd;
  }

  const history = months.map((m) => ({ ...m, usd: sum(rows.filter((r) => r.month === m.month)) }));
  return {
    thisMonthUsd: sum(current),
    sixMonthsUsd: history.reduce((total, h) => total + h.usd, 0),
    history,
    byFeature: [...features.entries()]
      .map(([feature, f]) => ({ feature, label: FEATURE_LABEL[feature] ?? feature, ...f }))
      .sort((a, b) => b.usd - a.usd),
    byFormation,
    unpricedModels,
  };
}
