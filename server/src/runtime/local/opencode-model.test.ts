import { describe, expect, it } from "vitest";
import { openCodeModelConfig } from "./opencode-model";

describe("openCodeModelConfig", () => {
  it("injects OpenRouter's key reference and pins DeepSeek V3", () => {
    const result = openCodeModelConfig([
      { providerId: "openrouter", key: "secret-not-in-config" },
    ]);

    expect(result.provider).toBe("openrouter");
    expect(result.model).toBe("deepseek/deepseek-chat-v3-0324");
    expect(result.env.OPENROUTER_API_KEY).toBe("secret-not-in-config");
    expect(result.configContent).toContain('"apiKey": "{env:OPENROUTER_API_KEY}"');
    expect(result.configContent).toContain('"small_model": "openrouter/deepseek/deepseek-chat-v3-0324"');
    expect(result.configContent).not.toContain("secret-not-in-config");
  });

  it("selects the configured provider priority and reports a missing key", () => {
    expect(
      openCodeModelConfig([
        { providerId: "anthropic", key: "anthropic-key" },
        { providerId: "deepseek", key: "deepseek-key" },
      ]).provider,
    ).toBe("anthropic");

    expect(openCodeModelConfig([]).provider).toBe("none");
  });
});
