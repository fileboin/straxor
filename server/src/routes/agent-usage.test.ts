import { describe, expect, it } from "vitest";
import { usageProviderForModel } from "./agent.js";

describe("usageProviderForModel", () => {
  it("maps OpenCode Go models to the opencode-go bucket", () => {
    expect(usageProviderForModel("opencode_go/deepseek-v4-pro")).toBe("opencode-go");
    expect(usageProviderForModel("opencode_go/gpt-5.3-codex")).toBe("opencode-go");
  });

  it("maps OpenCode Zen models to the opencode-zen bucket", () => {
    expect(usageProviderForModel("opencode/gpt-5.3-codex")).toBe("opencode-zen");
    expect(usageProviderForModel("opencode/deepseek-v4-flash-free")).toBe("opencode-zen");
  });

  it("falls back to opencode for anything else (machine ids, cloud models)", () => {
    expect(usageProviderForModel("local:opencode")).toBe("opencode");
    expect(usageProviderForModel("deepseek/deepseek-chat")).toBe("opencode");
    expect(usageProviderForModel(undefined)).toBe("opencode");
    expect(usageProviderForModel(null)).toBe("opencode");
  });
});