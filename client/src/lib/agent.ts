import { api } from "./api.js";
import type { Attachment } from "./attachments.js";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown> | string;
  result?: string;
  status: "pending" | "running" | "completed" | "error";
}

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
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
  callbacks: AgentStreamCallbacks,
  attachments?: Attachment[],
  system?: string,
  externalSignal?: AbortSignal
): Promise<void> {
  let userAbort = false;
  let finishDone: () => void = () => {};
  try {
    const token = localStorage.getItem("token");
    // Idle watchdog: fires only when the agent produces NO real output
    // (text / tool event) for IDLE_MS. Server SSE heartbeats (: ping) must NOT
    // keep it alive, otherwise a stuck opencode process with no session.idle
    // would spin "Generišem odgovor…" forever. The total cap is a last resort.
    // These windows must be LARGER than the server's own progress timeout
    // (PROGRESS_TIMEOUT_MS = 4 min): the server emits a clean {type:"error"}
    // before this client watchdog aborts, so real agent work (cold engine
    // spawn, long git/build/tool runs) is never cut by the browser.
    const IDLE_MS = 300_000;
    const TOTAL_MS = 1_800_000;
    const controller = new AbortController();
    userAbort = false;
    const onExtAbort = () => {
      userAbort = true;
      controller.abort();
    };
    if (externalSignal) {
      if (externalSignal.aborted) onExtAbort();
      else externalSignal.addEventListener("abort", onExtAbort, { once: true });
    }
    let watchdog = window.setTimeout(() => {
      console.error("[agent:stall] no text/tool output for 5min — aborting turn");
      controller.abort();
    }, IDLE_MS);
    const totalTimer = window.setTimeout(() => {
      console.error("[agent:stall] total 30min exceeded — aborting turn");
      controller.abort();
    }, TOTAL_MS);
    const poke = () => {
      window.clearTimeout(watchdog);
      watchdog = window.setTimeout(() => {
        console.error("[agent:stall] no text/tool output for 5min — aborting turn");
        controller.abort();
      }, IDLE_MS);
    };
    let finished = false;
    const cleanup = () => {
      window.clearTimeout(watchdog);
      window.clearTimeout(totalTimer);
      externalSignal?.removeEventListener("abort", onExtAbort);
    };
    const finishError = (message: string) => {
      if (finished) return;
      finished = true;
      cleanup();
      callbacks.onError(message || "Nepoznata greška");
    };
    finishDone = () => {
      if (finished) return;
      finished = true;
      cleanup();
      callbacks.onDone();
    };

    const response = await fetch("/api/agent/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      signal: controller.signal,
      body: JSON.stringify({
        machineId,
        message,
        sessionId: sessionId || undefined,
        ...(system !== undefined && system !== "" ? { system } : {}),
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
          const event = JSON.parse(data);

          switch (event.type) {
            case "session":
              poke();
              callbacks.onSession(event.sessionId);
              break;
            case "text":
              poke();
              callbacks.onText(event.content, event.messageID);
              break;
            case "tool_call":
              poke();
              callbacks.onToolCall(event.id, event.name, event.args);
              break;
            case "tool_result":
              poke();
              callbacks.onToolResult(event.id, event.result || "", event.status);
              break;
            case "done":
              finishDone();
              return;
            case "error":
              finishError(event.message || event.content || "Agent error");
              return;
          }
        } catch {}
      }
    }

    finishDone();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    if (isAbort && userAbort) {
      finishDone();
      return;
    }
    callbacks.onError(isAbort ? "Odgovor je prekoračio vremensko ograničenje. Pokušajte ponovo ili ukratite upit." : message);
  }
}

export async function fetchAgentSessions(machineId: string): Promise<unknown[]> {
  try {
    return await api<unknown[]>(`/agent/sessions/${machineId}`);
  } catch {
    return [];
  }
}

export async function fetchTodos(
  machineId: string,
  sessionId: string
): Promise<TodoItem[]> {
  try {
    return await api<TodoItem[]>(`/agent/todos/${machineId}/${sessionId}`);
  } catch {
    return [];
  }
}

export async function fetchDiff(
  machineId: string,
  sessionId: string
): Promise<Array<{ path: string; additions: string[]; deletions: string[] }>> {
  try {
    return await api(`/agent/diff/${machineId}/${sessionId}`);
  } catch {
    return [];
  }
}

export async function approveChanges(
  machineId: string,
  sessionId: string,
  paths: string[]
): Promise<void> {
  await api("/agent/approve", {
    method: "POST",
    body: JSON.stringify({ machineId, sessionId, paths }),
  });
}

export async function rejectChanges(
  machineId: string,
  sessionId: string,
  paths: string[]
): Promise<void> {
  await api("/agent/reject", {
    method: "POST",
    body: JSON.stringify({ machineId, sessionId, paths }),
  });
}

export async function sendSteerInstruction(
  machineId: string,
  sessionId: string,
  message: string
): Promise<void> {
  const token = localStorage.getItem("token");
  const response = await fetch("/api/agent/steer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ machineId, sessionId, message }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Steer failed" }));
    throw new Error(err.error || "Failed to send instruction");
  }
}

export async function fetchFileContent(
  machineId: string,
  sessionId: string,
  path: string,
  side: "before" | "after"
): Promise<string> {
  try {
    const data = await api<{ content: string }>(
      `/agent/file/${machineId}/${sessionId}/${encodeURIComponent(path)}?side=${side}`
    );
    return data.content;
  } catch {
    return "";
  }
}

// FAZA 6: Background execution. Fire-and-forget start + polling.
export interface BackgroundTimelineEntry {
  t: "text" | "tool_call" | "tool_result" | "error";
  content?: string;
  toolId?: string;
  toolName?: string;
  toolStatus?: "running" | "completed" | "error";
}

export interface BackgroundStatus {
  jobId: string;
  sessionId: string;
  status: "running" | "done" | "error";
  error?: string;
  finished: boolean;
  timeline: BackgroundTimelineEntry[];
}

export async function startAgentBackground(
  machineId: string,
  message: string,
  sessionId: string | null,
  attachments?: Attachment[],
  system?: string
): Promise<{ jobId: string; sessionId: string }> {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/agent/background", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({
      machineId,
      message,
      sessionId: sessionId || undefined,
      ...(system !== undefined && system !== "" ? { system } : {}),
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to start" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchBackgroundStatus(jobId: string): Promise<BackgroundStatus> {
  return api<BackgroundStatus>(`/agent/background/${jobId}`);
}
