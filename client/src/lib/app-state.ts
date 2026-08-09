export interface AppStateShape {
  version?: number;
  [key: string]: unknown;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingState: AppStateShape | null = null;

const SAVE_DELAY = 2500;
const LOCAL_MIRROR_KEY = "straxor.appState.mirror";
const LOCAL_MIRROR_TS_KEY = "straxor.appState.mirror.ts";

function readMirrorTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function safeLocalSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore quota/private-mode failures.
  }
}

function writeLocalMirror(state: AppStateShape): AppStateShape {
  const stampedState: AppStateShape = {
    ...state,
    localMirrorSavedAt: Date.now(),
  };
  safeLocalSet(LOCAL_MIRROR_KEY, JSON.stringify(stampedState));
  safeLocalSet(LOCAL_MIRROR_TS_KEY, String(stampedState.localMirrorSavedAt));
  return stampedState;
}

function readLocalMirror(): AppStateShape {
  try {
    const raw = localStorage.getItem(LOCAL_MIRROR_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AppStateShape;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function pickNewerState(remoteState: AppStateShape, mirrorState: AppStateShape): AppStateShape {
  const remoteTs = readMirrorTimestamp(remoteState.localMirrorSavedAt);
  const mirrorTs = readMirrorTimestamp(mirrorState.localMirrorSavedAt);
  if (!remoteState || typeof remoteState !== "object") return mirrorState;
  if (!mirrorState || typeof mirrorState !== "object") return remoteState;
  return mirrorTs > remoteTs ? mirrorState : remoteState;
}

async function push(state: AppStateShape): Promise<void> {
  const mirroredState = writeLocalMirror(state);
  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/app-state", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ state: mirroredState }),
    });
    if (!res.ok) throw new Error(`app-state save failed: ${res.status}`);
  } catch {
    // Silent — persistence is best-effort; localStorage mirror is the fallback.
  }
}

export function saveAppState(state: AppStateShape): void {
  pendingState = writeLocalMirror(state);
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    const toSend = pendingState;
    pendingState = null;
    saveTimer = null;
    if (toSend) void push(toSend);
  }, SAVE_DELAY);
}

export function saveAppStateNow(state: AppStateShape): void {
  pendingState = writeLocalMirror(state);
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  void push(pendingState);
}

export async function loadAppState(): Promise<AppStateShape> {
  const mirrorState = readLocalMirror();
  try {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/app-state", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return mirrorState;
    const data = (await res.json()) as { state?: AppStateShape };
    const remoteState = data.state && typeof data.state === "object" ? data.state : {};
    return pickNewerState(remoteState, mirrorState);
  } catch {
    return mirrorState;
  }
}
