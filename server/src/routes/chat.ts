import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  providerId: string;
  modelId: string;
  messages: ChatMessage[];
  apiKey: string;
  thinking?: string;
}

// Provider API configurations
const PROVIDER_CONFIG: Record<
  string,
  {
    baseUrl: string | ((model: string) => string);
    buildHeaders: (key: string) => Record<string, string>;
    buildBody: (model: string, messages: ChatMessage[], thinking?: string) => Record<string, unknown>;
    extractResponse: (data: unknown) => string;
    extractStreamLine: (line: string) => string | null;
  }
> = {
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
      ...(thinking && thinking !== "off" && { thinking: { type: "enabled", budget_tokens: thinking === "high" ? 10000 : thinking === "medium" ? 4000 : 1000 } }),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
    extractResponse: (data: unknown) => {
      const d = data as { content?: { type: string; text: string }[] };
      return d.content?.find((c) => c.type === "text")?.text || "";
    },
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
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
    extractResponse: (data: unknown) => {
      const d = data as { choices?: { message?: { content: string } }[] };
      return d.choices?.[0]?.message?.content || "";
    },
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
        parts: [{ text: m.content }],
      })),
    }),
    extractResponse: (data: unknown) => {
      const d = data as { candidates?: { content?: { parts?: { text: string }[] } }[] };
      return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
    extractResponse: (data: unknown) => {
      const d = data as { choices?: { message?: { content: string } }[] };
      return d.choices?.[0]?.message?.content || "";
    },
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

// OpenAI-compatible fallback for providers not explicitly configured
const OPENAI_COMPATIBLE = ["openrouter", "qwen", "moonshot", "minimax", "custom"];

function isOpenAICompatible(providerId: string): boolean {
  return OPENAI_COMPATIBLE.includes(providerId);
}

function getProviderBaseUrl(providerId: string, modelId: string): string {
  const config = PROVIDER_CONFIG[providerId];
  if (config) {
    return typeof config.baseUrl === "function" ? config.baseUrl(modelId) : config.baseUrl;
  }
  // Fallback for OpenAI-compatible providers
  const BASE_URLS: Record<string, string> = {
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
    qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    moonshot: "https://api.moonshot.cn/v1/chat/completions",
    minimax: "https://api.minimax.chat/v1/text/chatcompletion_v2",
    custom: "http://localhost:11434/v1/chat/completions",
  };
  return BASE_URLS[providerId] || "http://localhost:11434/v1/chat/completions";
}

// POST /api/chat — streaming SSE proxy
router.post("/", async (req: Request, res: Response) => {
  const { providerId, modelId, messages, apiKey, thinking } = req.body as ChatRequest;

  if (!providerId || !modelId || !messages || !apiKey) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const config = PROVIDER_CONFIG[providerId];
    const isCompat = isOpenAICompatible(providerId);
    const baseUrl = getProviderBaseUrl(providerId, modelId);

    let headers: Record<string, string>;
    let body: Record<string, unknown>;

    if (config) {
      headers = config.buildHeaders(apiKey);
      body = config.buildBody(modelId, messages, thinking);
    } else if (isCompat) {
      headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
      body = {
        model: modelId,
        stream: true,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      };
    } else {
      res.write(`data: ${JSON.stringify({ error: "Unsupported provider" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const response = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.write(`data: ${JSON.stringify({ error: `Provider error (${response.status}): ${errorText}` })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      res.write(`data: ${JSON.stringify({ error: "No response body" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
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
          // OpenAI-compatible streaming
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
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

export default router;
