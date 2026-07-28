// ── Free Claude Code Config ──

export const FCC_REPO = "https://github.com/Alishahryar1/free-claude-code.git";
export const FCC_DEFAULT_PORT = 8082;
export const FCC_DEFAULT_DIR = "/opt/free-claude-code";
export const FCC_DATA_DIR = "~/.fcc";

export interface FCCConfig {
  repoUrl: string;
  installDir: string;
  dataDir: string;
  port: number;
  pythonVersion: string;
  adminToken?: string;
  providerApiKey?: string;
  providerModel?: string;
  providerId?: string;
}

export const DEFAULT_FCC_CONFIG: FCCConfig = {
  repoUrl: FCC_REPO,
  installDir: FCC_DEFAULT_DIR,
  dataDir: FCC_DATA_DIR,
  port: FCC_DEFAULT_PORT,
  pythonVersion: "3.14",
  providerApiKey: "",
  providerModel: "nvidia_nim/nvidia/nemotron-3-super-120b-a12b",
  providerId: "nvidia_nim",
};

export const FCC_PROVIDERS = [
  { id: "nvidia_nim", name: "NVIDIA NIM", envKey: "NVIDIA_NIM_API_KEY", defaultModel: "nvidia_nim/nvidia/nemotron-3-super-120b-a12b" },
  { id: "open_router", name: "OpenRouter", envKey: "OPENROUTER_API_KEY", defaultModel: "open_router/openrouter/free" },
  { id: "gemini", name: "Google AI Studio", envKey: "GEMINI_API_KEY", defaultModel: "gemini/models/gemini-3.1-flash-lite" },
  { id: "deepseek", name: "DeepSeek", envKey: "DEEPSEEK_API_KEY", defaultModel: "deepseek/deepseek-chat" },
  { id: "mistral", name: "Mistral", envKey: "MISTRAL_API_KEY", defaultModel: "mistral/devstral-small-latest" },
  { id: "groq", name: "Groq", envKey: "GROQ_API_KEY", defaultModel: "groq/llama-3.3-70b-versatile" },
  { id: "openai", name: "OpenAI", envKey: "OPENAI_API_KEY", defaultModel: "openai/gpt-4o" },
  { id: "anthropic", name: "Anthropic", envKey: "ANTHROPIC_API_KEY", defaultModel: "anthropic/claude-sonnet-4" },
  { id: "ollama", name: "Ollama (Local)", envKey: "OLLAMA_BASE_URL", defaultModel: "ollama/llama3.1" },
  { id: "lm_studio", name: "LM Studio (Local)", envKey: "LM_STUDIO_BASE_URL", defaultModel: "lmstudio/<model-id>" },
  { id: "llamacpp", name: "llama.cpp (Local)", envKey: "LLAMACPP_BASE_URL", defaultModel: "llamacpp/<model-id>" },
  { id: "huggingface", name: "Hugging Face", envKey: "HUGGINGFACE_API_KEY", defaultModel: "huggingface/Qwen/Qwen3-Coder-480B-A35B-Instruct:fastest" },
  { id: "github_models", name: "GitHub Models", envKey: "GITHUB_MODELS_TOKEN", defaultModel: "github_models/openai/gpt-4.1" },
  { id: "fireworks", name: "Fireworks AI", envKey: "FIREWORKS_API_KEY", defaultModel: "fireworks/accounts/fireworks/models/llama-v3p3-70b-instruct" },
  { id: "cerebras", name: "Cerebras", envKey: "CEREBRAS_API_KEY", defaultModel: "cerebras/gpt-oss-120b" },
  { id: "cohere", name: "Cohere", envKey: "COHERE_API_KEY", defaultModel: "cohere/command-a-plus-05-2026" },
  { id: "cloudflare", name: "Cloudflare Workers AI", envKey: "CLOUDFLARE_API_TOKEN", defaultModel: "cloudflare/@cf/moonshotai/kimi-k2.6" },
  { id: "sambanova", name: "SambaNova", envKey: "SAMBANOVA_API_KEY", defaultModel: "sambanova/Meta-Llama-3.3-70B-Instruct" },
  { id: "kimi", name: "Kimi API", envKey: "KIMI_API_KEY", defaultModel: "kimi/kimi-k2.5" },
  { id: "kimi_code", name: "Kimi Code", envKey: "KIMI_CODE_API_KEY", defaultModel: "kimi_code/k3" },
  { id: "minimax", name: "MiniMax", envKey: "MINIMAX_API_KEY", defaultModel: "minimax/MiniMax-M3" },
  { id: "wafer", name: "Wafer", envKey: "WAFER_API_KEY", defaultModel: "wafer/DeepSeek-V4-Pro" },
  { id: "vertex", name: "Google Vertex AI", envKey: "VERTEX_PROJECT_ID", defaultModel: "vertex/google/gemini-3.5-flash", needsGcloud: true },
  { id: "bedrock", name: "Amazon Bedrock", envKey: "AWS_BEARER_TOKEN_BEDROCK", defaultModel: "bedrock/openai.gpt-oss-120b" },
  { id: "vercel", name: "Vercel AI Gateway", envKey: "AI_GATEWAY_API_KEY", defaultModel: "vercel/openai/gpt-5.5" },
  { id: "kilo", name: "Kilo.ai", envKey: "KILO_API_KEY", defaultModel: "kilo/kilo-auto/free" },
  { id: "zai", name: "Z.ai", envKey: "ZAI_API_KEY", defaultModel: "zai/glm-5.2" },
  { id: "opencode", name: "OpenCode Zen", envKey: "OPENCODE_API_KEY", defaultModel: "opencode/gpt-5.3-codex" },
  { id: "opencode_go", name: "OpenCode Go", envKey: "OPENCODE_API_KEY", defaultModel: "opencode_go/minimax-m2.7" },
  { id: "ollama_cloud", name: "Ollama Cloud", envKey: "OLLAMA_API_KEY", defaultModel: "ollama_cloud/qwen3-coder:480b" },
];
