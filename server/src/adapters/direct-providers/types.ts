// ── Direct Provider Types ──

export type DirectProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "moonshot"
  | "mistral"
  | "deepseek"
  | "xai"
  | "groq"
  | "together"
  | "ollama";

export type AuthMethod = "api-key" | "none";

export interface DirectProviderDef {
  id: DirectProviderId;
  name: string;
  icon: string;
  baseUrl: string;
  authMethod: AuthMethod;
  healthEndpoint: string;
  models: { id: string; name: string; thinking?: boolean }[];
  description: string;
}

export interface DirectProviderStatus {
  providerId: DirectProviderId;
  hasKey: boolean;
  isEnabled: boolean;
  isHealthy: boolean | null; // null = not checked yet
  baseUrl: string; // effective base URL (custom or default)
  latencyMs: number | null;
  lastChecked: string | null;
  lastError: string | null;
  keyPreview: string | null; // masked key for display
}

export interface DirectProviderConfig {
  baseUrl?: string;
  isEnabled?: boolean;
}

// ── Provider Definitions ──

export const DIRECT_PROVIDERS: DirectProviderDef[] = [
  {
    id: "openai",
    name: "OpenAI (GPT)",
    icon: "🟢",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    authMethod: "api-key",
    healthEndpoint: "https://api.openai.com/v1/models",
    description: "GPT-4o, GPT-4o Mini, o3, o4-mini",
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "o3", name: "o3", thinking: true },
      { id: "o4-mini", name: "o4-mini", thinking: true },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    icon: "🟠",
    baseUrl: "https://api.anthropic.com/v1/messages",
    authMethod: "api-key",
    healthEndpoint: "https://api.anthropic.com/v1/messages",
    description: "Claude Opus 4, Sonnet 4, Haiku 3.5",
    models: [
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", thinking: true },
      { id: "claude-sonnet-4", name: "Claude Sonnet 4", thinking: true },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", thinking: true },
      { id: "claude-haiku-3-5", name: "Claude 3.5 Haiku" },
    ],
  },
  {
    id: "google",
    name: "Google (Gemini)",
    icon: "🔵",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    authMethod: "api-key",
    healthEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    description: "Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", thinking: true },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", thinking: true },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    ],
  },
  {
    id: "moonshot",
    name: "Moonshot AI (Kimi)",
    icon: "🌙",
    baseUrl: "https://api.moonshot.cn/v1/chat/completions",
    authMethod: "api-key",
    healthEndpoint: "https://api.moonshot.cn/v1/models",
    description: "Kimi K2, Moonshot v1 128K",
    models: [
      { id: "kimi-k2", name: "Kimi K2" },
      { id: "moonshot-v1-128k", name: "Moonshot v1 128K" },
    ],
  },
  {
    id: "mistral",
    name: "Mistral",
    icon: "🌫",
    baseUrl: "https://api.mistral.ai/v1/chat/completions",
    authMethod: "api-key",
    healthEndpoint: "https://api.mistral.ai/v1/models",
    description: "Mistral Large, Medium, Small",
    models: [
      { id: "mistral-large-latest", name: "Mistral Large" },
      { id: "mistral-medium-latest", name: "Mistral Medium" },
      { id: "mistral-small-latest", name: "Mistral Small" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "🐋",
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    authMethod: "api-key",
    healthEndpoint: "https://api.deepseek.com/v1/models",
    description: "DeepSeek R1, V3, Coder",
    models: [
      { id: "deepseek-r1", name: "DeepSeek R1", thinking: true },
      { id: "deepseek-v3", name: "DeepSeek V3" },
      { id: "deepseek-coder", name: "DeepSeek Coder" },
    ],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    icon: "⚡",
    baseUrl: "https://api.x.ai/v1/chat/completions",
    authMethod: "api-key",
    healthEndpoint: "https://api.x.ai/v1/models",
    description: "Grok 3, Grok 3 Mini",
    models: [
      { id: "grok-3", name: "Grok 3" },
      { id: "grok-3-mini", name: "Grok 3 Mini", thinking: true },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    icon: "⚙",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    authMethod: "api-key",
    healthEndpoint: "https://api.groq.com/openai/v1/models",
    description: "Llama 3.3 70B, Mixtral 8x7B (ultra-fast)",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
      { id: "gemma2-9b-it", name: "Gemma 2 9B" },
    ],
  },
  {
    id: "together",
    name: "Together AI",
    icon: "🤝",
    baseUrl: "https://api.together.xyz/v1/chat/completions",
    authMethod: "api-key",
    healthEndpoint: "https://api.together.xyz/v1/models",
    description: "Llama, Qwen, DeepSeek — open-source modeli u cloudu",
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", name: "Llama 3.3 70B Instruct" },
      { id: "meta-llama/Llama-3.1-405B-Instruct-Turbo", name: "Llama 3.1 405B Instruct" },
      { id: "meta-llama/Llama-3.1-8B-Instruct-Turbo", name: "Llama 3.1 8B Instruct" },
      { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", name: "Qwen2.5 72B Instruct" },
      { id: "Qwen/Qwen2.5-Coder-32B-Instruct", name: "Qwen2.5 Coder 32B Instruct" },
      { id: "deepseek-ai/DeepSeek-V3", name: "DeepSeek V3" },
      { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1", thinking: true },
      { id: "mistralai/Mixtral-8x7B-Instruct-v0.1", name: "Mixtral 8x7B Instruct" },
    ],
  },
  {
    id: "ollama",
    name: "Ollama (lokalno)",
    icon: "🦙",
    baseUrl: "http://localhost:11434/v1/chat/completions",
    authMethod: "none",
    healthEndpoint: "http://localhost:11434/api/tags",
    description: "Besplatno, self-hosted, bez API key-a",
    models: [
      { id: "llama3.1:70b", name: "Llama 3.1 70B" },
      { id: "codellama:34b", name: "CodeLlama 34B" },
      { id: "deepseek-r1:32b", name: "DeepSeek R1 32B" },
      { id: "qwen3:32b", name: "Qwen3 32B" },
    ],
  },
];

export function getProviderDef(id: string): DirectProviderDef | undefined {
  return DIRECT_PROVIDERS.find((p) => p.id === id);
}
