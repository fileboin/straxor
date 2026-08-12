import { api } from "./api.js";
import { needsApiKey } from "./models.js";
import type { Attachment } from "./attachments.js";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

// API key management via server (encrypted in DB)
export async function getApiKey(providerId: string): Promise<string | null> {
  try {
    const result = await api<{ key: string }>(`/api-keys/${providerId}`);
    return result.key;
  } catch {
    return null;
  }
}

export async function setApiKey(providerId: string, key: string): Promise<void> {
  await api("/api-keys", {
    method: "POST",
    body: JSON.stringify({ providerId, key }),
  });
}

export async function removeApiKey(providerId: string): Promise<void> {
  await api(`/api-keys/${providerId}`, { method: "DELETE" });
}

// Check if API key exists (masked version for UI)
export async function hasApiKey(providerId: string): Promise<boolean> {
  try {
    await api(`/api-keys/${providerId}`);
    return true;
  } catch {
    return false;
  }
}

// Streaming chat function - server fetches the API key from DB
export async function streamChat(
  providerId: string,
  modelId: string,
  messages: ChatMessage[],
  thinking: string,
  callbacks: StreamCallbacks,
  attachments?: Attachment[]
): Promise<void> {
  // First check if we have an API key for this provider
  const key = await getApiKey(providerId);
  if (!key && needsApiKey(providerId)) {
    callbacks.onError("API key not configured for this provider");
    return;
  }

  try {
    const token = localStorage.getItem("token");
    // Watchdog: if no data arrives within IDLE_MS the connection is considered
    // hung and is aborted so the UI can surface an error instead of spinning.
    // TOTAL_MS is a hard cap against an endless provider loop.
    const IDLE_MS = 45_000;
    const TOTAL_MS = 600_000;
    const controller = new AbortController();
    let watchdog = window.setTimeout(() => controller.abort(), IDLE_MS);
    const totalTimer = window.setTimeout(() => controller.abort(), TOTAL_MS);
    const poke = () => {
      window.clearTimeout(watchdog);
      watchdog = window.setTimeout(() => controller.abort(), IDLE_MS);
    };
    poke();
    let finished = false;
    const finishError = (message: string) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(watchdog);
      window.clearTimeout(totalTimer);
      callbacks.onError(message);
    };
    const finishDone = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(watchdog);
      window.clearTimeout(totalTimer);
      callbacks.onDone();
    };

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      signal: controller.signal,
      body: JSON.stringify({
        providerId,
        modelId,
        messages,
        apiKey: key || "",
        thinking,
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Request failed" }));
      finishError(errorData.error || `HTTP ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      finishError("No response stream");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      poke();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          finishDone();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            finishError(parsed.error);
            return;
          }
          if (parsed.token) {
            callbacks.onToken(parsed.token);
          }
        } catch {}
      }
    }

    finishDone();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    callbacks.onError(isAbort ? "Odgovor je prekoračio vremensko ograničenje. Pokušajte ponovo ili ukratite upit." : message);
  }
}
