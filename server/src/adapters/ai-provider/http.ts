import type {
  AIProviderAdapter,
  AIStreamEvent,
  ChatContent,
  ChatMessage,
} from "./adapter.js";
import type { ContentBlock, TextContentBlock } from "../../lib/attachments.js";

function toAnthropicContent(content: ChatContent): unknown {
  if (typeof content === "string") return content;
  return content.map((b) =>
    b.type === "text"
      ? { type: "text", text: b.text }
      : {
          type: "image",
          source: { type: "base64", media_type: b.image.mediaType, data: b.image.data },
        }
  );
}

function toOpenAIContent(content: ChatContent): unknown {
  if (typeof content === "string") return content;
  return content.map((b) =>
    b.type === "text"
      ? { type: "text", text: b.text }
      : {
          type: "image_url",
          image_url: { url: `data:${b.image.mediaType};base64,${b.image.data}` },
        }
  );
}

function toGoogleParts(content: ChatContent): Array<Record<string, unknown>> {
  if (typeof content === "string") return [{ text: content }];
  return content.flatMap<Record<string, unknown>>((b) =>
    b.type === "text"
      ? [{ text: b.text }]
      : [{ inlineData: { mimeType: b.image.mediaType, data: b.image.data } }]
  );
}

function toTextOnlyContent(content: ChatContent): string {
  if (typeof content === "string") return content;
  const text = content
    .filter((b) => b.type === "text")
    .map((b) => (b as TextContentBlock).text)
    .join("\n\n");
  return text || "[sadrži sliku — model bez vizije]";
}

function countImageBlocks(messages: ChatMessage[]): number {
  let n = 0;
  for (const m of messages) {
    if (Array.isArray(m.content)) {
      n += m.content.filter((b): b is Extract<ContentBlock, { type: "image" }> => b.type === "image").length;
    }
  }
  return n;
}

// ── Anthropic thinking capabilities, per model family ──
// The thinking parameter is NOT uniform across Claude models:
//   • Fable/Mythos 5      → thinking is always on; ANY explicit `thinking` config is a 400.
//                            Depth is controlled only via output_config.effort.
//   • Opus 5 / 4.8 / 4.7 / 4.6, Sonnet 5 / 4.6
//                          → adaptive thinking. `budget_tokens` was removed and returns a 400
//                            on the 5-family; depth comes from output_config.effort.
//   • Opus 4.5, Sonnet 4.5, Haiku 4.5 and older
//                          → fixed budget: { type: "enabled", budget_tokens: N },
//                            and budget_tokens MUST be strictly less than max_tokens.
function anthropicModelKey(modelId: string): string {
  // Tolerate provider-prefixed ids (bedrock "anthropic.claude-…", openrouter "anthropic/claude-…").
  return modelId.replace(/^anthropic[./]/, "");
}

function thinkingIsAlwaysOn(modelId: string): boolean {
  return /^claude-(fable|mythos)-5/.test(anthropicModelKey(modelId));
}

function usesAdaptiveThinking(modelId: string): boolean {
  return /^claude-(opus-5|opus-4-8|opus-4-7|opus-4-6|sonnet-5|sonnet-4-6)/.test(
    anthropicModelKey(modelId)
  );
}

const ANTHROPIC_EFFORT: Record<string, string> = {
  low: "low",
  medium: "medium",
  high: "high",
};

const ANTHROPIC_BUDGET_TOKENS: Record<string, number> = {
  low: 1024, // 1024 is the API minimum
  medium: 4000,
  high: 10000,
};

// Exported for testing — this body shape is model-dependent and easy to regress.
export function buildAnthropicBody(
  model: string,
  messages: ChatMessage[],
  thinking?: string
): Record<string, unknown> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => toTextOnlyContent(m.content))
    .filter(Boolean);
  const wantsThinking = !!thinking && thinking !== "off";
  // Thinking tokens share the max_tokens budget, so reasoning runs need headroom.
  // budget_tokens must stay strictly below max_tokens on pre-4.6 models.
  const body: Record<string, unknown> = {
    model,
    max_tokens: wantsThinking ? 32000 : 8192,
    stream: true,
    messages: messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: toAnthropicContent(m.content) })),
  };

  if (thinkingIsAlwaysOn(model)) {
    // Omit `thinking` entirely — any explicit config is rejected on these models.
    body.output_config = { effort: wantsThinking ? ANTHROPIC_EFFORT[thinking!] ?? "high" : "low" };
  } else if (usesAdaptiveThinking(model)) {
    if (wantsThinking) {
      body.thinking = { type: "adaptive", display: "summarized" };
      body.output_config = { effort: ANTHROPIC_EFFORT[thinking!] ?? "high" };
    } else {
      // Leave effort at its default — "disabled" is rejected above effort high.
      body.thinking = { type: "disabled" };
    }
  } else if (wantsThinking) {
    body.thinking = {
      type: "enabled",
      budget_tokens: ANTHROPIC_BUDGET_TOKENS[thinking!] ?? 4000,
    };
  }

  if (system.length) body.system = system.join("\n\n");
  return body;
}

interface ProviderConfig {
  baseUrl: string | ((model: string) => string);
  buildHeaders: (key: string) => Record<string, string>;
  buildBody: (model: string, messages: ChatMessage[], thinking?: string) => Record<string, unknown>;
  extractStreamLine: (line: string) => string | null;
}

const PROVIDER_CONFIG: Record<string, ProviderConfig> = {
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1/messages",
    buildHeaders: (key) => ({
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    }),
    buildBody: buildAnthropicBody,
    extractStreamLine: (line) => {
      if (!line.startsWith("data: ")) return null;
      try {
        const d = JSON.parse(line.slice(6));
        if (d.type === "content_block_delta" && d.delta?.text) return d.delta.text;
      } catch {}
      return null;
    },
  },
  openai: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    buildHeaders: (key) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }),
    buildBody: (model, messages) => ({
      model,
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) })),
    }),
    extractStreamLine: (line) => {
      try {
        if (line.startsWith("data: ")) {
          const d = JSON.parse(line.slice(6));
          return d.choices?.[0]?.delta?.content || null;
        }
      } catch {}
      return null;
    },
  },
  google: {
    baseUrl: (model: string) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    buildHeaders: (key) => ({
      "x-goog-api-key": key,
      "Content-Type": "application/json",
    }),
    buildBody: (_model, messages) => {
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => toTextOnlyContent(m.content))
        .filter(Boolean)
        .join("\n\n");
      const body: Record<string, unknown> = {
        contents: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "assistant" ? "model" : m.role,
            parts: toGoogleParts(m.content),
          })),
      };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      return body;
    },
    extractStreamLine: (line) => {
      try {
        if (line.startsWith("data: ")) {
          const d = JSON.parse(line.slice(6));
          return d.candidates?.[0]?.content?.parts?.[0]?.text || null;
        }
      } catch {}
      return null;
    },
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1/chat/completions",
    buildHeaders: (key) => ({
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    }),
    buildBody: (model, messages) => ({
      model,
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: toTextOnlyContent(m.content) })),
    }),
    extractStreamLine: (line) => {
      try {
        if (line.startsWith("data: ")) {
          const d = JSON.parse(line.slice(6));
          return d.choices?.[0]?.delta?.content || null;
        }
      } catch {}
      return null;
    },
  },
};

const OPENAI_COMPATIBLE = ["openrouter", "qwen", "moonshot", "minimax", "mistral", "xai", "groq", "ollama", "custom", "opencode-zen"];

const COMPAT_BASE_URLS: Record<string, string> = {
  "opencode-zen": "https://opencode.ai/zen/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  moonshot: "https://api.moonshot.cn/v1/chat/completions",
  minimax: "https://api.minimax.chat/v1/text/chatcompletion_v2",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  xai: "https://api.x.ai/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  ollama: "http://localhost:11434/v1/chat/completions",
  custom: "http://localhost:11434/v1/chat/completions",
};

function resolveBaseUrl(providerId: string, modelId: string): string {
  const config = PROVIDER_CONFIG[providerId];
  if (config) {
    return typeof config.baseUrl === "function" ? config.baseUrl(modelId) : config.baseUrl;
  }
  return COMPAT_BASE_URLS[providerId] || "http://localhost:11434/v1/chat/completions";
}

export function createHttpAIProviderAdapter(): AIProviderAdapter {
  return {
    async *streamChat({ providerId, modelId, messages, apiKey, thinking }) {
      const config = PROVIDER_CONFIG[providerId];
      const isCompat = OPENAI_COMPATIBLE.includes(providerId);

      if (!config && !isCompat) {
        yield { type: "error" as const, content: "Unsupported provider" };
        return;
      }

      const baseUrl = resolveBaseUrl(providerId, modelId);
      const headers = config
        ? config.buildHeaders(apiKey)
        : { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
      const body = config
        ? config.buildBody(modelId, messages, thinking)
        : {
            model: modelId,
            stream: true,
            messages: messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) })),
          };

      const imageCount = countImageBlocks(messages);
      console.log(
        `[ai-provider] provider=${providerId} model=${modelId} messages=${messages.length} imageBlocks=${imageCount}`
      );

      const response = await fetch(baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errorMessage = `${providerId} error (${response.status})`;
        try {
          const errorText = await response.text();
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error) {
              if (typeof errorData.error === "string") {
                errorMessage = errorData.error;
              } else if (errorData.error.message) {
                errorMessage = errorData.error.message;
              } else if (errorData.error.type) {
                errorMessage = errorData.error.type;
              }
            }
          } catch {
            if (errorText.length > 0 && errorText.length < 500) {
              errorMessage = errorText;
            }
          }
        } catch {
          errorMessage += ": Unable to read response";
        }
        console.error(`[ai-provider] ${providerId} request failed: ${errorMessage}`);
        yield {
          type: "error" as const,
          content: errorMessage,
        };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: "error" as const, content: "No response body" };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Providers can report a failure mid-stream (Anthropic sends an
          // `error` SSE event). Without this the stream just ends silently and
          // the user sees an empty reply.
          if (trimmed.startsWith("data: ")) {
            try {
              const payload = JSON.parse(trimmed.slice(6));
              const err = payload?.error;
              if (err) {
                const detail = typeof err === "string" ? err : err.message || err.type;
                console.error(`[ai-provider] ${providerId} stream error: ${detail}`);
                yield { type: "error" as const, content: detail || "Stream error" };
                return;
              }
            } catch {}
          }

          let token: string | null = null;

          if (config) {
            token = config.extractStreamLine(trimmed);
          } else if (isCompat) {
            try {
              if (trimmed.startsWith("data: ")) {
                const data = JSON.parse(trimmed.slice(6));
                if (data.choices?.[0]?.delta?.content) {
                  token = data.choices[0].delta.content;
                }
              }
            } catch {}
          }

          if (token) {
            yield { type: "token" as const, content: token };
          }
        }
      }
    },
  };
}
