import { api } from "./api.js";

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
  callbacks: StreamCallbacks
): Promise<void> {
  // First check if we have an API key for this provider
  const key = await getApiKey(providerId);
  if (!key) {
    callbacks.onError("API key not configured for this provider");
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        providerId,
        modelId,
        messages,
        apiKey: key,
        thinking,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Request failed" }));
      callbacks.onError(errorData.error || `HTTP ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError("No response stream");
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
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          callbacks.onDone();
          return;
        }

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            callbacks.onError(parsed.error);
            return;
          }
          if (parsed.token) {
            callbacks.onToken(parsed.token);
          }
        } catch {}
      }
    }

    callbacks.onDone();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    callbacks.onError(message);
  }
}
