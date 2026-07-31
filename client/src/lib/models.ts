import { api } from "./api.js";
import { useEffect, useState } from "react";

export type ProviderStatus = "ready" | "needs-setup";

export interface Provider {
  id: string;
  name: string;
  status: ProviderStatus;
  models: Model[];
}

export interface Model {
  id: string;
  name: string;
  thinking?: boolean;
}

export const PROVIDERS: Provider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    status: "ready",
    models: [
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", thinking: true },
      { id: "claude-sonnet-4", name: "Claude Sonnet 4", thinking: true },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", thinking: true },
      { id: "claude-haiku-3-5", name: "Claude 3.5 Haiku" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    status: "ready",
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
    models: [
      { id: "deepseek-r1", name: "DeepSeek R1", thinking: true },
      { id: "deepseek-v3", name: "DeepSeek V3" },
      { id: "deepseek-coder", name: "DeepSeek Coder" },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    status: "needs-setup",
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
    models: [
      { id: "kimi-k2", name: "Kimi K2" },
      { id: "moonshot-v1-128k", name: "Moonshot v1 128K" },
    ],
  },
  {
    id: "minimax",
    name: "MiniMax",
    status: "needs-setup",
    models: [
      { id: "minimax-m1", name: "MiniMax M1" },
      { id: "abab6.5s", name: "ABAB 6.5S" },
    ],
  },
  {
    id: "vertex",
    name: "Google Vertex AI",
    status: "needs-setup",
    models: [
      { id: "gemini-2.5-pro-preview", name: "Gemini 2.5 Pro Preview" },
      { id: "gemini-2.0-flash-preview", name: "Gemini 2.0 Flash Preview" },
    ],
  },
  {
    id: "bedrock",
    name: "AWS Bedrock",
    status: "needs-setup",
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
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    ],
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compat.)",
    status: "needs-setup",
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
