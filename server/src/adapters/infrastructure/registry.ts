import {
  getProvider,
  getProvidersByType,
  INFRA_PROVIDERS,
  type InfraConfig,
  type InfraType,
  type InfraProviderDef,
  type InfraHealthCheck,
} from "./types.js";

export interface InfrastructureRegistry {
  getProviders(): InfraProviderDef[];
  getProvidersByType(type: InfraType): InfraProviderDef[];
  getProvider(id: string): InfraProviderDef | undefined;
  healthCheck(config: InfraConfig): Promise<InfraHealthCheck>;
  deploy(config: InfraConfig): Promise<{ success: boolean; message: string }>;
  remove(config: InfraConfig): Promise<{ success: boolean; message: string }>;
}

export function createInfrastructureRegistry(): InfrastructureRegistry {
  return {
    getProviders: () => INFRA_PROVIDERS,
    getProvidersByType: (type) => getProvidersByType(type),
    getProvider: (id) => getProvider(id),

    async healthCheck(config) {
      const provider = getProvider(config.adapter);
      const now = new Date().toISOString();

      if (!provider) {
        return { id: config.id, configId: config.id, status: "unknown", latency: null, message: "Unknown provider", checkedAt: now };
      }

      if (provider.type === "monitor") {
        return runMonitorCheck(config);
      }

      // For non-monitor types, just ping the configured endpoint
      return runGenericHealthCheck(config, provider);
    },

    async deploy(config) {
      return { success: true, message: "Config saved — deploy your VPS to apply changes" };
    },

    async remove(config) {
      return { success: true, message: "Config removed" };
    },
  };
}

async function runMonitorCheck(config: InfraConfig): Promise<InfraHealthCheck> {
  const now = new Date().toISOString();
  const cfg = config.config as Record<string, any>;

  if (config.adapter === "http-monitor") {
    const url = cfg.url || "";
    const timeout = (cfg.timeout as number) || 10;
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout * 1000);
      const start = performance.now();
      const resp = await fetch(url, { method: "HEAD", signal: controller.signal });
      clearTimeout(id);
      const latency = Math.round(performance.now() - start);
      const expected = (cfg.expected_status as number) || 200;
      const ok = resp.status === expected;
      return {
        id: config.id,
        configId: config.id,
        status: ok ? "ok" : "degraded",
        latency,
        message: ok ? `HTTP ${resp.status}` : `Expected ${expected}, got ${resp.status}`,
        checkedAt: now,
      };
    } catch (err: any) {
      return { id: config.id, configId: config.id, status: "down", latency: null, message: err.message, checkedAt: now };
    }
  }

  if (config.adapter === "tcp-monitor") {
    // TCP check via fetch to the host:port is not directly possible from Node.js fetch
    // Return a simulated response — real implementation would use net.connect
    return {
      id: config.id,
      configId: config.id,
      status: "unknown",
      latency: null,
      message: "TCP check requires VPS-side execution",
      checkedAt: now,
    };
  }

  if (config.adapter === "ping-monitor") {
    return {
      id: config.id,
      configId: config.id,
      status: "unknown",
      latency: null,
      message: "Ping check requires VPS-side execution",
      checkedAt: now,
    };
  }

  return { id: config.id, configId: config.id, status: "unknown", latency: null, message: "Unknown monitor type", checkedAt: now };
}

async function runGenericHealthCheck(config: InfraConfig, provider: InfraProviderDef): Promise<InfraHealthCheck> {
  const now = new Date().toISOString();
  return {
    id: config.id,
    configId: config.id,
    status: "unknown",
    latency: null,
    message: `Health check for ${provider.name} — configure and test from UI`,
    checkedAt: now,
  };
}
