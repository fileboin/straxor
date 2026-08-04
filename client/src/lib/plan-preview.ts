import { PROVIDERS, type ThinkingBudget } from "./models.js";

export interface ModelPricing {
  providerId: string;
  modelId: string;
  inputPer1M: number;
  outputPer1M: number;
  maxOutput: number;
  speed: "fast" | "medium" | "slow";
  tier: "budget" | "mid" | "premium";
}

export interface PlanEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUSD: number;
  estimatedSteps: number;
  estimatedDuration: string;
  recommendedModel: { providerId: string; modelId: string; reason: string };
  alternatives: { providerId: string; modelId: string; costUSD: number; reason: string }[];
}

// Pricing per 1M tokens (USD) — June 2025 rates
export const MODEL_PRICING: ModelPricing[] = [
  // Anthropic
  { providerId: "anthropic", modelId: "claude-fable-5", inputPer1M: 10, outputPer1M: 50, maxOutput: 128000, speed: "slow", tier: "premium" },
  { providerId: "anthropic", modelId: "claude-opus-5", inputPer1M: 5, outputPer1M: 25, maxOutput: 128000, speed: "slow", tier: "premium" },
  { providerId: "anthropic", modelId: "claude-opus-4-8", inputPer1M: 5, outputPer1M: 25, maxOutput: 128000, speed: "slow", tier: "premium" },
  { providerId: "anthropic", modelId: "claude-opus-4-6", inputPer1M: 5, outputPer1M: 25, maxOutput: 128000, speed: "slow", tier: "premium" },
  { providerId: "anthropic", modelId: "claude-sonnet-5", inputPer1M: 3, outputPer1M: 15, maxOutput: 128000, speed: "medium", tier: "mid" },
  { providerId: "anthropic", modelId: "claude-sonnet-4-6", inputPer1M: 3, outputPer1M: 15, maxOutput: 128000, speed: "medium", tier: "mid" },
  { providerId: "anthropic", modelId: "claude-sonnet-4-5", inputPer1M: 3, outputPer1M: 15, maxOutput: 64000, speed: "medium", tier: "mid" },
  { providerId: "anthropic", modelId: "claude-haiku-4-5", inputPer1M: 1, outputPer1M: 5, maxOutput: 64000, speed: "fast", tier: "budget" },
  // OpenAI
  { providerId: "openai", modelId: "gpt-4o", inputPer1M: 2.5, outputPer1M: 10, maxOutput: 16384, speed: "medium", tier: "mid" },
  { providerId: "openai", modelId: "gpt-4o-mini", inputPer1M: 0.15, outputPer1M: 0.6, maxOutput: 16384, speed: "fast", tier: "budget" },
  { providerId: "openai", modelId: "o3", inputPer1M: 10, outputPer1M: 40, maxOutput: 100000, speed: "slow", tier: "premium" },
  { providerId: "openai", modelId: "o4-mini", inputPer1M: 1.1, outputPer1M: 4.4, maxOutput: 100000, speed: "fast", tier: "mid" },
  // Google
  { providerId: "google", modelId: "gemini-2.5-pro", inputPer1M: 1.25, outputPer1M: 10, maxOutput: 65536, speed: "medium", tier: "mid" },
  { providerId: "google", modelId: "gemini-2.5-flash", inputPer1M: 0.15, outputPer1M: 0.6, maxOutput: 65536, speed: "fast", tier: "budget" },
  { providerId: "google", modelId: "gemini-2.0-flash", inputPer1M: 0.1, outputPer1M: 0.4, maxOutput: 8192, speed: "fast", tier: "budget" },
  // DeepSeek
  { providerId: "deepseek", modelId: "deepseek-r1", inputPer1M: 0.55, outputPer1M: 2.19, maxOutput: 32768, speed: "medium", tier: "budget" },
  { providerId: "deepseek", modelId: "deepseek-v3", inputPer1M: 0.27, outputPer1M: 1.1, maxOutput: 32768, speed: "fast", tier: "budget" },
  { providerId: "deepseek", modelId: "deepseek-coder", inputPer1M: 0.14, outputPer1M: 0.28, maxOutput: 16384, speed: "fast", tier: "budget" },
];

function estimateTokens(text: string): number {
  // ~4 chars per token for English/code, ~1.5 for CJK-heavy text
  const asciiRatio = (text.match(/[\x00-\x7F]/g)?.length || 0) / text.length;
  const charsPerToken = asciiRatio > 0.8 ? 4 : 2.5;
  return Math.ceil(text.length / charsPerToken);
}

function classifyComplexity(text: string): "simple" | "moderate" | "complex" {
  const lower = text.toLowerCase();
  const complexMarkers = ["refactor", "architecture", "database", "migration", "security", "optimiz", "perfekt", "kompleks", "složen", "cijeli", "full", "complete", "implement", "kreiraj", "napravi", "build", "deploy", "integrat"];
  const simpleMarkers = ["what", "how", "explain", "what is", "šta je", "kako", "objasni", "why", "zašto", "koliko", "how many", "define", "meaning"];

  const complexHits = complexMarkers.filter((m) => lower.includes(m)).length;
  const simpleHits = simpleMarkers.filter((m) => lower.includes(m)).length;

  if (complexHits >= 2 || text.length > 500) return "complex";
  if (simpleHits >= 2 || text.length < 50) return "simple";
  return "moderate";
}

function estimateSteps(text: string, complexity: "simple" | "moderate" | "complex"): number {
  const base = complexity === "simple" ? 1 : complexity === "moderate" ? 3 : 5;
  const lower = text.toLowerCase();
  const taskKeywords = ["and then", "zatim", "također", "also", "after that", "potom", "step", "korak"];
  const extraSteps = taskKeywords.filter((k) => lower.includes(k)).length;
  return Math.min(base + extraSteps, 12);
}

function estimateDuration(steps: number, speed: ModelPricing["speed"]): string {
  const perStep = speed === "fast" ? 3 : speed === "medium" ? 6 : 12;
  const totalSec = steps * perStep;
  if (totalSec < 60) return `~${totalSec}s`;
  return `~${Math.round(totalSec / 60)}min`;
}

function getPricing(modelId: string): ModelPricing | undefined {
  return MODEL_PRICING.find((p) => p.modelId === modelId);
}

function getModelName(modelId: string): string {
  for (const provider of PROVIDERS) {
    const model = provider.models.find((m) => m.id === modelId);
    if (model) return model.name;
  }
  return modelId;
}

function getProviderName(providerId: string): string {
  return PROVIDERS.find((p) => p.id === providerId)?.name || providerId;
}

export function estimatePlan(
  prompt: string,
  _providerId: string,
  modelId: string,
  thinking: ThinkingBudget
): PlanEstimate {
  const inputTokens = estimateTokens(prompt);
  const complexity = classifyComplexity(prompt);

  // Output estimation based on complexity + thinking budget
  const thinkingMultiplier = thinking === "high" ? 2.5 : thinking === "medium" ? 1.8 : thinking === "low" ? 1.2 : 1;
  const baseOutput = complexity === "simple" ? 200 : complexity === "moderate" ? 600 : 1200;
  const outputTokens = Math.ceil(baseOutput * thinkingMultiplier);

  const totalTokens = inputTokens + outputTokens;
  const steps = estimateSteps(prompt, complexity);

  // Current model cost
  const pricing = getPricing(modelId);
  const currentCost = pricing
    ? ((inputTokens * pricing.inputPer1M) / 1_000_000) + ((outputTokens * pricing.outputPer1M) / 1_000_000)
    : 0;

  // Duration
  const duration = pricing ? estimateDuration(steps, pricing.speed) : "~5s";

  // Recommend best model for this complexity
  const recommended = recommendModel(complexity, thinking);

  // Alternatives
  const alternatives = MODEL_PRICING
    .filter((p) => p.modelId !== modelId)
    .map((p) => {
      const cost = ((inputTokens * p.inputPer1M) / 1_000_000) + ((outputTokens * p.outputPer1M) / 1_000_000);
      let reason = "";
      if (p.tier === "budget" && cost < currentCost * 0.5) reason = "Jeftinija opcija";
      else if (p.tier === "premium" && complexity === "complex") reason = "Bolja za kompleksne zadatke";
      else if (p.speed === "fast") reason = "Brži odgovor";
      return { providerId: p.providerId, modelId: p.modelId, costUSD: cost, reason };
    })
    .filter((a) => a.reason)
    .slice(0, 3);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costUSD: currentCost,
    estimatedSteps: steps,
    estimatedDuration: duration,
    recommendedModel: {
      providerId: recommended.providerId,
      modelId: recommended.modelId,
      reason: recommended.reason,
    },
    alternatives,
  };
}

function recommendModel(
  complexity: "simple" | "moderate" | "complex",
  thinking: ThinkingBudget
): { providerId: string; modelId: string; reason: string } {
  if (complexity === "simple") {
    return { providerId: "anthropic", modelId: "claude-haiku-4-5", reason: "Dovoljno za jednostavna pitanja — najjeftinija opcija" };
  }
  if (complexity === "moderate") {
    if (thinking === "high") {
      return { providerId: "google", modelId: "gemini-2.5-pro", reason: "Odličan balans cijene i reasoning kapaciteta" };
    }
    return { providerId: "anthropic", modelId: "claude-sonnet-5", reason: "Brz i efikasan za srednje kompleksne zadatke" };
  }
  // complex
  if (thinking === "high") {
    return { providerId: "anthropic", modelId: "claude-opus-5", reason: "Najsnažniji model za najkompleksnije zadatke" };
  }
  return { providerId: "openai", modelId: "o3", reason: "Snažan reasoning za kompleksne zadatke" };
}

export function formatCost(usd: number): string {
  if (usd < 0.001) return "< $0.001";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export { getModelName, getProviderName };
