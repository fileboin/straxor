import crypto from "crypto";
import type {
  UsageAdapter, UsageEvent, UsageAggregate, CostSummary,
  UsageBudget, BillingPeriod, ModelPricing,
} from "./adapter.js";
import { MODEL_PRICING, estimateCost as libEstimateCost } from "./pricing.js";

/**
 * OpenMeter adapter — sends usage events to OpenMeter API.
 * Falls back to in-memory storage for unsupported queries.
 * Docs: https://openmeter.io/docs
 */
export function createOpenMeterAdapter(config?: {
  baseUrl?: string;
  apiKey?: string;
}): UsageAdapter {
  const baseUrl = config?.baseUrl || process.env.OPENMETER_URL || "https://api.openmeter.io";
  const apiKey = config?.apiKey || process.env.OPENMETER_API_KEY || "";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  // Fallback in-memory for local reads
  const localEvents: UsageEvent[] = [];

  async function openMeterFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
    try {
      const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
      if (!res.ok) return null;
      return res.json() as Promise<T>;
    } catch {
      return null;
    }
  }

  return {
    async logEvent(raw) {
      const event: UsageEvent = { ...raw, id: crypto.randomUUID() };

      // Push to OpenMeter
      await openMeterFetch("/api/v1/meters/ingest", {
        method: "POST",
        body: JSON.stringify({
          event: {
            type: "ai.tokens",
            subject: `${raw.provider}/${raw.model}`,
            data: {
              userId: raw.userId,
              projectId: raw.projectId || "",
              provider: raw.provider,
              model: raw.model,
              inputTokens: raw.inputTokens,
              outputTokens: raw.outputTokens,
              totalTokens: raw.totalTokens,
              costUsd: raw.costUsd,
              latencyMs: raw.latencyMs || 0,
              success: raw.success,
            },
          },
        }),
      });

      localEvents.push(event);
      return event;
    },

    async getEvents({ from, to, provider, model, projectId, limit = 50, offset = 0 }) {
      let filtered = [...localEvents];
      if (from) filtered = filtered.filter((e) => e.timestamp >= from);
      if (to) filtered = filtered.filter((e) => e.timestamp <= to);
      if (provider) filtered = filtered.filter((e) => e.provider === provider);
      if (model) filtered = filtered.filter((e) => e.model === model);
      if (projectId) filtered = filtered.filter((e) => e.projectId === projectId);
      filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return filtered.slice(offset, offset + limit);
    },

    async getAggregate({ dimension, from, to, provider, model }) {
      let filtered = [...localEvents];
      if (from) filtered = filtered.filter((e) => e.timestamp >= from);
      if (to) filtered = filtered.filter((e) => e.timestamp <= to);
      if (provider) filtered = filtered.filter((e) => e.provider === provider);
      if (model) filtered = filtered.filter((e) => e.model === model);

      const groups = new Map<string, UsageEvent[]>();
      for (const e of filtered) {
        let key: string;
        switch (dimension) {
          case "provider": key = e.provider; break;
          case "model": key = `${e.provider}/${e.model}`; break;
          case "project": key = e.projectId || "unknown"; break;
          case "machine": key = e.machineId || "unknown"; break;
          case "day": key = e.timestamp.slice(0, 10); break;
          case "hour": key = e.timestamp.slice(0, 13); break;
          default: key = "unknown";
        }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(e);
      }

      const result: UsageAggregate[] = [];
      for (const [label, items] of groups) {
        const totalTokens = items.reduce((s, e) => s + e.totalTokens, 0);
        const inputTokens = items.reduce((s, e) => s + e.inputTokens, 0);
        const outputTokens = items.reduce((s, e) => s + e.outputTokens, 0);
        const totalCostUsd = items.reduce((s, e) => s + e.costUsd, 0);
        const latencies = items.filter((e) => e.latencyMs).map((e) => e.latencyMs!);
        const errors = items.filter((e) => !e.success).length;

        result.push({
          dimension,
          label,
          totalTokens, inputTokens, outputTokens, totalCostUsd,
          requestCount: items.length,
          avgLatencyMs: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
          errorRate: items.length > 0 ? errors / items.length : 0,
        });
      }

      result.sort((a, b) => b.totalCostUsd - a.totalCostUsd);
      return result;
    },

    async getCostSummary({ from, to }) {
      const now = new Date();
      const defaultFrom = from || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [byProvider, byModel, byProject, byDay] = await Promise.all([
        this.getAggregate({ dimension: "provider", from: defaultFrom, to }),
        this.getAggregate({ dimension: "model", from: defaultFrom, to }),
        this.getAggregate({ dimension: "project", from: defaultFrom, to }),
        this.getAggregate({ dimension: "day", from: defaultFrom, to }),
      ]);

      let filtered = [...localEvents];
      if (defaultFrom) filtered = filtered.filter((e) => e.timestamp >= defaultFrom);
      if (to) filtered = filtered.filter((e) => e.timestamp <= to);

      return {
        totalCostUsd: filtered.reduce((s, e) => s + e.costUsd, 0),
        totalTokens: filtered.reduce((s, e) => s + e.totalTokens, 0),
        totalRequests: filtered.length,
        period: { from: defaultFrom, to: to || now.toISOString() },
        byProvider, byModel, byProject, byDay,
      };
    },

    async listBudgets() { return []; },
    async createBudget(raw) {
      return { ...raw, id: crypto.randomUUID(), currentSpendUsd: 0, createdAt: new Date().toISOString() };
    },
    async deleteBudget() {},
    async listPeriods() { return []; },
    async getPricing() { return [...MODEL_PRICING]; },
    async estimateCost(provider, model, inputTokens, outputTokens) {
      return libEstimateCost(provider, model, inputTokens, outputTokens);
    },
  };
}
