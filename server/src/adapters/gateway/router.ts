import type { GatewayConfig, GatewayAdapter, ProviderStatus, CacheStats, GatewayMetrics, RoutingDecision } from "./adapter.js";
import { CircuitBreaker, withRetry } from "./circuit-breaker.js";
import { CacheLayer } from "./cache.js";
import { HealthChecker } from "./health-checker.js";

// ── Built-in gateway configs ──

const BUILTIN_GATEWAYS: GatewayConfig[] = [
  {
    id: "litellm",
    name: "LiteLLM",
    type: "litellm",
    baseUrl: "http://localhost:4000",
    isEnabled: false,
    priority: 1,
    timeout: 30000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    type: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    isEnabled: false,
    priority: 2,
    rateLimit: 60,
    timeout: 30000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "9router",
    name: "9Router",
    type: "9router",
    baseUrl: "https://api.9router.dev/v1",
    isEnabled: false,
    priority: 3,
    timeout: 30000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "omniroute",
    name: "OmniRoute",
    type: "omniroute",
    baseUrl: "https://api.omniroute.dev/v1",
    isEnabled: false,
    priority: 4,
    timeout: 30000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "portkay",
    name: "Portkay",
    type: "portkay",
    baseUrl: "https://api.portkay.com/v1",
    isEnabled: false,
    priority: 5,
    timeout: 30000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "bifrost",
    name: "Bifrost",
    type: "bifrost",
    baseUrl: "http://localhost:8080",
    isEnabled: false,
    priority: 6,
    timeout: 30000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "helicone",
    name: "Helicone",
    type: "helicone",
    baseUrl: "https://www.helicone.ai/api",
    isEnabled: false,
    priority: 7,
    timeout: 30000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "kong",
    name: "Kong AI Gateway",
    type: "kong",
    baseUrl: "http://localhost:8000",
    isEnabled: false,
    priority: 8,
    timeout: 30000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "bloop",
    name: "Bloop Gateway",
    type: "bloop",
    baseUrl: "http://localhost:3030",
    isEnabled: false,
    priority: 9,
    timeout: 30000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export class GatewayRouter implements GatewayAdapter {
  private gateways: Map<string, GatewayConfig> = new Map();
  private circuitBreaker: CircuitBreaker;
  private cache: CacheLayer;
  private healthChecker: HealthChecker;
  private totalRequests = 0;
  private totalTokens = 0;
  private totalCostUSD = 0;
  private totalLatencyMs = 0;
  private fallbackCount = 0;

  constructor() {
    // Load built-in gateways
    for (const gw of BUILTIN_GATEWAYS) {
      this.gateways.set(gw.id, { ...gw });
    }

    this.circuitBreaker = new CircuitBreaker();
    this.cache = new CacheLayer();
    this.healthChecker = new HealthChecker(this.circuitBreaker);
  }

  // ── Gateway management ──

  addGateway(config: GatewayConfig): void {
    this.gateways.set(config.id, config);
  }

  updateGateway(id: string, updates: Partial<GatewayConfig>): GatewayConfig | null {
    const gw = this.gateways.get(id);
    if (!gw) return null;
    const updated = { ...gw, ...updates, updatedAt: new Date().toISOString() };
    this.gateways.set(id, updated);
    return updated;
  }

  removeGateway(id: string): boolean {
    return this.gateways.delete(id);
  }

  getGateway(id: string): GatewayConfig | undefined {
    return this.gateways.get(id);
  }

  getEnabledGateways(): GatewayConfig[] {
    return Array.from(this.gateways.values())
      .filter((gw) => gw.isEnabled)
      .sort((a, b) => a.priority - b.priority);
  }

  getAllGateways(): GatewayConfig[] {
    return Array.from(this.gateways.values()).sort((a, b) => a.priority - b.priority);
  }

  // ── Routing ──

  private route(model: string): RoutingDecision {
    const enabled = this.getEnabledGateways();
    const fallbacks: RoutingDecision["fallbacks"] = [];

    // Find primary gateway
    for (const gw of enabled) {
      if (!this.circuitBreaker.canExecute(gw.id)) {
        fallbacks.push({ gatewayId: gw.id, reason: "Circuit breaker open" });
        continue;
      }

      if (gw.models && gw.models.length > 0 && !gw.models.some((m) => model.includes(m))) {
        fallbacks.push({ gatewayId: gw.id, reason: "Model not supported" });
        continue;
      }

      const status = this.healthChecker.getRecord(gw.id);
      if (status.health === "down") {
        fallbacks.push({ gatewayId: gw.id, reason: "Provider down" });
        continue;
      }

      return {
        gatewayId: gw.id,
        gatewayName: gw.name,
        reason: "Primary selected",
        fallbacks,
      };
    }

    // No healthy gateway found — use first enabled as last resort
    if (enabled.length > 0) {
      const last = enabled[0];
      return {
        gatewayId: last.id,
        gatewayName: last.name,
        reason: "Last resort (no healthy providers)",
        fallbacks,
      };
    }

    throw new Error("No gateways enabled. Configure at least one gateway.");
  }

  // ── GatewayAdapter ──

  async sendRequest(params: {
    model: string;
    messages: { role: string; content: string }[];
    stream?: boolean;
    maxTokens?: number;
    temperature?: number;
  }) {
    const { model, messages, maxTokens, temperature } = params;

    // Check cache first
    const prompt = messages.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join("\n");
    const cached = this.cache.get(prompt, model);
    if (cached) {
      return {
        content: cached.response,
        tokens: cached.tokens,
        model: cached.model,
        provider: cached.provider,
        latencyMs: 0,
      };
    }

    // Route to gateway
    const decision = this.route(model);
    const gw = this.gateways.get(decision.gatewayId);
    if (!gw) throw new Error(`Gateway not found: ${decision.gatewayId}`);

    const startTime = Date.now();

    try {
      const result = await withRetry(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), gw.timeout || 30000);

        const res = await fetch(`${gw.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(gw.apiKey ? { Authorization: `Bearer ${gw.apiKey}` } : {}),
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const errorBody = await res.text().catch(() => "");
          throw new Error(`Gateway ${gw.name} error ${res.status}: ${errorBody.slice(0, 200)}`);
        }

        return res.json();
      });

      const latencyMs = Date.now() - startTime;
      const content = result.choices?.[0]?.message?.content || "";
      const tokens = result.usage?.total_tokens || 0;

      // Record success
      this.healthChecker.recordRequest(decision.gatewayId, true, 0, tokens);
      this.totalRequests++;
      this.totalTokens += tokens;
      this.totalLatencyMs += latencyMs;

      // Cache response
      this.cache.set(prompt, model, content, gw.name, tokens);

      return {
        content,
        tokens,
        model: result.model || model,
        provider: gw.name,
        latencyMs,
      };
    } catch (err) {
      this.healthChecker.recordRequest(decision.gatewayId, false, 0, 0);
      this.fallbackCount++;

      // Try fallbacks
      for (const fb of decision.fallbacks) {
        const fbGw = this.gateways.get(fb.gatewayId);
        if (!fbGw || !this.circuitBreaker.canExecute(fb.gatewayId)) continue;

        try {
          const res = await fetch(`${fbGw.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(fbGw.apiKey ? { Authorization: `Bearer ${fbGw.apiKey}` } : {}),
            },
            body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
          });

          if (res.ok) {
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content || "";
            const tokens = data.usage?.total_tokens || 0;
            this.healthChecker.recordRequest(fb.gatewayId, true, 0, tokens);
            this.totalRequests++;
            this.totalTokens += tokens;

            return {
              content,
              tokens,
              model: data.model || model,
              provider: fbGw.name,
              latencyMs: Date.now() - startTime,
            };
          }
        } catch { /* continue to next fallback */ }
      }

      throw err;
    }
  }

  async streamRequest(params: {
    model: string;
    messages: { role: string; content: string }[];
    maxTokens?: number;
    temperature?: number;
    onToken: (token: string) => void;
    onDone: () => void;
    onError: (error: string) => void;
  }) {
    const { model, messages, maxTokens, temperature, onToken, onDone, onError } = params;

    const decision = this.route(model);
    const gw = this.gateways.get(decision.gatewayId);
    if (!gw) {
      onError(`Gateway not found: ${decision.gatewayId}`);
      return;
    }

    try {
      const res = await fetch(`${gw.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(gw.apiKey ? { Authorization: `Bearer ${gw.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
          stream: true,
        }),
      });

      if (!res.ok) {
        onError(`Gateway ${gw.name} error ${res.status}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              this.healthChecker.recordRequest(decision.gatewayId, true, 0, 0);
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const token = parsed.choices?.[0]?.delta?.content;
              if (token) onToken(token);
            } catch { /* skip malformed */ }
          }
        }
      }

      this.healthChecker.recordRequest(decision.gatewayId, true, 0, 0);
      onDone();
    } catch (err) {
      this.healthChecker.recordRequest(decision.gatewayId, false, 0, 0);
      onError((err as Error).message || "Streaming failed");
    }
  }

  async checkHealth(gatewayId: string) {
    const gw = this.gateways.get(gatewayId);
    if (!gw) return "down" as const;
    return this.healthChecker.checkGateway(gw);
  }

  async getStatuses(): Promise<ProviderStatus[]> {
    return this.healthChecker.getAllStatuses(this.getAllGateways());
  }

  async getCacheStats(): Promise<CacheStats> {
    return this.cache.getStats();
  }

  async clearCache(pattern?: string) {
    this.cache.clear(pattern);
  }

  async getMetrics(): Promise<GatewayMetrics> {
    const statuses = await this.getStatuses();
    const cacheStats = this.cache.getStats();

    return {
      totalRequests: this.totalRequests,
      totalTokens: this.totalTokens,
      totalCostUSD: this.totalCostUSD,
      avgLatencyMs: this.totalRequests > 0 ? this.totalLatencyMs / this.totalRequests : 0,
      cacheHitRate: cacheStats.hitRate,
      circuitBreakerTrips: statuses.filter((s) => s.circuitState === "open").length,
      fallbackCount: this.fallbackCount,
      providers: statuses,
    };
  }

  // ── Persistence helpers ──

  exportConfig(): GatewayConfig[] {
    return this.getAllGateways();
  }

  importConfig(configs: GatewayConfig[]): void {
    for (const gw of configs) {
      this.gateways.set(gw.id, gw);
    }
  }
}
