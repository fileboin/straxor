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
};

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
): OpenCodeModelConfig {
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
