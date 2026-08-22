// ── OpenCode Model Injection ──
// Bridges STRAXOR's stored per-user API keys (user_api_keys, AES-encrypted)
// into the OpenCode engine spawn. OpenCode is spawned WITHOUT any model by
// default (only `serve --port`), so without this it has no AI backend.
//
// This module:
//   1. Reads the user's enabled provider keys from the DB (decrypted).
//   2. Picks the best available provider+model for coding.
//   3. Returns the env vars OpenCode reads (ANTHROPIC_API_KEY, etc.) plus an
//      OPENCODE_CONFIG_CONTENT JSONC string that pins provider + model.
//
// No raw key is ever logged or returned to the client.

import { getDirectProviderManager } from "../../adapters/direct-providers/manager.js";
import { listOllamaModels, pickOllamaCodingModel, ollamaOpenAiBaseUrl, OLLAMA_DEFAULT_BASE_URL } from "../../lib/ollama.js";

export interface OpenCodeModelConfig {
  env: Record<string, string>;
  configContent: string;
  provider: string;
  model: string;
  reason: string;
}

// provider_id (STRAXOR) -> OpenCode env var name
const PROVIDER_ENV: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  groq: "GROQ_API_KEY",
  xai: "XAI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  moonshot: "MOONSHOT_API_KEY",
  together: "TOGETHER_API_KEY",
  opencode: "OPENCODE_API_KEY",
  opencode_go: "OPENCODE_API_KEY",
  "opencode-zen": "OPENCODE_API_KEY",
  "opencode-go": "OPENCODE_API_KEY",
};

// The OpenCode Zen/Go hosted gateways are OpenAI-compatible and need an
// explicit baseURL — without it OpenCode builds "undefined/chat/completions".
const OPENCODE_GATEWAY_BASE_URL: Record<string, string> = {
  opencode: "https://opencode.ai/zen/v1",
  opencode_zen: "https://opencode.ai/zen/v1",
  opencode_go: "https://opencode.ai/zen/go/v1",
};

function opencodeGatewayBaseUrl(providerId: string): string {
  const normalized = providerId.replace(/-/g, "_");
  return (
    OPENCODE_GATEWAY_BASE_URL[normalized] ||
    OPENCODE_GATEWAY_BASE_URL[providerId] ||
    "https://opencode.ai/zen/v1"
  );
}

// Priority order for choosing which provider's key to feed OpenCode.
// OpenRouter first (can reach DeepSeek + everything), then native Anthropic.
const PROVIDER_PRIORITY = ["openrouter", "anthropic", "deepseek", "openai", "google"];

// Default model per provider (OpenCode composes model as provider_id/model).
const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  openrouter: "deepseek/deepseek-chat-v3-0324",
  anthropic: "claude-sonnet-4-5",
  deepseek: "deepseek-chat",
  openai: "gpt-4o",
  google: "gemini-2.5-pro",
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  opencode: "opencode/gpt-5.3-codex",
  opencode_go: "opencode_go/deepseek-v4-pro",
  "opencode-zen": "opencode/gpt-5.3-codex",
  "opencode-go": "opencode_go/deepseek-v4-pro",
};

// A deployment may supply a platform-owned key through the environment. This
// is useful for a single-tenant/self-hosted installation. Per-user encrypted
// keys always win; a platform key is only the fallback when the user has not
// saved a key in Straxor.
function environmentKey(providerId: string): string | null {
  const envVar = PROVIDER_ENV[providerId];
  const value = envVar ? process.env[envVar]?.trim() : undefined;
  return value || null;
}

export function openCodeModelConfig(
  availableProviders: Array<{ providerId: string; key: string | null }>,
  ollama?: { baseUrl: string; model: string } | null,
): OpenCodeModelConfig {
  // Ollama first: OpenCode talks DIRECTLY to the local Ollama HTTP API (no
  // FCC, no proxy, no cloud redirect). Ollama needs no API key.
  if (ollama?.model) {
    // OpenCode's ollama provider appends /chat/completions, so it needs the
    // OpenAI-compatible /v1 base URL (root 11434 would 404 on that path).
    const baseUrl = ollamaOpenAiBaseUrl(ollama.baseUrl);
    const configContent = JSON.stringify(
      {
        $schema: "https://opencode.ai/config.json",
        model: `ollama/${ollama.model}`,
        small_model: `ollama/${ollama.model}`,
        provider: {
          ollama: {
            options: { baseURL: baseUrl },
            models: { [ollama.model]: { name: ollama.model } },
          },
        },
      },
      null,
      2,
    );
    return {
      env: {},
      configContent,
      provider: "ollama",
      model: ollama.model,
      reason: `using local Ollama ${ollama.model} at ${baseUrl} (direct, no proxy)`,
    };
  }

  // A saved OpenCode gateway key (opencode-zen / opencode-go / opencode /
  // opencode_go) is an EXPLICIT user choice to bill through the OpenCode
  // gateway. It must win over cloud providers (openrouter priority #1) —
  // otherwise a stale/exhausted OpenRouter key silently overrides the key the
  // user just entered in the panel, and every turn fails with a 403.
  const gatewayProvider = availableProviders.find(
    (p) => p.key && /^(opencode|opencode-zen|opencode_go|opencode-go)$/.test(p.providerId)
  );
  const envGatewayKey = environmentKey("opencode");
  const gatewayKey = gatewayProvider?.key || envGatewayKey;
  if (gatewayKey) {
    const providerId = gatewayProvider?.providerId || "opencode";
    const [prefix, model] = (
      PROVIDER_DEFAULT_MODEL[providerId] || "opencode/gpt-5.3-codex"
    ).split("/");
    const configContent = JSON.stringify(
      {
        $schema: "https://opencode.ai/config.json",
        model: `${prefix}/${model}`,
        small_model: `${prefix}/${model}`,
        provider: {
          [prefix]: {
            options: {
              baseURL: opencodeGatewayBaseUrl(prefix),
              apiKey: "{env:OPENCODE_API_KEY}",
            },
            models: { [model]: { name: model } },
          },
        },
      },
      null,
      2,
    );
    return {
      env: { OPENCODE_API_KEY: gatewayKey },
      configContent,
      provider: prefix,
      model: `${prefix}/${model}`,
      reason: `using OpenCode gateway ${prefix}/${model} (saved key)`,
    };
  }

  const env: Record<string, string> = {};
  const set: { providerId: string; model: string }[] = [];

  for (const { providerId, key } of availableProviders) {
    const envVar = PROVIDER_ENV[providerId];
    if (!envVar) continue; // unknown provider -> skip
    const resolvedKey = key || environmentKey(providerId);
    if (resolvedKey) {
      env[envVar] = resolvedKey;
      set.push({ providerId, model: PROVIDER_DEFAULT_MODEL[providerId] || "" });
    }
  }

  // Choose the best provider by priority.
  let chosen: { providerId: string; model: string } | undefined;
  for (const pid of PROVIDER_PRIORITY) {
    const found = set.find((s) => s.providerId === pid);
    if (found) { chosen = found; break; }
  }
  if (!chosen) chosen = set[0];
  if (!chosen) {
    return {
      env: {},
      configContent: "{}",
      provider: "none",
      model: "none",
      reason: "No API keys configured — save a provider key to enable the OpenCode engine",
    };
  }

  // Built-in OpenCode providers need an explicit key reference in headless
  // mode. `{env:...}` keeps the real key out of config files and logs.
  const envVar = PROVIDER_ENV[chosen.providerId];
  const providerConfig: Record<string, unknown> = {
    [chosen.providerId]: {
      options: { apiKey: `{env:${envVar}}` },
      models: {
        [chosen.model]: { name: chosen.model },
      },
    },
  };

  const configContent = JSON.stringify(
    {
      $schema: "https://opencode.ai/config.json",
      model: `${chosen.providerId}/${chosen.model}`,
      small_model: `${chosen.providerId}/${chosen.model}`,
      provider: providerConfig,
    },
    null,
    2,
  );

  return {
    env,
    configContent,
    provider: chosen.providerId,
    model: chosen.model,
    reason: `using ${chosen.providerId}/${chosen.model}`,
  };
}

// Convenience: resolve the user's keys from the DB then build the config.
export async function buildOpenCodeModelConfig(
  userId: string,
): Promise<OpenCodeModelConfig> {
  // Prefer a reachable local Ollama instance (direct, keyless, no proxy). If
  // Ollama is down, fall back to the user's stored cloud provider keys.
  try {
    const models = await listOllamaModels(OLLAMA_DEFAULT_BASE_URL);
    const codingModel = pickOllamaCodingModel(models);
    if (codingModel) {
      return openCodeModelConfig([], { baseUrl: OLLAMA_DEFAULT_BASE_URL, model: codingModel });
    }
  } catch {
    // Ollama unreachable — continue to cloud providers below.
  }

  const manager = getDirectProviderManager();
  const providers = Object.keys(PROVIDER_ENV);
  const available: Array<{ providerId: string; key: string | null }> = [];
  for (const pid of providers) {
    try {
      const key = await manager.getKey(userId, pid);
      available.push({ providerId: pid, key });
    } catch {
      available.push({ providerId: pid, key: null });
    }
  }
  return openCodeModelConfig(available);
}

// Resolve a config that honors the model the user selected in the panel picker.
// `selected` is the catalog id, e.g. "opencode_go/deepseek-v4-pro",
// "opencode/gpt-5.3-codex", "deepseek/deepseek-chat" or a bare model id.
// When the selection is an OpenCode Zen/Go gateway model (opencode*, billed via
// OPENCODE_API_KEY) we pin the engine directly to it; otherwise fall back to
// the normal cloud-key resolution so every picker choice actually executes.
export async function buildOpenCodeModelConfigForSelection(
  userId: string,
  selected?: string | null,
): Promise<OpenCodeModelConfig> {
  const sel = (selected || "").trim();
  if (sel && /^(opencode|opencode_go)[/:]/.test(sel)) {
    // The gateway key can come from the deployment env (platform-wide) OR from
    // the user's own saved key (entered through the panel picker UI and stored
    // encrypted in user_api_keys under providerId "opencode-zen"/"opencode-go").
    // Both must work — a UI-entered key must never be ignored.
    const gatewayKey =
      process.env.OPENCODE_API_KEY?.trim() ||
      (await readOpenCodeGatewayKey(userId));
    if (gatewayKey) {
      const [prefix, model] = sel.includes("/") ? sel.split("/") : ["opencode", sel];
      const configContent = JSON.stringify(
        {
          $schema: "https://opencode.ai/config.json",
          model: sel,
          small_model: sel,
          provider: {
            [prefix]: {
              options: {
                baseURL: opencodeGatewayBaseUrl(prefix),
                apiKey: "{env:OPENCODE_API_KEY}",
              },
              models: { [model]: { name: model } },
            },
          },
        },
        null,
        2,
      );
      return {
        env: { OPENCODE_API_KEY: gatewayKey },
        configContent,
        provider: prefix,
        model: sel,
        reason: `using OpenCode gateway ${sel} (${prefix})`,
      };
    }
    // No gateway key anywhere — fall through to normal key resolution so the
    // panel still works (reports the actual provider used instead of hanging).
  }
  return buildOpenCodeModelConfig(userId);
}

// Read the user's saved OpenCode gateway key from user_api_keys. The UI stores
// it under providerId "opencode-zen" / "opencode-go"; accept either plus the
// raw "opencode" / "opencode_go" forms so no matter how it was entered it works.
async function readOpenCodeGatewayKey(userId: string): Promise<string> {
  const manager = getDirectProviderManager();
  for (const pid of ["opencode-zen", "opencode-go", "opencode", "opencode_go"]) {
    try {
      const key = await manager.getKey(userId, pid);
      if (key) return key;
    } catch {}
  }
  return "";
}
