import { AsyncLocalStorage } from "node:async_hooks";
import type { ResponseUsage } from "openai/resources/responses/responses";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { LONG_CONTEXT_THRESHOLD } from "@/lib/aiPricing";

/**
 * Comptage des tokens de chaque appel OpenAI / Voyage AI, pour le suivi du
 * coût IA par entreprise (table ai_usage_events, coût calculé à la lecture par
 * lib/aiPricing.ts).
 *
 * La route qui déclenche l'appel déclare à qui l'imputer avec withAiUsage() ;
 * les fonctions d'IA (lib/ai/*, lib/embeddings.ts) appellent ensuite
 * recordOpenAiUsage / recordVoyageUsage sans avoir à faire suivre l'entreprise
 * ou la formation dans tous leurs paramètres.
 */
export type AiUsageFeature = "sources" | "cadrage" | "structure" | "lecons" | "indexation_lecons" | "chat";

export interface AiUsageContext {
  /** null = catalogue Ahead (super_admin). */
  tenantId: string | null;
  formationId: string | null;
  userId: string | null;
  feature: AiUsageFeature;
}

const storage = new AsyncLocalStorage<AiUsageContext>();

export function withAiUsage<T>(context: AiUsageContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn);
}

interface UsageRow {
  provider: "openai" | "voyage";
  model: string;
  input_tokens: number;
  cached_input_tokens?: number;
  cache_write_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
}

// N'interrompt jamais l'appel d'IA : un échec d'enregistrement est seulement
// journalisé (le coût de cet appel manquera au suivi).
async function insert(row: UsageRow): Promise<void> {
  const context = storage.getStore();
  if (!context) console.warn(`[aiUsage] Appel ${row.provider} (${row.model}) hors d'une route instrumentée : imputé à « non_attribue ».`);
  try {
    const { error } = await createServiceRoleSupabaseClient()
      .from("ai_usage_events")
      .insert({
        tenant_id: context?.tenantId ?? null,
        formation_id: context?.formationId ?? null,
        user_id: context?.userId ?? null,
        feature: context?.feature ?? "non_attribue",
        long_context: row.input_tokens > LONG_CONTEXT_THRESHOLD,
        ...row,
      });
    if (error) console.error("[aiUsage] Enregistrement impossible :", error.message);
  } catch (err) {
    console.error("[aiUsage] Enregistrement impossible :", err);
  }
}

/** usage = champ `usage` d'une réponse de l'API Responses (ou de l'événement response.completed en streaming). */
export async function recordOpenAiUsage(model: string, usage: ResponseUsage | null | undefined): Promise<void> {
  if (!usage) return;
  await insert({
    provider: "openai",
    model,
    input_tokens: usage.input_tokens ?? 0,
    cached_input_tokens: usage.input_tokens_details?.cached_tokens ?? 0,
    cache_write_tokens: usage.input_tokens_details?.cache_write_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    reasoning_tokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
  });
}

export async function recordVoyageUsage(model: string, totalTokens: number | null | undefined): Promise<void> {
  if (!totalTokens) return;
  await insert({ provider: "voyage", model, input_tokens: totalTokens });
}
