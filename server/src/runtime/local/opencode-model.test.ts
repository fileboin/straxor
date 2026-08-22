import { describe, expect, it } from "vitest";
import { openCodeModelConfig, buildOpenCodeModelConfigForSelection } from "./opencode-model";

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

describe("buildOpenCodeModelConfigForSelection", () => {
  it("pins the engine directly to an OpenCode Go model via OPENCODE_API_KEY", async () => {
    const prev = process.env.OPENCODE_API_KEY;
    process.env.OPENCODE_API_KEY = "oc-gateway-secret";
    try {
      const result = await buildOpenCodeModelConfigForSelection(
        "user-x",
        "opencode_go/deepseek-v4-pro"
      );
      expect(result.provider).toBe("opencode_go");
      expect(result.model).toBe("opencode_go/deepseek-v4-pro");
      expect(result.env.OPENCODE_API_KEY).toBe("oc-gateway-secret");
      expect(result.configContent).toContain('"model": "opencode_go/deepseek-v4-pro"');
      expect(result.configContent).not.toContain("oc-gateway-secret");
    } finally {
      if (prev === undefined) delete process.env.OPENCODE_API_KEY;
      else process.env.OPENCODE_API_KEY = prev;
    }
  });

  it("pins an OpenCode Zen model via the gateway key", async () => {
    const prev = process.env.OPENCODE_API_KEY;
    process.env.OPENCODE_API_KEY = "oc-gateway-secret";
    try {
      const result = await buildOpenCodeModelConfigForSelection(
        "user-x",
        "opencode/gpt-5.3-codex"
      );
      expect(result.provider).toBe("opencode");
      expect(result.model).toBe("opencode/gpt-5.3-codex");
    } finally {
      if (prev === undefined) delete process.env.OPENCODE_API_KEY;
      else process.env.OPENCODE_API_KEY = prev;
    }
  });

  it("falls back to cloud-key resolution when no gateway key is set", async () => {
    const prev = process.env.OPENCODE_API_KEY;
    delete process.env.OPENCODE_API_KEY;
    try {
      const result = await buildOpenCodeModelConfigForSelection(
        "user-x",
        "opencode_go/deepseek-v4-pro"
      );
      // Without a gateway key and with no stored cloud keys, it degrades to
      // "none" instead of throwing — the panel reports the real state.
      expect(["none", "openrouter", "anthropic", "deepseek"]).toContain(result.provider);
    } finally {
      if (prev === undefined) delete process.env.OPENCODE_API_KEY;
      else process.env.OPENCODE_API_KEY = prev;
    }
  });
});
