export type DeploymentStatus = "building" | "running" | "failed" | "stopped";
export type DeploymentTarget = "vps" | "docker" | "render" | "railway" | "vercel" | "netlify" | "cloudflare";

export interface Deployment {
  id: string;
  projectId: string;
  target: DeploymentTarget;
  status: DeploymentStatus;
  liveUrl: string | null;
  branch: string;
  commitHash: string | null;
  commitMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  duration: number | null;
  createdAt: string;
}

export interface BuildLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchDeployments(projectId: string): Promise<Deployment[]> {
  const res = await fetch(`${API_BASE}/api/deployments/${projectId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch deployments");
  return res.json();
}

export async function triggerDeployment(
  projectId: string,
  target: DeploymentTarget,
  branch?: string
): Promise<Deployment> {
  const res = await fetch(`${API_BASE}/api/deployments/${projectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ target, branch }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed" }));
    throw new Error(err.error || "Failed to trigger deployment");
  }
  return res.json();
}

export async function fetchDeployment(deploymentId: string): Promise<Deployment> {
  const res = await fetch(`${API_BASE}/api/deployments/detail/${deploymentId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch deployment");
  return res.json();
}

export async function fetchBuildLog(deploymentId: string): Promise<BuildLogEntry[]> {
  const res = await fetch(`${API_BASE}/api/deployments/log/${deploymentId}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch build log");
  return res.json();
}

export async function stopDeployment(deploymentId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/deployments/stop/${deploymentId}`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to stop deployment");
}

export const TARGET_LABELS: Record<DeploymentTarget, string> = {
  vps: "VPS",
  docker: "Docker",
  render: "Render",
  railway: "Railway",
  vercel: "Vercel",
  netlify: "Netlify",
  cloudflare: "Cloudflare Pages",
};

export const STATUS_COLORS: Record<DeploymentStatus, string> = {
  building: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  running: "text-green-400 bg-green-500/10 border-green-500/20",
  failed: "text-red-400 bg-red-500/10 border-red-500/20",
  stopped: "text-text-muted bg-surface-2 border-border",
};

export const STATUS_ICONS: Record<DeploymentStatus, string> = {
  building: "⟳",
  running: "●",
  failed: "✕",
  stopped: "■",
};
