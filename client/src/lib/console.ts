export type ConsoleCategory = "build" | "runtime" | "browser" | "terminal" | "stack";
export type ConsoleLevel = "error" | "warn" | "info" | "debug";

export interface ConsoleEntry {
  id: string;
  userId: string;
  category: ConsoleCategory;
  level: ConsoleLevel;
  message: string;
  source?: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchConsoleEntries(
  params: Record<string, unknown> = {}
): Promise<ConsoleEntry[]> {
  const query = new URLSearchParams();
  if (params.category) query.set("category", String(params.category));
  if (params.level) query.set("level", String(params.level));
  if (params.query) query.set("query", String(params.query));
  if (params.limit) query.set("limit", String(params.limit));

  const res = await fetch(`${API_BASE}/api/console?${query}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch console entries");
  return res.json();
}

export async function ingestConsoleEntry(entry: {
  category: ConsoleCategory;
  level?: ConsoleLevel;
  message: string;
  source?: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}): Promise<ConsoleEntry> {
  const res = await fetch(`${API_BASE}/api/console`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error("Failed to ingest console entry");
  return res.json();
}

export function streamConsoleEntries(
  category?: ConsoleCategory,
  onEntry?: (entry: ConsoleEntry) => void,
  onError?: (error: string) => void
): () => void {
  const query = category ? `?category=${category}` : "";
  const eventSource = new EventSource(`${API_BASE}/api/console/stream${query}`);

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
        onEntry?.(data as ConsoleEntry);
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

export async function clearConsoleEntries(): Promise<void> {
  await fetch(`${API_BASE}/api/console`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}
