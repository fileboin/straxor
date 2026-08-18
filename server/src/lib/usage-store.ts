// ── Usage analytics store (Phase 3) ──
// Persistent, per-user storage for the Usage & Cost dashboard. The default
// "custom" usage adapter was previously in-memory only, so all analytics were
// lost on every server restart. This module backs that adapter with real DB
// tables and exposes the pure aggregation/estimation helpers for tests.

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import { usageEvents, usageBudgets } from "../db/schema.js";
import { estimateCost } from "../adapters/usage/pricing.js";
import type { UsageAggregate, UsageEvent, UsageBudget } from "../adapters/usage/adapter.js";

export interface UsageEventInput {
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
  metadata?: Record<string, string>;
}

export interface UsageBudgetInput {
  name: string;
  monthlyLimitUsd: number;
  alertThresholdPercent?: number;
  isHardLimit?: boolean;
}

export interface UsageEventFilters {
  from?: string;
  to?: string;
  provider?: string;
  model?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}

// ── Pure helpers (unit-tested) ──

/** Very rough token estimate: ~4 chars/token. Good enough for dashboards. */
export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

/** Cost estimate via the model pricing table; 0 for unknown models. */
export function estimateUsageCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  try {
    return estimateCost(provider, model, inputTokens, outputTokens);
  } catch {
    return 0;
  }
}

/** Group raw events by a dimension (provider/model/project/machine/day/hour). */
export function aggregateUsageEvents(
  events: UsageEvent[],
  dimension: UsageAggregate["dimension"]
): UsageAggregate[] {
  const groups = new Map<string, UsageEvent[]>();
  for (const e of events) {
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
      totalTokens,
      inputTokens,
      outputTokens,
      totalCostUsd,
      requestCount: items.length,
      avgLatencyMs: latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
      errorRate: items.length > 0 ? errors / items.length : 0,
    });
  }

  result.sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  return result;
}

// ── DB access (best-effort: throws when the tables are not yet migrated) ──

function toEventRecord(row: typeof usageEvents.$inferSelect): UsageEvent {
  return {
    id: row.id,
    timestamp: row.timestamp.toISOString(),
    userId: row.userId,
    projectId: row.projectId ?? undefined,
    machineId: row.machineId ?? undefined,
    provider: row.provider,
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: row.totalTokens,
    costUsd: row.costUsd,
    latencyMs: row.latencyMs ?? undefined,
    success: row.success,
    errorMessage: row.errorMessage ?? undefined,
  };
}

function toBudgetRecord(row: typeof usageBudgets.$inferSelect): UsageBudget {
  return {
    id: row.id,
    name: row.name,
    monthlyLimitUsd: row.monthlyLimitUsd,
    currentSpendUsd: row.currentSpendUsd,
    alertThresholdPercent: row.alertThresholdPercent,
    isHardLimit: row.isHardLimit,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function insertUsageEvent(event: UsageEventInput): Promise<void> {
  await db.insert(usageEvents).values({
    userId: event.userId,
    timestamp: new Date(event.timestamp),
    projectId: event.projectId ?? null,
    machineId: event.machineId ?? null,
    provider: event.provider,
    model: event.model,
    inputTokens: event.inputTokens,
    outputTokens: event.outputTokens,
    totalTokens: event.totalTokens,
    costUsd: event.costUsd,
    latencyMs: event.latencyMs ?? null,
    success: event.success,
    errorMessage: event.errorMessage ?? null,
    metadata: event.metadata ?? null,
  });
}

export async function listUsageEvents(
  userId: string,
  filters: UsageEventFilters = {}
): Promise<UsageEvent[]> {
  const conditions = [eq(usageEvents.userId, userId)];
  if (filters.from) conditions.push(gte(usageEvents.timestamp, new Date(filters.from)));
  if (filters.to) conditions.push(lte(usageEvents.timestamp, new Date(filters.to)));
  if (filters.provider) conditions.push(eq(usageEvents.provider, filters.provider));
  if (filters.model) conditions.push(eq(usageEvents.model, filters.model));
  if (filters.projectId) conditions.push(eq(usageEvents.projectId, filters.projectId));

  const rows = await db
    .select()
    .from(usageEvents)
    .where(and(...conditions))
    .orderBy(desc(usageEvents.timestamp))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);
  return rows.map(toEventRecord);
}

export async function listUsageBudgets(userId: string): Promise<UsageBudget[]> {
  const rows = await db
    .select()
    .from(usageBudgets)
    .where(eq(usageBudgets.userId, userId))
    .orderBy(desc(usageBudgets.createdAt));
  return rows.map(toBudgetRecord);
}

export async function createUsageBudget(
  userId: string,
  input: UsageBudgetInput
): Promise<UsageBudget> {
  const [row] = await db
    .insert(usageBudgets)
    .values({
      userId,
      name: input.name,
      monthlyLimitUsd: input.monthlyLimitUsd,
      currentSpendUsd: 0,
      alertThresholdPercent: input.alertThresholdPercent ?? 80,
      isHardLimit: input.isHardLimit ?? false,
    })
    .returning();
  return toBudgetRecord(row);
}

export async function deleteUsageBudget(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(usageBudgets)
    .where(and(eq(usageBudgets.id, id), eq(usageBudgets.userId, userId)))
    .returning({ id: usageBudgets.id });
  return rows.length > 0;
}
