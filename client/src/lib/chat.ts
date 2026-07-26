export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

// API key storage in localStorage
export function getApiKey(providerId: string): string | null {
  return localStorage.getItem(`straxor_key_${providerId}`);
}

export function setApiKey(providerId: string, key: string): void {
  localStorage.setItem(`straxor_key_${providerId}`, key);
}

export function removeApiKey(providerId: string): void {
  localStorage.removeItem(`straxor_key_${providerId}`);
}

// Streaming chat function
export async function streamChat(
  providerId: string,
  modelId: string,
  messages: ChatMessage[],
  thinking: string,
  callbacks: StreamCallbacks
): Promise<void> {
  const apiKey = getApiKey(providerId);
  if (!apiKey) {
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
        apiKey,
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
