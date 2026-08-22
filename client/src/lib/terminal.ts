// ── Interactive Terminal client ──
// Talks to the server Terminal/Process API (POST /api/terminal/start,
// GET /api/terminal, POST /api/terminal/:id/cancel, GET /api/terminal/:id/stream)
// so the Terminal tab runs REAL commands in the workspace sandbox instead of
// showing static logs.

export type TerminalProcessStatus = "running" | "finished" | "failed" | "cancelled" | "timeout";

export interface TerminalProcess {
  id: string;
  userId: string;
  command: string;
  args: string[];
  cwd: string;
  pid: number | null;
  taskId: string | null;
  status: TerminalProcessStatus;
  exitCode: number | null;
  signal: string | null;
  startedAt: number;
  finishedAt: number | null;
  stdout: string;
  stderr: string;
}

export interface TerminalStartInput {
  owner?: string | null;
  name?: string | null;
  command: string;
  args?: string[];
  taskId?: string | null;
  timeoutMs?: number;
  cwd?: string;
  slot?: string;
}

export interface TerminalStartResult {
  processId: string;
  status: string;
  startedAt: number;
}

export interface TerminalEvent {
  processId: string;
  type: "stdout" | "stderr" | "exit";
  data?: string;
  exitCode?: number | null;
  signal?: string | null;
  status?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function startTerminal(
  input: TerminalStartInput
): Promise<TerminalStartResult> {
  const res = await fetch(`${API_BASE}/api/terminal/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      owner: input.owner || undefined,
      name: input.name || undefined,
      command: input.command,
      args: input.args || [],
      taskId: input.taskId ?? undefined,
      timeoutMs: input.timeoutMs,
      cwd: input.cwd,
      slot: input.slot,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listTerminalProcesses(): Promise<TerminalProcess[]> {
  const res = await fetch(`${API_BASE}/api/terminal`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getTerminalProcess(id: string): Promise<TerminalProcess | null> {
  const res = await fetch(`${API_BASE}/api/terminal/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function cancelTerminal(id: string, signal = "SIGTERM"): Promise<boolean> {
  const res = await fetch(`${API_BASE}/api/terminal/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ signal }),
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => ({ success: false }));
  return !!data.success;
}

// Open an SSE stream for a process. Replays buffered output first, then live
// stdout/stderr until the exit event. Returns a cleanup function.
export function streamTerminal(
  id: string,
  onEvent: (event: TerminalEvent) => void,
  onError?: (error: string) => void
): () => void {
  const controller = new AbortController();
  const token = localStorage.getItem("token");

  void (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/terminal/${encodeURIComponent(id)}/stream`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      if (!res.ok) {
        onError?.(`HTTP ${res.status}`);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        onError?.("Nema stream-a");
        return;
      }
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          try {
            const event = JSON.parse(data) as TerminalEvent;
            onEvent(event);
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      onError?.((err as Error)?.message || "Stream greška");
    }
  })();

  return () => controller.abort();
}