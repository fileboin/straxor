import { describe, it, expect } from "vitest";
import { buildAnthropicBody } from "./http.js";

const messages = [{ role: "user" as const, content: "hi" }];

describe("buildAnthropicBody", () => {
  it("always streams — a non-streaming body yields no tokens to the SSE parser", () => {
    for (const model of ["claude-opus-5", "claude-fable-5", "claude-haiku-4-5"]) {
      expect(buildAnthropicBody(model, messages, "off").stream).toBe(true);
      expect(buildAnthropicBody(model, messages, "high").stream).toBe(true);
    }
  });

  it("uses adaptive thinking + effort on 4.6+ and the 5 family", () => {
    const body = buildAnthropicBody("claude-opus-5", messages, "high");
    expect(body.thinking).toEqual({ type: "adaptive", display: "summarized" });
    expect(body.output_config).toEqual({ effort: "high" });
  });

  it("never sends budget_tokens to models that reject it", () => {
    for (const model of [
      "claude-opus-5",
      "claude-opus-4-8",
      "claude-opus-4-7",
      "claude-opus-4-6",
      "claude-sonnet-5",
      "claude-sonnet-4-6",
    ]) {
      for (const level of ["low", "medium", "high"]) {
        const thinking = buildAnthropicBody(model, messages, level).thinking as Record<string, unknown>;
        expect(thinking.budget_tokens, `${model} @ ${level}`).toBeUndefined();
        expect(thinking.type).toBe("adaptive");
      }
    }
  });

  it("omits the thinking parameter entirely on always-on models", () => {
    for (const model of ["claude-fable-5", "claude-mythos-5"]) {
      expect(buildAnthropicBody(model, messages, "high").thinking).toBeUndefined();
      expect(buildAnthropicBody(model, messages, "off").thinking).toBeUndefined();
    }
  });

  it("disables thinking without raising effort above high", () => {
    const body = buildAnthropicBody("claude-opus-5", messages, "off");
    expect(body.thinking).toEqual({ type: "disabled" });
    // "disabled" is rejected at xhigh/max, so effort must stay unset (defaults to high).
    expect(body.output_config).toBeUndefined();
  });

  it("keeps budget_tokens below max_tokens on pre-4.6 models", () => {
    for (const model of ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5"]) {
      for (const level of ["low", "medium", "high"]) {
        const body = buildAnthropicBody(model, messages, level);
        const budget = (body.thinking as { budget_tokens: number }).budget_tokens;
        expect(budget, `${model} @ ${level}`).toBeGreaterThanOrEqual(1024);
        expect(budget).toBeLessThan(body.max_tokens as number);
      }
    }
  });

  it("recognises provider-prefixed ids (bedrock / openrouter)", () => {
    for (const model of ["anthropic.claude-opus-5", "anthropic/claude-opus-5"]) {
      const thinking = buildAnthropicBody(model, messages, "high").thinking as Record<string, unknown>;
      expect(thinking.type, model).toBe("adaptive");
    }
  });

  it("hoists system turns into the top-level system field", () => {
    const body = buildAnthropicBody("claude-opus-5", [
      { role: "system", content: "be terse" },
      { role: "user", content: "hi" },
    ]);
    expect(body.system).toBe("be terse");
    expect(body.messages).toHaveLength(1);
  });
});
