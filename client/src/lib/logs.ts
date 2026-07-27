export type LogCategory = "runtime" | "agent" | "git" | "ssh" | "error" | "deployment";
export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  id: string;
  userId: string;
  category: LogCategory;
  level: LogLevel;
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface LogSearchParams {
  category?: LogCategory;
  level?: LogLevel;
  query?: string;
  limit?: number;
  offset?: number;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchLogs(params: LogSearchParams = {}): Promise<LogEntry[]> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", params.category);
  if (params.level) query.set("level", params.level);
  if (params.query) query.set("query", params.query);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));

  const res = await fetch(`${API_BASE}/api/logs?${query}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch logs");
  return res.json();
}

export async function ingestLog(entry: {
  category: LogCategory;
  level?: LogLevel;
  message: string;
  source?: string;
  metadata?: Record<string, unknown>;
}): Promise<LogEntry> {
  const res = await fetch(`${API_BASE}/api/logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error("Failed to ingest log");
  return res.json();
}

export function streamLogs(
  category?: LogCategory,
  onEntry?: (entry: LogEntry) => void,
  onError?: (error: string) => void
): () => void {
  const query = category ? `?category=${category}` : "";
  const eventSource = new EventSource(`${API_BASE}/api/logs/stream${query}`);

  const handler = (event: MessageEvent) => {
    if (event.data === "[DONE]") {
      eventSource.close();
      return;
    }
    try {
      const data = JSON.parse(event.data);
      if (data.error) {
        onError?.(data.error);
      } else {
        onEntry?.(data as LogEntry);
      }
    } catch {}
  };

  eventSource.addEventListener("message", handler);
  eventSource.onerror = () => {
    onError?.("SSE connection error");
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}

export async function exportLogs(
  format: "json" | "csv",
  category?: LogCategory
): Promise<void> {
  const query = new URLSearchParams({ format });
  if (category) query.set("category", category);

  const res = await fetch(`${API_BASE}/api/logs/export?${query}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to export logs");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `logs.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}
