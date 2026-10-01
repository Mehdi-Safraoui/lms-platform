import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { monthStartParisIso } from "@/lib/aiGenerationQuota";
import { learnerLimitFor } from "@/lib/planLimits";

type Supabase = ReturnType<typeof createServiceRoleSupabaseClient>;

/**
 * Consommation d'une entreprise par rapport à son offre (lib/planLimits.ts) :
 * apprenants et formations créées par IA. Une formation IA est comptée le mois
 * où sa structure a été générée pour la première fois (formations.ai_started_at) ;
 * ai_generation_count cumule ensuite toutes ses générations (structure,
 * leçons, quiz, régénérations).
 */
export interface TenantUsageSummary {
  tenantId: string;
  plan: string | null;
  learners: number;
  learnerLimit: number | null;
  aiFormationsThisMonth: number;
  aiQuota: number | null;
  totalAiGenerations: number;
}

export interface TenantUsage extends TenantUsageSummary {
  /** Formations IA démarrées par mois, sur les 6 derniers mois (le plus récent en dernier). */
  history: { month: string; label: string; count: number }[];
  aiFormations: { id: string; title: string; startedAt: string; generationCount: number; isPublished: boolean }[];
}

const monthKey = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" });
const monthLabel = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", month: "short", year: "2-digit" });

function lastSixMonths(): { month: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 15));
    return { month: monthKey.format(d), label: monthLabel.format(d) };
  });
}

/** Résumé pour plusieurs entreprises à la fois (liste super_admin). */
export async function getTenantsUsageSummary(supabase: Supabase, tenantIds: string[]): Promise<Map<string, TenantUsageSummary>> {
  const result = new Map<string, TenantUsageSummary>();
  if (!tenantIds.length) return result;

  const [{ data: tenants }, { data: learners }, { data: aiFormations }] = await Promise.all([
    supabase.from("tenants").select("id, subscription_plan, ai_generation_quota").in("id", tenantIds),
    supabase.from("users").select("tenant_id").in("tenant_id", tenantIds).eq("role", "apprenant"),
    supabase.from("formations").select("tenant_id, ai_started_at, ai_generation_count").in("tenant_id", tenantIds).not("ai_started_at", "is", null),
  ]);

  const monthStart = monthStartParisIso();
  for (const t of tenants ?? []) {
    const own = (aiFormations ?? []).filter((f) => f.tenant_id === t.id);
    result.set(t.id, {
      tenantId: t.id,
      plan: t.subscription_plan,
      learners: (learners ?? []).filter((u) => u.tenant_id === t.id).length,
      learnerLimit: learnerLimitFor(t.subscription_plan),
      aiFormationsThisMonth: own.filter((f) => f.ai_started_at && f.ai_started_at >= monthStart).length,
      aiQuota: t.ai_generation_quota,
      totalAiGenerations: own.reduce((sum, f) => sum + (f.ai_generation_count ?? 0), 0),
    });
  }
  return result;
}

/** Détail pour une entreprise (fiche super_admin). */
export async function getTenantUsage(supabase: Supabase, tenantId: string): Promise<TenantUsage | null> {
  const summary = (await getTenantsUsageSummary(supabase, [tenantId])).get(tenantId);
  if (!summary) return null;

  const { data: formations } = await supabase
    .from("formations")
    .select("id, title, ai_started_at, ai_generation_count, is_published")
    .eq("tenant_id", tenantId)
    .not("ai_started_at", "is", null)
    .order("ai_started_at", { ascending: false });

  const counts = new Map<string, number>();
  for (const f of formations ?? []) {
    const key = monthKey.format(new Date(f.ai_started_at as string));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return {
    ...summary,
    history: lastSixMonths().map((m) => ({ ...m, count: counts.get(m.month) ?? 0 })),
    aiFormations: (formations ?? []).map((f) => ({
      id: f.id,
      title: f.title,
      startedAt: f.ai_started_at as string,
      generationCount: f.ai_generation_count ?? 0,
      isPublished: f.is_published,
    })),
  };
}

/** « 1er novembre » : date de renouvellement du quota mensuel de formations IA. */
export function nextQuotaResetLabel(): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `1er ${next.toLocaleDateString("fr-FR", { month: "long" })}`;
}
