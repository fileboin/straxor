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
