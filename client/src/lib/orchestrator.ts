import { api } from "./api.js";
import type { Attachment } from "./attachments.js";

export interface RouteResult {
  difficulty: "simple" | "moderate" | "complex";
  routed: boolean;
  providerId?: string;
  modelId?: string;
  reason?: string;
  availableProviders: string[];
}

export interface OrchestrateModel {
  providerId: string;
  modelId: string;
  apiKey: string | null;
}

export interface OrchestrateResult {
  modelIndex: number;
  providerId: string;
  modelId: string;
  token?: string;
  error?: string;
  done: boolean;
}

// Call the server difficulty router — returns the best model the user has an
// API key for, based on task complexity. Used when Model orkestracija is ON.
export async function routeChat(message: string, thinking?: string): Promise<RouteResult> {
  return api<RouteResult>("/chat/route", {
    method: "POST",
    body: { message, thinking },
  });
}

// Parallel multi-model execution. Fans out to all selected models simultaneously,
// merging their SSE streams into a single async generator tagged by modelIndex.
export async function* orchestrateChat(
  models: OrchestrateModel[],
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  thinking: string | undefined,
  attachments?: Attachment[]
): AsyncGenerator<OrchestrateResult> {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/chat/orchestrate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ models, messages, thinking, attachments }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response stream");

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
      if (!trimmed || !trimmed.startsWith("data: ")) continue;

      const data = trimmed.slice(6);
      if (data === "[DONE]") {
        return;
      }

      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          yield { modelIndex: parsed.modelIndex ?? -1, error: parsed.error, done: false, providerId: "", modelId: "" };
        } else if (parsed.token !== undefined) {
          yield {
            modelIndex: parsed.modelIndex,
            token: parsed.token,
            providerId: models[parsed.modelIndex]?.providerId ?? "",
            modelId: models[parsed.modelIndex]?.modelId ?? "",
            done: false,
          };
        }
      } catch {}
    }
  }
}
