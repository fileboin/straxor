import type { GatewayConfig, ProviderHealth, ProviderStatus, CircuitState } from "./adapter.js";
import { CircuitBreaker } from "./circuit-breaker.js";

interface HealthRecord {
  health: ProviderHealth;
  latencyMs: number;
  errorRate: number;
  totalRequests: number;
  failedRequests: number;
  lastChecked: string;
  lastError?: string;
  monthlyCost: number;
  monthlyRequests: number;
}

export class HealthChecker {
  private records: Map<string, HealthRecord> = new Map();
  private circuitBreaker: CircuitBreaker;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(circuitBreaker: CircuitBreaker) {
    this.circuitBreaker = circuitBreaker;
  }

  startMonitoring(gateways: GatewayConfig[], intervalMs = 60000): void {
    this.stopMonitoring();

    // Initial check
    for (const gw of gateways) {
      if (gw.isEnabled) this.checkGateway(gw);
    }

    // Periodic checks
    this.checkInterval = setInterval(() => {
      for (const gw of gateways) {
        if (gw.isEnabled) this.checkGateway(gw);
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async checkGateway(gateway: GatewayConfig): Promise<ProviderHealth> {
    const start = Date.now();
    let health: ProviderHealth = "healthy";
    let lastError: string | undefined;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${gateway.baseUrl}/health`, {
        headers: gateway.apiKey ? { Authorization: `Bearer ${gateway.apiKey}` } : {},
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        health = "degraded";
        lastError = `HTTP ${res.status}`;
      }
    } catch (err) {
      health = "down";
      lastError = (err as Error).message || "Connection failed";
    }

    const latencyMs = Date.now() - start;
    const existing = this.records.get(gateway.id);

    this.records.set(gateway.id, {
      health,
      latencyMs,
      errorRate: existing ? (existing.errorRate * 0.9 + (health !== "healthy" ? 0.1 : 0)) : 0,
      totalRequests: existing?.totalRequests || 0,
      failedRequests: existing?.failedRequests || 0,
      lastChecked: new Date().toISOString(),
      lastError,
      monthlyCost: existing?.monthlyCost || 0,
      monthlyRequests: existing?.monthlyRequests || 0,
    });

    return health;
  }

  recordRequest(gatewayId: string, success: boolean, costUSD: number, tokens: number): void {
    const record = this.getRecord(gatewayId);
    record.totalRequests++;
    record.monthlyRequests++;
    record.monthlyCost += costUSD;

    if (!success) {
      record.failedRequests++;
      this.circuitBreaker.recordFailure(gatewayId);
    } else {
      this.circuitBreaker.recordSuccess(gatewayId);
    }

    record.errorRate = record.failedRequests / record.totalRequests;
  }

  getRecord(gatewayId: string): HealthRecord {
    if (!this.records.has(gatewayId)) {
      this.records.set(gatewayId, {
        health: "unknown",
        latencyMs: 0,
        errorRate: 0,
        totalRequests: 0,
        failedRequests: 0,
        lastChecked: new Date().toISOString(),
        monthlyCost: 0,
        monthlyRequests: 0,
      });
    }
    return this.records.get(gatewayId)!;
  }

  getStatus(gatewayId: string, gateway: GatewayConfig): ProviderStatus {
    const record = this.getRecord(gatewayId);
    const circuitState = this.circuitBreaker.getState(gatewayId);

    return {
      gatewayId,
      gatewayName: gateway.name,
      gatewayType: gateway.type,
      health: record.health,
      latencyMs: record.latencyMs,
      errorRate: record.errorRate,
      totalRequests: record.totalRequests,
      failedRequests: record.failedRequests,
      lastChecked: record.lastChecked,
      lastError: record.lastError,
      circuitState,
      monthlyCost: record.monthlyCost,
      monthlyRequests: record.monthlyRequests,
    };
  }

  getAllStatuses(gateways: GatewayConfig[]): ProviderStatus[] {
    return gateways.map((gw) => this.getStatus(gw.id, gw));
  }

  resetGateway(gatewayId: string): void {
    this.circuitBreaker.reset(gatewayId);
    this.records.delete(gatewayId);
  }
}
