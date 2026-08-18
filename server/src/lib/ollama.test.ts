import { describe, expect, it } from "vitest";
import { pickOllamaCodingModel, OLLAMA_CODING_MODEL_PREFERENCE, type OllamaModel } from "./ollama.js";
import { openCodeModelConfig } from "../runtime/local/opencode-model.js";

describe("pickOllamaCodingModel", () => {
  it("prefers a coder model from the live tag list", () => {
    const models: OllamaModel[] = [
      { name: "llama3.1:8b" },
      { name: "deepseek-coder:6.7b" },
      { name: "qwen-coder:7b" },
    ];
    expect(pickOllamaCodingModel(models)).toBe("deepseek-coder:6.7b");
  });

  it("falls back to the first non-embed model when no coder exists", () => {
    const models: OllamaModel[] = [
      { name: "nomic-embed-text" },
      { name: "mistral:7b" },
    ];
    expect(pickOllamaCodingModel(models)).toBe("mistral:7b");
  });

  it("returns null for an empty list", () => {
    expect(pickOllamaCodingModel([])).toBeNull();
  });

  it("keeps the coding preference order stable", () => {
    expect(OLLAMA_CODING_MODEL_PREFERENCE[0]).toBe("deepseek-coder");
    expect(OLLAMA_CODING_MODEL_PREFERENCE).toContain("qwen-coder");
  });
});

describe("openCodeModelConfig → Ollama", () => {
  it("pins OpenCode directly to local Ollama with no API key and no proxy", () => {
    const result = openCodeModelConfig([], { baseUrl: "http://localhost:11434", model: "qwen-coder:7b" });

    expect(result.provider).toBe("ollama");
    expect(result.model).toBe("qwen-coder:7b");
    expect(result.env).toEqual({});
    expect(result.configContent).toContain('"model": "ollama/qwen-coder:7b"');
    expect(result.configContent).toContain('"baseURL": "http://localhost:11434"');
    expect(result.configContent).not.toContain("FCC");
    expect(result.configContent).not.toContain("proxy");
  });

  it("still falls back to cloud providers when no Ollama model is given", () => {
    const result = openCodeModelConfig(
      [{ providerId: "anthropic", key: "k" }],
      null,
    );
    expect(result.provider).toBe("anthropic");
  });
});
