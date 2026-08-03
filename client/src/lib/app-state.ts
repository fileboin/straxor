export interface AppStateShape {
  version?: number;
  [key: string]: unknown;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: AppStateShape | null = null;

const SAVE_DELAY = 2500;

async function push(state: AppStateShape): Promise<void> {
  try {
    const token = localStorage.getItem("token");
    await fetch("/api/app-state", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ state }),
    });
  } catch {
    // Silent — persistence is best-effort; localStorage remains a fallback.
  }
}

export function saveAppState(state: AppStateShape): void {
  pendingState = state;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    const toSend = pendingState;
    pendingState = null;
    saveTimer = null;
    if (toSend) void push(toSend);
  }, SAVE_DELAY);
}

export function saveAppStateNow(state: AppStateShape): void {
  pendingState = state;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  void push(state);
}

export async function loadAppState(): Promise<AppStateShape> {
  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/app-state", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { state?: AppStateShape };
    return data.state && typeof data.state === "object" ? data.state : {};
  } catch {
    return {};
  }
}
