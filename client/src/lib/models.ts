import { api } from "./api.js";
import { useEffect, useState } from "react";

export type ProviderStatus = "ready" | "needs-setup";

// Model source — "cloud" uses a stored per-user API key (Together, OpenRouter,
// Anthropic, ...); "local" is keyless / engine-managed (Ollama, OpenCode Zen,
// custom local endpoint).
export type ModelSource = "cloud" | "local";

// Providers that work without an API key (e.g. local Ollama). The picker must
// not gate model selection on a stored key, and chat must not require one.
export const KEYLESS_PROVIDERS: ReadonlySet<string> = new Set(["ollama"]);

// Local / VPS model sources (no cloud key needed). Used for UI grouping and
// the header source badge.
export const LOCAL_SOURCE_PROVIDERS: ReadonlySet<string> = new Set(["ollama", "opencode-zen", "custom"]);

export function needsApiKey(providerId: string): boolean {
  return !KEYLESS_PROVIDERS.has(providerId);
}

export function isLocalSource(providerId: string): boolean {
  return LOCAL_SOURCE_PROVIDERS.has(providerId);
}

export interface Provider {
  id: string;
  name: string;
  status: ProviderStatus;
  models: Model[];
  source?: ModelSource;
}

export interface Model {
  id: string;
  name: string;
  thinking?: boolean;
  // Provider-specific shape of the thinking parameter. See server routes/models.ts.
  thinkingMode?: "always-on" | "adaptive" | "budget";
  free?: boolean;
  vision?: boolean;
}

export const PROVIDERS: Provider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    status: "ready",
    source: "cloud",
    models: [
      { id: "claude-fable-5", name: "Claude Fable 5", thinking: true, thinkingMode: "always-on", vision: true },
      { id: "claude-opus-5", name: "Claude Opus 5", thinking: true, thinkingMode: "adaptive", vision: true },
      { id: "claude-opus-4-8", name: "Claude Opus 4.8", thinking: true, thinkingMode: "adaptive", vision: true },
      { id: "claude-opus-4-7", name: "Claude Opus 4.7", thinking: true, thinkingMode: "adaptive", vision: true },
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", thinking: true, thinkingMode: "adaptive", vision: true },
      { id: "claude-sonnet-5", name: "Claude Sonnet 5", thinking: true, thinkingMode: "adaptive", vision: true },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", thinking: true, thinkingMode: "adaptive", vision: true },
      { id: "claude-opus-4-5", name: "Claude Opus 4.5", thinking: true, thinkingMode: "budget", vision: true },
      { id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5 (2025-11-01)", thinking: true, thinkingMode: "budget", vision: true },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", thinking: true, thinkingMode: "budget", vision: true },
      { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5 (2025-09-29)", thinking: true, thinkingMode: "budget", vision: true },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", thinking: true, thinkingMode: "budget", vision: true },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5 (2025-10-01)", thinking: true, thinkingMode: "budget", vision: true },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    status: "ready",
    source: "cloud",
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "o3", name: "o3", thinking: true },
      { id: "o4-mini", name: "o4-mini", thinking: true },
    ],
  },
  {
    id: "google",
    name: "Google Gemini",
    status: "ready",
    source: "cloud",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", thinking: true },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", thinking: true },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    status: "ready",
    source: "cloud",
    models: [
      { id: "deepseek-r1", name: "DeepSeek R1", thinking: true },
      { id: "deepseek-v3", name: "DeepSeek V3" },
      { id: "deepseek-coder", name: "DeepSeek Coder" },
    ],
  },
  {
    id: "opencode-zen",
    name: "OpenCode Zen",
    status: "ready",
    source: "local",
    models: [
      { id: "opencode/big-pickle", name: "Big Pickle", free: true },
      { id: "opencode/deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free", free: true },
      { id: "opencode/laguna-s-2.1-free", name: "Laguna S 2.1 Free", free: true },
      { id: "opencode/ling-3.0-flash-free", name: "Ling-3.0-flash Free", free: true },
      { id: "opencode/mimo-v2.5-free", name: "MiMo-V2.5 Free", free: true, vision: true },
      { id: "opencode/nemotron-3-ultra-free", name: "Nemotron 3 Ultra Free", free: true },
      { id: "opencode/north-mini-code-free", name: "North Mini Code Free", free: true },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    status: "needs-setup",
    source: "cloud",
    models: [
      { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick" },
      { id: "qwen/qwen3-235b-a22b", name: "Qwen3 235B" },
      { id: "mistralai/mistral-large", name: "Mistral Large" },
    ],
  },
  {
    id: "ollama",
    name: "Ollama",
    status: "needs-setup",
    source: "local",
    models: [
      { id: "llama3.1:70b", name: "Llama 3.1 70B" },
      { id: "codellama:34b", name: "CodeLlama 34B" },
      { id: "deepseek-r1:32b", name: "DeepSeek R1 32B" },
    ],
  },
  {
    id: "qwen",
    name: "Qwen",
    status: "needs-setup",
    source: "cloud",
    models: [
      { id: "qwen3-235b-a22b", name: "Qwen3 235B", thinking: true },
      { id: "qwen-turbo", name: "Qwen Turbo" },
      { id: "qwen-max", name: "Qwen Max" },
    ],
  },
  {
    id: "moonshot",
    name: "Moonshot Kimi",
    status: "needs-setup",
    source: "cloud",
    models: [
      { id: "kimi-k2", name: "Kimi K2" },
      { id: "moonshot-v1-128k", name: "Moonshot v1 128K" },
    ],
  },
  {
    id: "minimax",
    name: "MiniMax",
    status: "needs-setup",
    source: "cloud",
    models: [
      { id: "minimax-m1", name: "MiniMax M1" },
      { id: "abab6.5s", name: "ABAB 6.5S" },
    ],
  },
  {
    id: "together",
    name: "Together AI",
    status: "needs-setup",
    source: "cloud",
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", name: "Llama 3.3 70B Instruct" },
      { id: "meta-llama/Llama-3.1-405B-Instruct-Turbo", name: "Llama 3.1 405B Instruct" },
      { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", name: "Qwen2.5 72B Instruct" },
      { id: "Qwen/Qwen2.5-Coder-32B-Instruct", name: "Qwen2.5 Coder 32B Instruct" },
      { id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3" },
      { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1", thinking: true },
    ],
  },
  {
    id: "vertex",
    name: "Google Vertex AI",
    status: "needs-setup",
    source: "cloud",
    models: [
      { id: "gemini-2.5-pro-preview", name: "Gemini 2.5 Pro Preview" },
      { id: "gemini-2.0-flash-preview", name: "Gemini 2.0 Flash Preview" },
    ],
  },
  {
    id: "bedrock",
    name: "AWS Bedrock",
    status: "needs-setup",
    source: "cloud",
    models: [
      { id: "anthropic.claude-opus-4-6", name: "Claude Opus 4.6" },
      { id: "anthropic.claude-sonnet-4", name: "Claude Sonnet 4" },
      { id: "meta.llama3-70b", name: "Llama 3 70B" },
    ],
  },
  {
    id: "azure",
    name: "Azure OpenAI",
    status: "needs-setup",
    source: "cloud",
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    ],
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compat.)",
    status: "needs-setup",
    source: "local",
    models: [
      { id: "custom-model", name: "Custom Model" },
    ],
  },
];

export type ThinkingBudget = "off" | "low" | "medium" | "high";

export const THINKING_BUDGETS: { id: ThinkingBudget; label: string; desc: string }[] = [
  { id: "off", label: "Off", desc: "Bez reasoning-a" },
  { id: "low", label: "Low", desc: "Brzi odgovori" },
  { id: "medium", label: "Medium", desc: "Balansirano" },
  { id: "high", label: "High", desc: "Duboka analiza" },
];

// Fetch the full provider/model catalog from the server. Falls back to the
// static PROVIDERS list if the endpoint is unreachable or empty.
export async function fetchModelCatalog(): Promise<{ providers: Provider[] }> {
  try {
    const data = await api<{ providers: Provider[] }>("/models");
    if (Array.isArray(data.providers) && data.providers.length > 0) {
      return data;
    }
  } catch {}
  return { providers: PROVIDERS };
}

export function useModelCatalog() {
  const [providers, setProviders] = useState<Provider[]>(PROVIDERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchModelCatalog()
      .then((catalog) => {
        if (active) setProviders(catalog.providers);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { providers, loading };
}
