/**
 * Tarifs publics des modèles utilisés, en dollars US par million de tokens
 * (tarif Standard, hors traitement régional). Relevés le 1er octobre 2026 :
 *   - OpenAI : https://developers.openai.com/api/docs/pricing
 *   - Voyage AI : https://docs.voyageai.com/docs/pricing (voyage-3 n'a pas de
 *     tokens gratuits)
 * Le coût est recalculé à chaque lecture (rien n'est figé en base) : corriger
 * une valeur ici corrige tout l'historique.
 */
interface ModelPrice {
  input: number;
  cachedInput: number;
  cacheWrite: number;
  output: number;
}

interface PricedModel {
  short: ModelPrice;
  /** Requête de plus de LONG_CONTEXT_THRESHOLD tokens d'entrée : toute la requête passe à ce tarif. */
  long?: ModelPrice;
}

export const LONG_CONTEXT_THRESHOLD = 272_000;

const PRICES: Record<string, PricedModel> = {
  "gpt-6.1-sol": {
    short: { input: 2, cachedInput: 0.1, cacheWrite: 2.5, output: 10 },
    long: { input: 4, cachedInput: 0.2, cacheWrite: 5, output: 15 },
  },
  "gpt-6-luna": {
    short: { input: 0.1, cachedInput: 0.01, cacheWrite: 0.125, output: 0.5 },
    long: { input: 0.2, cachedInput: 0.02, cacheWrite: 0.25, output: 0.75 },
  },
  "voyage-3": {
    short: { input: 0.06, cachedInput: 0.06, cacheWrite: 0.06, output: 0 },
  },
};

// L'API renvoie parfois l'identifiant daté du modèle (« gpt-6.1-sol-2026-09-22 ») :
// on retient le tarif de l'identifiant connu le plus long qui en est le préfixe.
function priceFor(model: string): PricedModel | null {
  if (PRICES[model]) return PRICES[model];
  const match = Object.keys(PRICES)
    .filter((known) => model.startsWith(`${known}-`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PRICES[match] : null;
}

export function isPricedModel(model: string): boolean {
  return priceFor(model) !== null;
}

export interface TokenUsage {
  model: string;
  longContext: boolean;
  /** Total des tokens d'entrée, tokens en cache inclus (comme dans la réponse OpenAI). */
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}

/** Coût en dollars US, ou null si le modèle n'a pas de tarif connu. */
export function costUsd(usage: TokenUsage): number | null {
  const priced = priceFor(usage.model);
  if (!priced) return null;
  const price = usage.longContext && priced.long ? priced.long : priced.short;
  const uncached = Math.max(0, usage.inputTokens - usage.cachedInputTokens - usage.cacheWriteTokens);
  return (
    (uncached * price.input +
      usage.cachedInputTokens * price.cachedInput +
      usage.cacheWriteTokens * price.cacheWrite +
      usage.outputTokens * price.output) /
    1_000_000
  );
}

const usd = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** « 1,24 $US » ; « < 0,01 $US » pour un montant non nul mais inférieur au centime. */
export function formatUsd(value: number): string {
  if (value > 0 && value < 0.005) return `< ${usd.format(0.01)}`;
  return usd.format(value);
}
