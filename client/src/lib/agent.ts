import { api } from "./api.js";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown> | string;
  result?: string;
  status: "pending" | "running" | "completed" | "error";
}

interface AgentStreamCallbacks {
  onSession: (sessionId: string) => void;
  onText: (content: string, messageID?: string) => void;
  onToolCall: (id: string, name: string, args: Record<string, unknown> | string) => void;
  onToolResult: (id: string, result: string, status: "completed" | "error") => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export async function streamAgentMessage(
  machineId: string,
  message: string,
  sessionId: string | null,
  callbacks: AgentStreamCallbacks
): Promise<void> {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch("/api/agent/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({
        machineId,
        message,
        sessionId: sessionId || undefined,
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
          const event = JSON.parse(data);

          switch (event.type) {
            case "session":
              callbacks.onSession(event.sessionId);
              break;
            case "text":
              callbacks.onText(event.content, event.messageID);
              break;
            case "tool_call":
              callbacks.onToolCall(event.id, event.name, event.args);
              break;
            case "tool_result":
              callbacks.onToolResult(event.id, event.result || "", event.status);
              break;
            case "done":
              callbacks.onDone();
              return;
            case "error":
              callbacks.onError(event.message);
              return;
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

export async function fetchAgentSessions(machineId: string): Promise<unknown[]> {
  try {
    return await api<unknown[]>(`/agent/sessions/${machineId}`);
  } catch {
    return [];
  }
}
