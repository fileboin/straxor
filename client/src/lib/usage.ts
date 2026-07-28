import { api } from "./api.js";

// ── Types ──

export type UsageBackend = "openmeter" | "lago" | "custom";

export interface UsageEvent {
  id: string;
  timestamp: string;
  userId: string;
  projectId?: string;
  machineId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs?: number;
  success: boolean;
  errorMessage?: string;
}

export interface UsageAggregate {
  dimension: "provider" | "model" | "project" | "machine" | "day" | "hour";
  label: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  requestCount: number;
  avgLatencyMs: number;
  errorRate: number;
}

export interface CostSummary {
  totalCostUsd: number;
  totalTokens: number;
  totalRequests: number;
  period: { from: string; to: string };
  byProvider: UsageAggregate[];
  byModel: UsageAggregate[];
  byProject: UsageAggregate[];
  byDay: UsageAggregate[];
}

export interface UsageBudget {
  id: string;
  name: string;
  monthlyLimitUsd: number;
  currentSpendUsd: number;
  alertThresholdPercent: number;
  isHardLimit: boolean;
  createdAt: string;
}

export interface ModelPricing {
  provider: string;
  model: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  label: string;
}

// ── Formatting ──

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

// ── Labels ──

export const PROVIDER_ICONS: Record<string, string> = {
  anthropic: "◆",
  openai: "◉",
  google: "◇",
  deepseek: "🔮",
  groq: "⚡",
  xai: "✖",
  moonshot: "🌙",
  mistral: "🌀",
  ollama: "🦙",
};

export const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "text-orange-400",
  openai: "text-green-400",
  google: "text-blue-400",
  deepseek: "text-purple-400",
  groq: "text-yellow-400",
  xai: "text-cyan-400",
  moonshot: "text-indigo-400",
  mistral: "text-pink-400",
  ollama: "text-emerald-400",
};

export const BACKEND_LABELS: Record<UsageBackend, string> = {
  openmeter: "OpenMeter",
  lago: "Lago",
  custom: "Custom (Local)",
};

export const BACKEND_ICONS: Record<UsageBackend, string> = {
  openmeter: "📊",
  lago: "💰",
  custom: "🔧",
};

// ── API ──

export async function logUsageEvent(event: {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  latencyMs?: number;
  projectId?: string;
  machineId?: string;
  success?: boolean;
}): Promise<UsageEvent> {
  return api("/usage/events", {
    method: "POST",
    body: JSON.stringify(event),
  });
}

export async function listUsageEvents(params: {
  from?: string;
  to?: string;
  provider?: string;
  model?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<UsageEvent[]> {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.provider) qs.set("provider", params.provider);
  if (params.model) qs.set("model", params.model);
  if (params.projectId) qs.set("projectId", params.projectId);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));
  const q = qs.toString();
  return api(`/usage/events${q ? `?${q}` : ""}`);
}

export async function getUsageAggregate(params: {
  dimension?: UsageAggregate["dimension"];
  from?: string;
  to?: string;
  provider?: string;
  model?: string;
} = {}): Promise<UsageAggregate[]> {
  const qs = new URLSearchParams();
  if (params.dimension) qs.set("dimension", params.dimension);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.provider) qs.set("provider", params.provider);
  if (params.model) qs.set("model", params.model);
  const q = qs.toString();
  return api(`/usage/aggregate${q ? `?${q}` : ""}`);
}

export async function getCostSummary(params: { from?: string; to?: string } = {}): Promise<CostSummary> {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const q = qs.toString();
  return api(`/usage/summary${q ? `?${q}` : ""}`);
}

export async function listPricing(): Promise<ModelPricing[]> {
  return api("/usage/pricing");
}

export async function estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): Promise<number> {
  const res = await api<{ costUsd: number }>("/usage/estimate", {
    method: "POST",
    body: JSON.stringify({ provider, model, inputTokens, outputTokens }),
  });
  return res.costUsd;
}

export async function listBudgets(): Promise<UsageBudget[]> {
  return api("/usage/budgets");
}

export async function createBudget(budget: {
  name: string;
  monthlyLimitUsd: number;
  alertThresholdPercent?: number;
  isHardLimit?: boolean;
}): Promise<UsageBudget> {
  return api("/usage/budgets", {
    method: "POST",
    body: JSON.stringify(budget),
  });
}

export async function deleteBudget(id: string): Promise<void> {
  await api(`/usage/budgets/${id}`, { method: "DELETE" });
}

export async function getBackend(): Promise<{ backend: UsageBackend; url: string }> {
  return api("/usage/backend");
}
