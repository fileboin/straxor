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
    buildBody: (model, messages, thinking) => ({
      model,
      max_tokens: 4096,
      ...(thinking && thinking !== "off" && {
        thinking: {
          type: "enabled",
          budget_tokens: thinking === "high" ? 10000 : thinking === "medium" ? 4000 : 1000,
        },
      }),
      messages: messages.map((m) => ({ role: m.role, content: toAnthropicContent(m.content) })),
    }),
    extractStreamLine: (line) => {
      try {
        const d = JSON.parse(line);
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
    buildBody: (_model, messages) => ({
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : m.role,
        parts: toGoogleParts(m.content),
      })),
    }),
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

const OPENAI_COMPATIBLE = ["openrouter", "qwen", "moonshot", "minimax", "mistral", "xai", "groq", "ollama", "custom"];

const COMPAT_BASE_URLS: Record<string, string> = {
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
        const errorText = await response.text();
        yield {
          type: "error" as const,
          content: `Provider error (${response.status}): ${errorText}`,
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
