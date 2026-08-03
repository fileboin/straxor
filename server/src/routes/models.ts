import { Router } from "express";

const router = Router();

export interface CatalogModel {
  id: string;
  name: string;
  thinking?: boolean;
  free?: boolean;
  vision?: boolean;
}

export interface CatalogProvider {
  id: string;
  name: string;
  status: string;
  models: CatalogModel[];
}

const ANTHROPIC_MODELS: CatalogModel[] = [
  { id: "claude-fable-5", name: "Claude Fable 5", thinking: true },
  { id: "claude-mythos-5", name: "Claude Mythos 5", thinking: true },
  { id: "claude-opus-5", name: "Claude Opus 5", thinking: true },
  { id: "claude-sonnet-5", name: "Claude Sonnet 5", thinking: true },
  { id: "claude-opus-4-8", name: "Claude Opus 4.8", thinking: true },
  { id: "claude-opus-4-7", name: "Claude Opus 4.7", thinking: true },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", thinking: true },
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", thinking: true },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", thinking: true },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5 (2025-10-01)", thinking: true },
  { id: "claude-opus-4-5", name: "Claude Opus 4.5", thinking: true },
  { id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5 (2025-11-01)", thinking: true },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", thinking: true },
  { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5 (2025-09-29)", thinking: true },
  { id: "claude-opus-4-1", name: "Claude Opus 4.1", thinking: true },
  { id: "claude-opus-4-1-20250805", name: "Claude Opus 4.1 (2025-08-05)", thinking: true },
  { id: "claude-opus-4", name: "Claude Opus 4", thinking: true },
  { id: "claude-opus-4-20250514", name: "Claude Opus 4 (2025-05-14)", thinking: true },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", thinking: true },
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4 (2025-05-14)", thinking: true },
  { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", thinking: true },
  { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet (2025-02-19)", thinking: true },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", thinking: true },
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (2024-10-22)", thinking: true },
  { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku" },
  { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku (2024-10-22)" },
  { id: "claude-3-opus", name: "Claude 3 Opus" },
  { id: "claude-3-opus-20240229", name: "Claude 3 Opus (2024-02-29)" },
  { id: "claude-3-sonnet", name: "Claude 3 Sonnet" },
  { id: "claude-3-haiku", name: "Claude 3 Haiku" },
];

const OPENAI_MODELS: CatalogModel[] = [
  { id: "gpt-5.6", name: "GPT-5.6 Sol", thinking: true },
  { id: "gpt-5.6-terra", name: "GPT-5.6 Terra", thinking: true },
  { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", thinking: true },
  { id: "gpt-5.5", name: "GPT-5.5", thinking: true },
  { id: "gpt-5.4", name: "GPT-5.4", thinking: true },
  { id: "gpt-5.4-mini", name: "GPT-5.4 Mini", thinking: true },
  { id: "gpt-5.4-nano", name: "GPT-5.4 Nano" },
  { id: "gpt-5.3-codex", name: "GPT-5.3 Codex", thinking: true },
  { id: "gpt-5.2", name: "GPT-5.2", thinking: true },
  { id: "gpt-5.2-codex", name: "GPT-5.2 Codex", thinking: true },
  { id: "gpt-5.1", name: "GPT-5.1", thinking: true },
  { id: "gpt-5.1-mini", name: "GPT-5.1 Mini", thinking: true },
  { id: "gpt-5.1-nano", name: "GPT-5.1 Nano" },
  { id: "gpt-5", name: "GPT-5", thinking: true },
  { id: "gpt-5-mini", name: "GPT-5 Mini", thinking: true },
  { id: "gpt-5-nano", name: "GPT-5 Nano" },
  { id: "gpt-5-codex", name: "GPT-5 Codex", thinking: true },
  { id: "gpt-4.1", name: "GPT-4.1", thinking: true },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano" },
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "o3", name: "o3", thinking: true },
  { id: "o3-pro", name: "o3 Pro", thinking: true },
  { id: "o3-mini", name: "o3 Mini", thinking: true },
  { id: "o4-mini", name: "o4 Mini", thinking: true },
  { id: "o1", name: "o1", thinking: true },
  { id: "o1-mini", name: "o1 Mini", thinking: true },
];

const GEMINI_MODELS: CatalogModel[] = [
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", thinking: true },
  { id: "gemini-3.1-pro", name: "Gemini 3.1 Pro", thinking: true },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (preview)", thinking: true },
  { id: "gemini-3.1-flash", name: "Gemini 3.1 Flash", thinking: true },
  { id: "gemini-3.1-flash-preview", name: "Gemini 3.1 Flash (preview)", thinking: true },
  { id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite" },
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash-Lite (preview)" },
  { id: "gemini-3-pro", name: "Gemini 3 Pro", thinking: true },
  { id: "gemini-3-flash", name: "Gemini 3 Flash", thinking: true },
  { id: "gemini-3-flash-lite", name: "Gemini 3 Flash-Lite" },
  { id: "gemini-3-deep-think", name: "Gemini 3 Deep Think", thinking: true },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", thinking: true },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", thinking: true },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite" },
  { id: "gemini-2.5-flash-image", name: "Gemini 2.5 Flash Image" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
];

const DEEPSEEK_MODELS: CatalogModel[] = [
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", thinking: true },
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", thinking: true },
];

// OpenCode Zen — free OpenAI-compatible models (base: https://opencode.ai/zen/v1).
// Model IDs follow the `opencode/<id>` convention used by OpenCode configs.
// MiMo-V2.5 is multimodal (vision); flagged so the UI can gate image uploads.
const OPENCODE_ZEN_MODELS: CatalogModel[] = [
  { id: "opencode/big-pickle", name: "Big Pickle", free: true },
  { id: "opencode/deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free", free: true },
  { id: "opencode/laguna-s-2.1-free", name: "Laguna S 2.1 Free", free: true },
  { id: "opencode/ling-3.0-flash-free", name: "Ling-3.0-flash Free", free: true },
  { id: "opencode/mimo-v2.5-free", name: "MiMo-V2.5 Free", free: true, vision: true },
  { id: "opencode/nemotron-3-ultra-free", name: "Nemotron 3 Ultra Free", free: true },
  { id: "opencode/north-mini-code-free", name: "North Mini Code Free", free: true },
];

const OLLAMA_MODELS: CatalogModel[] = [
  { id: "llama3.3:70b", name: "Llama 3.3 70B" },
  { id: "llama3.2:3b", name: "Llama 3.2 3B" },
  { id: "llama3.2:1b", name: "Llama 3.2 1B" },
  { id: "llama3.1:405b", name: "Llama 3.1 405B" },
  { id: "llama3.1:70b", name: "Llama 3.1 70B" },
  { id: "llama3.1:8b", name: "Llama 3.1 8B" },
  { id: "llama3:8b", name: "Llama 3 8B" },
  { id: "codellama:34b", name: "CodeLlama 34B" },
  { id: "codellama:13b", name: "CodeLlama 13B" },
  { id: "codellama:7b", name: "CodeLlama 7B" },
  { id: "deepseek-r1:70b", name: "DeepSeek R1 70B", thinking: true },
  { id: "deepseek-r1:32b", name: "DeepSeek R1 32B", thinking: true },
  { id: "deepseek-r1:14b", name: "DeepSeek R1 14B", thinking: true },
  { id: "deepseek-r1:8b", name: "DeepSeek R1 8B", thinking: true },
  { id: "deepseek-r1:7b", name: "DeepSeek R1 7B", thinking: true },
  { id: "deepseek-r1:1.5b", name: "DeepSeek R1 1.5B", thinking: true },
  { id: "deepseek-v3:671b", name: "DeepSeek V3 671B", thinking: true },
  { id: "qwen3:32b", name: "Qwen3 32B", thinking: true },
  { id: "qwen3:14b", name: "Qwen3 14B", thinking: true },
  { id: "qwen3:8b", name: "Qwen3 8B", thinking: true },
  { id: "qwen3:4b", name: "Qwen3 4B", thinking: true },
  { id: "qwen3:1.7b", name: "Qwen3 1.7B", thinking: true },
  { id: "qwen2.5-coder:32b", name: "Qwen2.5 Coder 32B" },
  { id: "qwen2.5-coder:14b", name: "Qwen2.5 Coder 14B" },
  { id: "qwen2.5-coder:7b", name: "Qwen2.5 Coder 7B" },
  { id: "qwen2.5:7b", name: "Qwen2.5 7B" },
  { id: "phi4:14b", name: "Phi-4 14B" },
  { id: "phi3:mini", name: "Phi-3 Mini" },
  { id: "mistral:7b", name: "Mistral 7B" },
  { id: "mixtral:8x7b", name: "Mixtral 8x7B" },
  { id: "gemma3:12b", name: "Gemma 3 12B" },
  { id: "gemma3:4b", name: "Gemma 3 4B" },
  { id: "gemma3:1b", name: "Gemma 3 1B" },
  { id: "gemma2:27b", name: "Gemma 2 27B" },
  { id: "gemma2:9b", name: "Gemma 2 9B" },
  { id: "nemotron:70b", name: "Nemotron 70B" },
  { id: "llava:13b", name: "LLaVA 13B" },
];

const QWEN_MODELS: CatalogModel[] = [
  { id: "qwen3-235b-a22b", name: "Qwen3 235B A22B", thinking: true },
  { id: "qwen3-32b", name: "Qwen3 32B", thinking: true },
  { id: "qwen3-14b", name: "Qwen3 14B", thinking: true },
  { id: "qwen3-8b", name: "Qwen3 8B", thinking: true },
  { id: "qwen3-4b", name: "Qwen3 4B", thinking: true },
  { id: "qwen2.5-coder-32b-instruct", name: "Qwen2.5 Coder 32B Instruct" },
  { id: "qwen2.5-72b-instruct", name: "Qwen2.5 72B Instruct" },
  { id: "qwen2.5-14b-instruct", name: "Qwen2.5 14B Instruct" },
  { id: "qwen2.5-7b-instruct", name: "Qwen2.5 7B Instruct" },
  { id: "qwen-max", name: "Qwen Max" },
  { id: "qwen-plus", name: "Qwen Plus" },
  { id: "qwen-turbo", name: "Qwen Turbo" },
  { id: "qwen-coder-plus", name: "Qwen Coder Plus" },
  { id: "qwen-coder-turbo", name: "Qwen Coder Turbo" },
];

const MOONSHOT_MODELS: CatalogModel[] = [
  { id: "kimi-k2", name: "Kimi K2", thinking: true },
  { id: "kimi-k2-thinking", name: "Kimi K2 Thinking", thinking: true },
  { id: "moonshot-v1-128k", name: "Moonshot v1 128K" },
  { id: "moonshot-v1-32k", name: "Moonshot v1 32K" },
  { id: "moonshot-v1-8k", name: "Moonshot v1 8K" },
  { id: "moonshot-v1-8k-vision-preview", name: "Moonshot v1 8K Vision" },
];

const MINIMAX_MODELS: CatalogModel[] = [
  { id: "minimax-m2", name: "MiniMax M2", thinking: true },
  { id: "minimax-m1", name: "MiniMax M1", thinking: true },
  { id: "minimax-text-01", name: "MiniMax Text-01" },
  { id: "abab6.5s-chat", name: "ABAB 6.5S Chat" },
  { id: "abab6.5s", name: "ABAB 6.5S" },
];

const VERTEX_MODELS: CatalogModel[] = [
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (preview)", thinking: true },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro (preview)", thinking: true },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash (preview)", thinking: true },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", thinking: true },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", thinking: true },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  { id: "claude-opus-4-6", name: "Claude Opus 4.6", thinking: true },
  { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", thinking: true },
  { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", thinking: true },
  { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", thinking: true },
  { id: "claude-3-5-haiku", name: "Claude 3.5 Haiku" },
  { id: "llama-3.1-405b-instruct", name: "Llama 3.1 405B Instruct" },
  { id: "llama-3.1-70b-instruct", name: "Llama 3.1 70B Instruct" },
  { id: "llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct" },
  { id: "mistral-large-2411", name: "Mistral Large" },
  { id: "mistral-small-2503", name: "Mistral Small" },
];

const BEDROCK_MODELS: CatalogModel[] = [
  { id: "anthropic.claude-opus-4-6", name: "Claude Opus 4.6", thinking: true },
  { id: "anthropic.claude-opus-4-5", name: "Claude Opus 4.5", thinking: true },
  { id: "anthropic.claude-sonnet-4-6", name: "Claude Sonnet 4.6", thinking: true },
  { id: "anthropic.claude-sonnet-4-5", name: "Claude Sonnet 4.5", thinking: true },
  { id: "anthropic.claude-haiku-4-5", name: "Claude Haiku 4.5", thinking: true },
  { id: "anthropic.claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", thinking: true },
  { id: "anthropic.claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
  { id: "anthropic.claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
  { id: "anthropic.claude-3-opus-20240229", name: "Claude 3 Opus" },
  { id: "amazon.nova-pro-v1", name: "Amazon Nova Pro" },
  { id: "amazon.nova-lite-v1", name: "Amazon Nova Lite" },
  { id: "amazon.nova-micro-v1", name: "Amazon Nova Micro" },
  { id: "meta.llama3-3-70b-instruct", name: "Llama 3.3 70B Instruct" },
  { id: "meta.llama3-1-70b-instruct", name: "Llama 3.1 70B Instruct" },
  { id: "meta.llama3-1-405b-instruct", name: "Llama 3.1 405B Instruct" },
  { id: "mistral.mistral-large-2407", name: "Mistral Large" },
];

const AZURE_MODELS: CatalogModel[] = [
  { id: "gpt-5", name: "GPT-5", thinking: true },
  { id: "gpt-5-mini", name: "GPT-5 Mini", thinking: true },
  { id: "gpt-5-nano", name: "GPT-5 Nano" },
  { id: "gpt-4.1", name: "GPT-4.1", thinking: true },
  { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
  { id: "gpt-4.1-nano", name: "GPT-4.1 Nano" },
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "gpt-4", name: "GPT-4" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
  { id: "gpt-35-turbo", name: "GPT-3.5 Turbo" },
  { id: "o3", name: "o3", thinking: true },
  { id: "o3-mini", name: "o3 Mini", thinking: true },
  { id: "o4-mini", name: "o4 Mini", thinking: true },
];

const CUSTOM_MODELS: CatalogModel[] = [
  { id: "custom-model", name: "Custom Model" },
  { id: "vllm-model", name: "vLLM (hosted)" },
  { id: "llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct" },
  { id: "qwen3-32b", name: "Qwen3 32B" },
  { id: "phi-4", name: "Phi-4" },
];

const OPENROUTER_FALLBACK: CatalogModel[] = [
  { id: "anthropic/claude-opus-4-6", name: "Claude Opus 4.6", thinking: true },
  { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", thinking: true },
  { id: "anthropic/claude-haiku-4-5", name: "Claude Haiku 4.5", thinking: true },
  { id: "openai/gpt-5.4", name: "GPT-5.4", thinking: true },
  { id: "openai/gpt-5.4-mini", name: "GPT-5.4 Mini", thinking: true },
  { id: "openai/gpt-5", name: "GPT-5", thinking: true },
  { id: "openai/gpt-5-mini", name: "GPT-5 Mini", thinking: true },
  { id: "openai/o3", name: "o3", thinking: true },
  { id: "openai/o4-mini", name: "o4 Mini", thinking: true },
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", thinking: true },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", thinking: true },
  { id: "google/gemini-3-flash", name: "Gemini 3 Flash", thinking: true },
  { id: "deepseek/deepseek-chat", name: "DeepSeek Chat" },
  { id: "deepseek/deepseek-reasoner", name: "DeepSeek Reasoner", thinking: true },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick" },
  { id: "qwen/qwen3-235b-a22b", name: "Qwen3 235B", thinking: true },
  { id: "mistralai/mistral-large", name: "Mistral Large" },
  { id: "x-ai/grok-4", name: "Grok 4", thinking: true },
];

const STATIC_PROVIDERS: CatalogProvider[] = [
  { id: "anthropic", name: "Anthropic", status: "ready", models: ANTHROPIC_MODELS },
  { id: "openai", name: "OpenAI", status: "ready", models: OPENAI_MODELS },
  { id: "google", name: "Google Gemini", status: "ready", models: GEMINI_MODELS },
  { id: "deepseek", name: "DeepSeek", status: "ready", models: DEEPSEEK_MODELS },
  { id: "opencode-zen", name: "OpenCode Zen", status: "ready", models: OPENCODE_ZEN_MODELS },
  { id: "openrouter", name: "OpenRouter", status: "needs-setup", models: OPENROUTER_FALLBACK },
  { id: "ollama", name: "Ollama", status: "needs-setup", models: OLLAMA_MODELS },
  { id: "qwen", name: "Qwen", status: "needs-setup", models: QWEN_MODELS },
  { id: "moonshot", name: "Moonshot Kimi", status: "needs-setup", models: MOONSHOT_MODELS },
  { id: "minimax", name: "MiniMax", status: "needs-setup", models: MINIMAX_MODELS },
  { id: "vertex", name: "Google Vertex AI", status: "needs-setup", models: VERTEX_MODELS },
  { id: "bedrock", name: "AWS Bedrock", status: "needs-setup", models: BEDROCK_MODELS },
  { id: "azure", name: "Azure OpenAI", status: "needs-setup", models: AZURE_MODELS },
  { id: "custom", name: "Custom (OpenAI-compat.)", status: "needs-setup", models: CUSTOM_MODELS },
];

const OPENROUTER_CACHE_MS = 10 * 60 * 1000;
let openRouterCache: { at: number; models: CatalogModel[] } | null = null;

async function fetchOpenRouterModels(): Promise<CatalogModel[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      data?: Array<{
        id?: string;
        name?: string;
        architecture?: { reasoning?: boolean; modality?: string };
      }>;
    };
    const models = (data.data || [])
      .filter((m) => {
        const id = m?.id || "";
        if (!id) return false;
        if (/embed|rerank|moderation|\/audio|\/image|tts|stt|video|whisper|flux|sdxl|dall-e|paint|fashion/.test(id)) return false;
        return true;
      })
      .map((m) => ({
        id: m.id as string,
        name: m.name || (m.id as string),
        thinking: !!(m.architecture?.reasoning || /-(think|thinking|reasoning|reasoner)\b/.test(m.id || "")),
      }));
    if (models.length > 0) return models;
    return OPENROUTER_FALLBACK;
  } catch {
    return OPENROUTER_FALLBACK;
  } finally {
    clearTimeout(timer);
  }
}

// GET /api/models — complete provider/model catalog. OpenRouter models are
// fetched live from their API (cached 10 min) and merged over the static fallback.
router.get("/", async (_req, res) => {
  let openRouterModels = openRouterCache?.models ?? [];
  if (!openRouterCache || Date.now() - openRouterCache.at > OPENROUTER_CACHE_MS) {
    openRouterModels = await fetchOpenRouterModels();
    openRouterCache = { at: Date.now(), models: openRouterModels };
  }

  const providers = STATIC_PROVIDERS.map((p) =>
    p.id === "openrouter" ? { ...p, models: openRouterModels } : p
  );

  res.json({ providers, updatedAt: new Date().toISOString() });
});

export default router;
