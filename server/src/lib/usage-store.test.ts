import { describe, it, expect } from "vitest";
import type { UsageEvent } from "../adapters/usage/adapter.js";
import {
  estimateTokenCount,
  estimateUsageCost,
  aggregateUsageEvents,
} from "./usage-store.js";

function ev(partial: Partial<UsageEvent>): UsageEvent {
  return {
    id: partial.id ?? "1",
    timestamp: partial.timestamp ?? "2026-08-18T10:00:00.000Z",
    userId: "u1",
    provider: "anthropic",
    model: "claude-opus-4-6",
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    success: true,
    ...partial,
  };
}

describe("estimateTokenCount", () => {
  it("returns at least 1 token for empty/whitespace text", () => {
    expect(estimateTokenCount("")).toBe(1);
    expect(estimateTokenCount("   ")).toBe(1);
  });

  it("estimates ~4 chars per token", () => {
    expect(estimateTokenCount("12345678")).toBe(2);
    expect(estimateTokenCount("1234")).toBe(1);
  });
});

describe("estimateUsageCost", () => {
  it("returns 0 for unknown models", () => {
    expect(estimateUsageCost("anthropic", "does-not-exist", 1_000_000, 1_000_000)).toBe(0);
  });

  it("computes cost from the pricing table", () => {
    // claude-opus-4-6: $15/M in, $75/M out.
    expect(estimateUsageCost("anthropic", "claude-opus-4-6", 1_000_000, 1_000_000)).toBeCloseTo(90);
  });
});

describe("aggregateUsageEvents", () => {
  const events = [
    ev({ id: "a", provider: "anthropic", model: "claude-opus-4-6", timestamp: "2026-08-18T10:00:00.000Z", totalTokens: 100, inputTokens: 60, outputTokens: 40, costUsd: 1.5, success: true, latencyMs: 200 }),
    ev({ id: "b", provider: "anthropic", model: "claude-opus-4-6", timestamp: "2026-08-18T11:00:00.000Z", totalTokens: 300, inputTokens: 180, outputTokens: 120, costUsd: 3.5, success: false, latencyMs: 400 }),
    ev({ id: "c", provider: "openai", model: "gpt-4o", timestamp: "2026-08-18T10:30:00.000Z", totalTokens: 50, inputTokens: 20, outputTokens: 30, costUsd: 0.5, success: true }),
    ev({ id: "d", provider: "openai", model: "gpt-4o", timestamp: "2026-08-19T09:00:00.000Z", totalTokens: 50, inputTokens: 20, outputTokens: 30, costUsd: 0.5, success: true }),
  ];

  it("groups and sums by provider", () => {
    const byProvider = aggregateUsageEvents(events, "provider");
    const anthropic = byProvider.find((a) => a.label === "anthropic")!;
    const openai = byProvider.find((a) => a.label === "openai")!;
    expect(anthropic.totalTokens).toBe(400);
    expect(anthropic.totalCostUsd).toBeCloseTo(5);
    expect(anthropic.requestCount).toBe(2);
    expect(anthropic.avgLatencyMs).toBe(300);
    expect(anthropic.errorRate).toBeCloseTo(0.5);
    expect(openai.totalTokens).toBe(100);
    expect(openai.requestCount).toBe(2);
  });

  it("groups by model with provider/model composite label", () => {
    const byModel = aggregateUsageEvents(events, "model");
    expect(byModel.find((a) => a.label === "anthropic/claude-opus-4-6")).toBeTruthy();
    expect(byModel.find((a) => a.label === "openai/gpt-4o")).toBeTruthy();
  });

  it("groups by day and sorts by cost descending", () => {
    const byDay = aggregateUsageEvents(events, "day");
    expect(byDay.length).toBe(2);
    expect(byDay[0].label).toBe("2026-08-18");
    expect(byDay[0].totalCostUsd).toBeCloseTo(5.5);
    expect(byDay[1].label).toBe("2026-08-19");
  });
});
