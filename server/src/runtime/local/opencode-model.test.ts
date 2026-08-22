import { describe, expect, it, vi, beforeEach } from "vitest";
import { openCodeModelConfig, buildOpenCodeModelConfigForSelection } from "./opencode-model";

// The DB path (user-entered key stored in user_api_keys) must work for OpenCode
// gateway models. Mock the direct-provider manager so getKey returns a saved key
// for "opencode-go" without touching Postgres.
vi.mock("../../adapters/direct-providers/manager.js", () => {
  const saved: Record<string, string> = { "opencode-go": "db-saved-gateway-key" };
  return {
    getDirectProviderManager: () => ({
      async getKey(_userId: string, providerId: string): Promise<string | null> {
        return saved[providerId] ?? null;
      },
    }),
  };
});

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

  it("falls back to cloud-key resolution for non-gateway selections", async () => {
    const prev = process.env.OPENCODE_API_KEY;
    delete process.env.OPENCODE_API_KEY;
    try {
      // A cloud model id (not opencode*) goes through the normal key resolution.
      const result = await buildOpenCodeModelConfigForSelection(
        "user-x",
        "deepseek/deepseek-chat"
      );
      expect(["none", "openrouter", "anthropic", "deepseek", "opencode-go", "opencode-zen"]).toContain(result.provider);
    } finally {
      if (prev === undefined) delete process.env.OPENCODE_API_KEY;
      else process.env.OPENCODE_API_KEY = prev;
    }
  });

  it("uses the user's DB-saved gateway key when env is not set (UI-entered key)", async () => {
    const prev = process.env.OPENCODE_API_KEY;
    delete process.env.OPENCODE_API_KEY;
    try {
      const result = await buildOpenCodeModelConfigForSelection(
        "user-x",
        "opencode_go/deepseek-v4-pro"
      );
      // The mocked manager returns "db-saved-gateway-key" for providerId
      // "opencode-go" — the engine must pin to the gateway model with it.
      expect(result.provider).toBe("opencode_go");
      expect(result.model).toBe("opencode_go/deepseek-v4-pro");
      expect(result.env.OPENCODE_API_KEY).toBe("db-saved-gateway-key");
      expect(result.configContent).toContain('"model": "opencode_go/deepseek-v4-pro"');
    } finally {
      if (prev === undefined) delete process.env.OPENCODE_API_KEY;
      else process.env.OPENCODE_API_KEY = prev;
    }
  });
});
