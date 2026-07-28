import { api } from "./api.js";

// ── Types ──

export type GatewayType = "litellm" | "openrouter" | "9router" | "omniroute" | "portkay" | "bifrost" | "helicone" | "kong" | "bloop" | "custom";

export type ProviderHealth = "healthy" | "degraded" | "down" | "unknown";

export type CircuitState = "closed" | "open" | "half-open";

export interface GatewayConfig {
  id: string;
  name: string;
  type: GatewayType;
  baseUrl: string;
  apiKey?: string;
  isEnabled: boolean;
  priority: number;
  rateLimit?: number;
  monthlyQuota?: number;
  models?: string[];
  timeout?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderStatus {
  gatewayId: string;
  gatewayName: string;
  gatewayType: GatewayType;
  health: ProviderHealth;
  latencyMs: number;
  errorRate: number;
  totalRequests: number;
  failedRequests: number;
  lastChecked: string;
  lastError?: string;
  circuitState: CircuitState;
  monthlyCost: number;
  monthlyRequests: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  savedTokens: number;
  savedCostUSD: number;
  memoryUsage: string;
}

export interface GatewayMetrics {
  totalRequests: number;
  totalTokens: number;
  totalCostUSD: number;
  avgLatencyMs: number;
  cacheHitRate: number;
  circuitBreakerTrips: number;
  fallbackCount: number;
  providers: ProviderStatus[];
}

export const GATEWAY_LABELS: Record<GatewayType, string> = {
  litellm: "LiteLLM",
  openrouter: "OpenRouter",
  "9router": "9Router",
  omniroute: "OmniRoute",
  portkay: "Portkay",
  bifrost: "Bifrost",
  helicone: "Helicone",
  kong: "Kong AI Gateway",
  bloop: "Bloop Gateway",
  custom: "Custom Gateway",
};

export const GATEWAY_ICONS: Record<GatewayType, string> = {
  litellm: "⚡",
  openrouter: "🔀",
  "9router": "9️⃣",
  omniroute: "🌐",
  portkay: "🚢",
  bifrost: "🌈",
  helicone: "👁",
  kong: "🦍",
  bloop: "💧",
  custom: "⚙",
};

export const HEALTH_COLORS: Record<ProviderHealth, string> = {
  healthy: "text-green-500",
  degraded: "text-yellow-500",
  down: "text-red-500",
  unknown: "text-text-muted",
};

export const CIRCUIT_COLORS: Record<CircuitState, string> = {
  closed: "text-green-500",
  open: "text-red-500",
  "half-open": "text-yellow-500",
};

// ── API ──

export async function listGateways(): Promise<GatewayConfig[]> {
  return api("/gateway/config");
}

export async function updateGateway(id: string, updates: Partial<GatewayConfig>): Promise<GatewayConfig> {
  return api(`/gateway/config/${id}`, { method: "PUT", body: JSON.stringify(updates) });
}

export async function addGateway(config: Partial<GatewayConfig>): Promise<GatewayConfig> {
  return api("/gateway/config", { method: "POST", body: JSON.stringify(config) });
}

export async function removeGateway(id: string): Promise<void> {
  await api(`/gateway/config/${id}`, { method: "DELETE" });
}

export async function getGatewayStatuses(): Promise<ProviderStatus[]> {
  return api("/gateway/status");
}

export async function checkGatewayHealth(id: string): Promise<{ health: ProviderHealth }> {
  return api(`/gateway/health/${id}`, { method: "POST" });
}

export async function resetGateway(id: string): Promise<void> {
  await api(`/gateway/reset/${id}`, { method: "POST" });
}

export async function getCacheStats(): Promise<CacheStats> {
  return api("/gateway/cache/stats");
}

export async function clearCache(pattern?: string): Promise<void> {
  const params = pattern ? `?pattern=${encodeURIComponent(pattern)}` : "";
  await api(`/gateway/cache${params}`, { method: "DELETE" });
}

export async function getGatewayMetrics(): Promise<GatewayMetrics> {
  return api("/gateway/metrics");
}

export async function sendViaGateway(model: string, messages: { role: string; content: string }[], maxTokens?: number, temperature?: number) {
  return api("/gateway/send", {
    method: "POST",
    body: JSON.stringify({ model, messages, maxTokens, temperature }),
  });
}
