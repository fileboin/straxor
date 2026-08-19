export type PreviewTarget =
  | "local"
  | "vps"
  | "docker"
  | "render"
  | "railway"
  | "flyio"
  | "vercel"
  | "netlify";

export type DeviceSize = "desktop" | "tablet" | "mobile";

export interface DevicePreset {
  id: DeviceSize;
  label: string;
  width: number;
  height: number;
  icon: string;
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: "desktop", label: "Desktop", width: 1280, height: 800, icon: "🖥" },
  { id: "tablet", label: "Tablet", width: 768, height: 1024, icon: "📋" },
  { id: "mobile", label: "Mobitel", width: 375, height: 812, icon: "📱" },
];

export interface PreviewStatus {
  running: boolean;
  url: string | null;
  internalUrl: string | null;
  target: PreviewTarget;
  port: number;
  pid: number | null;
  uptime: number | null;
  framework: string | null;
  error: string | null;
}

export interface PreviewLog {
  timestamp: number;
  level: "info" | "warn" | "error" | "stdout" | "stderr";
  message: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function startPreview(config: {
  machineId: string;
  target?: PreviewTarget;
  port?: number;
  rootPath?: string;
  framework?: string;
  devCommand?: string;
}): Promise<PreviewStatus> {
  const res = await fetch(`${API_BASE}/api/preview/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Greška pri pokretanju previewa");
  return res.json();
}

export async function stopPreview(machineId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/preview/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ machineId }),
  });
  if (!res.ok) throw new Error("Greška pri zaustavljanju previewa");
}

export async function getPreviewStatus(machineId: string): Promise<PreviewStatus> {
  const res = await fetch(`${API_BASE}/api/preview/status?machineId=${machineId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Greška pri dohvaćanju statusa");
  return res.json();
}

export async function getPreviewLogs(machineId: string, limit?: number): Promise<PreviewLog[]> {
  const params = new URLSearchParams({ machineId });
  if (limit) params.set("limit", String(limit));
  const res = await fetch(`${API_BASE}/api/preview/logs?${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Greška pri dohvaćanju logova");
  return res.json();
}

export async function detectFramework(machineId: string, rootPath?: string): Promise<string | null> {
  const params = new URLSearchParams({ machineId });
  if (rootPath) params.set("rootPath", rootPath);
  const res = await fetch(`${API_BASE}/api/preview/framework?${params}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.framework;
}

// ── Local preview (no VPS — dev server spawned inside the server process) ──
// The public `url` is a same-origin reverse-proxy path (/api/preview/proxy/…)
// so the iframe works both locally and in production on Render.

const COOKIE_NAME = "straxor_preview";

export interface LocalPreviewStatus {
  previewId: string;
  state: "starting" | "running" | "crashed" | "stopped" | "error";
  port: number | null;
  internalUrl: string | null;
  url: string | null;
  pid: number | null;
  processId: string | null;
  command: string;
  startedAt: number | null;
  readyAt: number | null;
  health: "ok" | "unreachable" | "unknown";
  restarts: number;
  lastError: string | null;
}

export function toPreviewStatus(info: LocalPreviewStatus): PreviewStatus {
  return {
    running: info.state === "running",
    url: info.url,
    internalUrl: info.internalUrl,
    target: "local",
    port: info.port ?? 0,
    pid: info.pid,
    uptime: info.readyAt ? Date.now() - info.readyAt : null,
    framework: null,
    error: info.lastError,
  };
}

export interface LocalPreviewParams {
  owner: string;
  name: string;
  taskId?: string | null;
  devCommand?: string;
  args?: string[];
  port?: number;
  envVars?: Record<string, string>;
}

async function localApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Preview API error");
  }
  return res.json();
}

export async function startLocalPreview(p: LocalPreviewParams): Promise<PreviewStatus> {
  const info = await localApi<LocalPreviewStatus>("/api/preview/start", {
    method: "POST",
    body: JSON.stringify({ target: "local", ...p }),
  });
  return toPreviewStatus(info);
}

export async function getLocalPreviewStatus(p: LocalPreviewParams): Promise<PreviewStatus> {
  const params = new URLSearchParams({ target: "local", owner: p.owner, name: p.name });
  if (p.taskId) params.set("taskId", p.taskId);
  const info = await localApi<LocalPreviewStatus>(`/api/preview/status?${params}`);
  return toPreviewStatus(info);
}

export async function stopLocalPreview(p: LocalPreviewParams): Promise<void> {
  await localApi("/api/preview/stop", {
    method: "POST",
    body: JSON.stringify({ target: "local", ...p }),
  });
}

export async function restartLocalPreview(p: LocalPreviewParams): Promise<PreviewStatus> {
  const info = await localApi<LocalPreviewStatus>("/api/preview/restart", {
    method: "POST",
    body: JSON.stringify({ target: "local", ...p }),
  });
  return toPreviewStatus(info);
}

export async function getLocalPreviewLogs(p: LocalPreviewParams, limit?: number): Promise<PreviewLog[]> {
  const params = new URLSearchParams({ target: "local", owner: p.owner, name: p.name });
  if (p.taskId) params.set("taskId", p.taskId);
  if (limit) params.set("limit", String(limit));
  return localApi<PreviewLog[]>(`/api/preview/logs?${params}`);
}

export async function detectLocalFramework(p: LocalPreviewParams): Promise<string | null> {
  const params = new URLSearchParams({ target: "local", owner: p.owner, name: p.name });
  const data = await localApi<{ framework: string | null }>(`/api/preview/framework?${params}`);
  return data.framework;
}

/**
 * Whether an iframe src is served through the same-origin preview proxy. When
 * true the previewed app shares the origin with Straxor, so the sandbox must
 * NOT include allow-same-origin (the previewed app must not read Straxor's
 * localStorage/auth token).
 */
export function isProxyPreviewUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith("/api/preview/proxy/");
}

export function previewCookieName(): string {
  return COOKIE_NAME;
}

export const TARGET_LABELS: Record<PreviewTarget, string> = {
  local: "Lokalno",
  vps: "VPS",
  docker: "Docker",
  render: "Render",
  railway: "Railway",
  flyio: "Fly.io",
  vercel: "Vercel",
  netlify: "Netlify",
};

export const TARGET_ICONS: Record<PreviewTarget, string> = {
  local: "💻",
  vps: "🖥",
  docker: "🐳",
  render: "🎨",
  railway: "🚂",
  flyio: "🦅",
  vercel: "▲",
  netlify: "◈",
};
