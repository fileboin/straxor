import type { ModelPricing } from "./adapter.js";

// ── Known Model Pricing (USD per 1M tokens) ──
// Source: provider pricing pages as of July 2025

export const MODEL_PRICING: ModelPricing[] = [
  // Anthropic
  { provider: "anthropic", model: "claude-opus-4-6", inputCostPer1M: 15, outputCostPer1M: 75, label: "Claude Opus 4" },
  { provider: "anthropic", model: "claude-sonnet-4", inputCostPer1M: 3, outputCostPer1M: 15, label: "Claude Sonnet 4" },
  { provider: "anthropic", model: "claude-haiku-4-5", inputCostPer1M: 0.80, outputCostPer1M: 4, label: "Claude Haiku 4.5" },

  // OpenAI
  { provider: "openai", model: "gpt-4o", inputCostPer1M: 2.50, outputCostPer1M: 10, label: "GPT-4o" },
  { provider: "openai", model: "gpt-4o-mini", inputCostPer1M: 0.15, outputCostPer1M: 0.60, label: "GPT-4o Mini" },
  { provider: "openai", model: "o3", inputCostPer1M: 10, outputCostPer1M: 40, label: "o3" },
  { provider: "openai", model: "o4-mini", inputCostPer1M: 1.10, outputCostPer1M: 4.40, label: "o4-mini" },

  // Google
  { provider: "google", model: "gemini-2.5-pro", inputCostPer1M: 1.25, outputCostPer1M: 10, label: "Gemini 2.5 Pro" },
  { provider: "google", model: "gemini-2.5-flash", inputCostPer1M: 0.15, outputCostPer1M: 0.60, label: "Gemini 2.5 Flash" },

  // DeepSeek
  { provider: "deepseek", model: "deepseek-chat", inputCostPer1M: 0.14, outputCostPer1M: 0.28, label: "DeepSeek Chat" },
  { provider: "deepseek", model: "deepseek-reasoner", inputCostPer1M: 0.55, outputCostPer1M: 2.19, label: "DeepSeek Reasoner" },

  // Groq
  { provider: "groq", model: "llama-3.3-70b", inputCostPer1M: 0.59, outputCostPer1M: 0.79, label: "Llama 3.3 70B" },
  { provider: "groq", model: "mixtral-8x7b", inputCostPer1M: 0.24, outputCostPer1M: 0.24, label: "Mixtral 8x7B" },

  // xAI
  { provider: "xai", model: "grok-3", inputCostPer1M: 3, outputCostPer1M: 15, label: "Grok 3" },
  { provider: "xai", model: "grok-3-mini", inputCostPer1M: 0.30, outputCostPer1M: 0.50, label: "Grok 3 Mini" },

  // Together AI
  { provider: "together", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", inputCostPer1M: 0.88, outputCostPer1M: 0.88, label: "Llama 3.3 70B" },
  { provider: "together", model: "meta-llama/Llama-3.1-405B-Instruct-Turbo", inputCostPer1M: 3.50, outputCostPer1M: 3.50, label: "Llama 3.1 405B" },
  { provider: "together", model: "Qwen/Qwen2.5-72B-Instruct-Turbo", inputCostPer1M: 0.90, outputCostPer1M: 0.90, label: "Qwen2.5 72B" },
  { provider: "together", model: "Qwen/Qwen2.5-Coder-32B-Instruct", inputCostPer1M: 0.18, outputCostPer1M: 0.18, label: "Qwen2.5 Coder 32B" },
  { provider: "together", model: "deepseek-ai/DeepSeek-V3", inputCostPer1M: 0.90, outputCostPer1M: 0.90, label: "DeepSeek V3" },

  // OpenCode Zen (hosted gateway; free models are $0)
  { provider: "opencode-zen", model: "opencode/gpt-5.3-codex", inputCostPer1M: 3, outputCostPer1M: 12, label: "OpenCode Zen GPT-5.3 Codex" },
  { provider: "opencode-zen", model: "opencode/gpt-5.2-codex", inputCostPer1M: 3, outputCostPer1M: 12, label: "OpenCode Zen GPT-5.2 Codex" },
  { provider: "opencode-zen", model: "opencode/gpt-5.1-codex", inputCostPer1M: 3, outputCostPer1M: 12, label: "OpenCode Zen GPT-5.1 Codex" },
  { provider: "opencode-zen", model: "opencode/gpt-5-codex", inputCostPer1M: 3, outputCostPer1M: 12, label: "OpenCode Zen GPT-5 Codex" },
  { provider: "opencode-zen", model: "opencode/gpt-5.5", inputCostPer1M: 2.5, outputCostPer1M: 10, label: "OpenCode Zen GPT-5.5" },
  { provider: "opencode-zen", model: "opencode/gpt-5.4", inputCostPer1M: 2.5, outputCostPer1M: 10, label: "OpenCode Zen GPT-5.4" },
  { provider: "opencode-zen", model: "opencode/claude-sonnet-4-6", inputCostPer1M: 3, outputCostPer1M: 15, label: "OpenCode Zen Claude Sonnet 4.6" },
  { provider: "opencode-zen", model: "opencode/claude-opus-4-6", inputCostPer1M: 15, outputCostPer1M: 75, label: "OpenCode Zen Claude Opus 4.6" },
  { provider: "opencode-zen", model: "opencode/deepseek-v4-pro", inputCostPer1M: 0.30, outputCostPer1M: 1.50, label: "OpenCode Zen DeepSeek V4 Pro" },
  { provider: "opencode-zen", model: "opencode/deepseek-v4-flash", inputCostPer1M: 0.20, outputCostPer1M: 1.20, label: "OpenCode Zen DeepSeek V4 Flash" },

  // OpenCode Go (same gateway, opencode_go/<id> models)
  { provider: "opencode-go", model: "opencode_go/minimax-m2.7", inputCostPer1M: 0.60, outputCostPer1M: 2.50, label: "OpenCode Go MiniMax M2.7" },
  { provider: "opencode-go", model: "opencode_go/minimax-m2.5", inputCostPer1M: 0.40, outputCostPer1M: 1.80, label: "OpenCode Go MiniMax M2.5" },
  { provider: "opencode-go", model: "opencode_go/gpt-5.5", inputCostPer1M: 2.5, outputCostPer1M: 10, label: "OpenCode Go GPT-5.5" },
  { provider: "opencode-go", model: "opencode_go/gpt-5.4", inputCostPer1M: 2.5, outputCostPer1M: 10, label: "OpenCode Go GPT-5.4" },
  { provider: "opencode-go", model: "opencode_go/gpt-5.3-codex", inputCostPer1M: 3, outputCostPer1M: 12, label: "OpenCode Go GPT-5.3 Codex" },
  { provider: "opencode-go", model: "opencode_go/gpt-5.2-codex", inputCostPer1M: 3, outputCostPer1M: 12, label: "OpenCode Go GPT-5.2 Codex" },
  { provider: "opencode-go", model: "opencode_go/gpt-5-codex", inputCostPer1M: 3, outputCostPer1M: 12, label: "OpenCode Go GPT-5 Codex" },
  { provider: "opencode-go", model: "opencode_go/deepseek-v4-pro", inputCostPer1M: 0.30, outputCostPer1M: 1.50, label: "OpenCode Go DeepSeek V4 Pro" },
  { provider: "opencode-go", model: "opencode_go/deepseek-v4-flash", inputCostPer1M: 0.20, outputCostPer1M: 1.20, label: "OpenCode Go DeepSeek V4 Flash" },
  { provider: "opencode-go", model: "opencode_go/deepseek-r1", inputCostPer1M: 0.55, outputCostPer1M: 2.19, label: "OpenCode Go DeepSeek R1" },
  { provider: "opencode-go", model: "opencode_go/claude-sonnet-4-6", inputCostPer1M: 3, outputCostPer1M: 15, label: "OpenCode Go Claude Sonnet 4.6" },
  { provider: "opencode-go", model: "opencode_go/claude-opus-4-6", inputCostPer1M: 15, outputCostPer1M: 75, label: "OpenCode Go Claude Opus 4.6" },
];

export function getPricingForModel(provider: string, model: string): ModelPricing | undefined {
  return MODEL_PRICING.find(
    (p) => p.provider === provider && p.model === model
  );
}

export function estimateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getPricingForModel(provider, model);
  if (!pricing) return 0;
  return (
    (inputTokens / 1_000_000) * pricing.inputCostPer1M +
    (outputTokens / 1_000_000) * pricing.outputCostPer1M
  );
}

export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}
