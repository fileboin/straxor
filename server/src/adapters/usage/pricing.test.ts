import { describe, it, expect } from "vitest";
import { getPricingForModel, estimateCost } from "./pricing.js";

describe("OpenCode Zen / Go pricing", () => {
  it("Zen paid modeli imaju cijenu po tokenu", () => {
    const p = getPricingForModel("opencode-zen", "opencode/gpt-5.3-codex");
    expect(p).toBeDefined();
    expect(p!.inputCostPer1M).toBeGreaterThan(0);
    expect(p!.outputCostPer1M).toBeGreaterThan(0);
  });

  it("Go modeli imaju cijenu po tokenu", () => {
    const p = getPricingForModel("opencode-go", "opencode_go/minimax-m2.7");
    expect(p).toBeDefined();
    expect(p!.inputCostPer1M).toBeGreaterThan(0);
  });

  it("nepoznati OpenCode model vraća 0 troška (best-effort)", () => {
    expect(estimateCost("opencode-zen", "opencode/unknown-model", 1000, 1000)).toBe(0);
  });

  it("estimateCost koristi input+output cijenu", () => {
    // 1M input @ $3 + 1M output @ $12 => $15
    const cost = estimateCost("opencode-zen", "opencode/gpt-5.3-codex", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(15, 5);
  });
});
