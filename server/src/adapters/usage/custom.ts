import crypto from "crypto";
import type {
  UsageAdapter, UsageEvent, UsageAggregate, CostSummary,
  UsageBudget, BillingPeriod, ModelPricing,
} from "./adapter.js";
import { MODEL_PRICING, estimateCost as libEstimateCost } from "./pricing.js";
import {
  aggregateUsageEvents,
  insertUsageEvent,
  listUsageEvents,
  listUsageBudgets,
  createUsageBudget,
  deleteUsageBudget,
} from "../../lib/usage-store.js";

const MAX_AGGREGATE_ROWS = 100_000;

/**
 * Custom (local) usage tracker — DB-backed, per-user.
 *
 * Events and budgets persist in `usage_events` / `usage_budgets` so the
 * Usage & Cost dashboard survives server restarts. If the tables have not been
 * migrated yet (or the DB is temporarily down), reads degrade to empty results
 * and writes are ignored — the adapter never throws into the HTTP layer.
 */
export function createCustomUsageAdapter(userId?: string): UsageAdapter {
  // In-memory fallback for unmigrated/offline environments.
  const localEvents: UsageEvent[] = [];
  const localBudgets: UsageBudget[] = [];

  async function readEvents(params: {
    from?: string;
    to?: string;
    provider?: string;
    model?: string;
    projectId?: string;
    limit?: number;
    offset?: number;
  }): Promise<UsageEvent[]> {
    if (!userId) return [];
    try {
      return await listUsageEvents(userId, params);
    } catch {
      let filtered = [...localEvents];
      if (params.from) filtered = filtered.filter((e) => e.timestamp >= params.from!);
      if (params.to) filtered = filtered.filter((e) => e.timestamp <= params.to!);
      if (params.provider) filtered = filtered.filter((e) => e.provider === params.provider);
      if (params.model) filtered = filtered.filter((e) => e.model === params.model);
      if (params.projectId) filtered = filtered.filter((e) => e.projectId === params.projectId);
      filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return filtered.slice(params.offset || 0, (params.offset || 0) + (params.limit || 50));
    }
  }

  return {
    async logEvent(raw) {
      const event: UsageEvent = { ...raw, id: crypto.randomUUID() };
      if (userId) {
        try {
          await insertUsageEvent({
            timestamp: event.timestamp,
            userId,
            projectId: event.projectId,
            machineId: event.machineId,
            provider: event.provider,
            model: event.model,
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            totalTokens: event.totalTokens,
            costUsd: event.costUsd,
            latencyMs: event.latencyMs,
            success: event.success,
            errorMessage: event.errorMessage,
            metadata: event.metadata,
          });
        } catch {
          localEvents.push(event);
        }
      } else {
        localEvents.push(event);
      }
      return event;
    },

    async getEvents(params) {
      return readEvents(params);
    },

    async getAggregate({ dimension, from, to, provider, model }) {
      const events = await readEvents({ from, to, provider, model, limit: MAX_AGGREGATE_ROWS });
      return aggregateUsageEvents(events, dimension);
    },

    async getCostSummary({ from, to }) {
      const now = new Date();
      const defaultFrom = from || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const events = await readEvents({ from: defaultFrom, to, limit: MAX_AGGREGATE_ROWS });

      return {
        totalCostUsd: events.reduce((s, e) => s + e.costUsd, 0),
        totalTokens: events.reduce((s, e) => s + e.totalTokens, 0),
        totalRequests: events.length,
        period: { from: defaultFrom, to: to || now.toISOString() },
        byProvider: aggregateUsageEvents(events, "provider"),
        byModel: aggregateUsageEvents(events, "model"),
        byProject: aggregateUsageEvents(events, "project"),
        byDay: aggregateUsageEvents(events, "day"),
      } satisfies CostSummary;
    },

    async listBudgets() {
      if (!userId) return [...localBudgets];
      try {
        return await listUsageBudgets(userId);
      } catch {
        return [...localBudgets];
      }
    },

    async createBudget(raw) {
      if (userId) {
        try {
          return await createUsageBudget(userId, raw);
        } catch {
          // fall through to in-memory
        }
      }
      const budget: UsageBudget = {
        ...raw,
        id: crypto.randomUUID(),
        currentSpendUsd: 0,
        createdAt: new Date().toISOString(),
      };
      localBudgets.push(budget);
      return budget;
    },

    async deleteBudget(id) {
      if (userId) {
        try {
          await deleteUsageBudget(userId, id);
          return;
        } catch {
          // fall through
        }
      }
      const idx = localBudgets.findIndex((b) => b.id === id);
      if (idx >= 0) localBudgets.splice(idx, 1);
    },

    async listPeriods() {
      return [] as BillingPeriod[];
    },

    async getPricing() {
      return [...MODEL_PRICING];
    },

    async estimateCost(provider, model, inputTokens, outputTokens) {
      return libEstimateCost(provider, model, inputTokens, outputTokens);
    },
  };
}
