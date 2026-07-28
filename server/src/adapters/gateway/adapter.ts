// ── Gateway Types ──

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
  priority: number; // lower = higher priority
  rateLimit?: number; // requests per minute
  monthlyQuota?: number; // max monthly cost USD
  models?: string[]; // which models this gateway handles
  timeout?: number; // ms
  createdAt: string;
  updatedAt: string;
}

export interface GatewayRoute {
  providerId: string;
  modelId: string;
  gatewayId: string;
  weight: number; // for load balancing
  costPer1MInput: number;
  costPer1MOutput: number;
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

export interface CacheEntry {
  id: string;
  promptHash: string;
  prompt: string;
  response: string;
  model: string;
  provider: string;
  tokens: number;
  hitCount: number;
  createdAt: string;
  lastHitAt: string;
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

export interface RoutingDecision {
  gatewayId: string;
  gatewayName: string;
  reason: string;
  fallbacks: { gatewayId: string; reason: string }[];
}

export interface GatewayAdapter {
  // Send a request through the gateway
  sendRequest(params: {
    model: string;
    messages: { role: string; content: string }[];
    stream?: boolean;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ content: string; tokens: number; model: string; provider: string; latencyMs: number }>;

  // Stream a request through the gateway
  streamRequest(params: {
    model: string;
    messages: { role: string; content: string }[];
    maxTokens?: number;
    temperature?: number;
    onToken: (token: string) => void;
    onDone: () => void;
    onError: (error: string) => void;
  }): Promise<void>;

  // Check provider health
  checkHealth(gatewayId: string): Promise<ProviderHealth>;

  // Get all provider statuses
  getStatuses(): Promise<ProviderStatus[]>;

  // Get cache stats
  getCacheStats(): Promise<CacheStats>;

  // Clear cache
  clearCache(pattern?: string): Promise<void>;

  // Get metrics
  getMetrics(): Promise<GatewayMetrics>;
}
