import { api } from "./api.js";

// ── Types ──

export type RuntimeId =
  | "opencode"
  | "crush"
  | "free-claude-code"
  | "claude-code"
  | "codex"
  | "gemini-cli"
  | "cline"
  | "continue"
  | "goose"
  | "qwen-code"
  | "acp"
  | "openhands"
  | "deerflow"
  | "voltagent"
  | "langgraph"
  | "crewai"
  | "autogen"
  | "agentarius"
  | "custom";

export type RuntimeChannel = "stable" | "beta" | "custom";

export type RuntimeHealthStatus = "healthy" | "degraded" | "down" | "unknown";

export interface RuntimeDefinition {
  id: RuntimeId;
  name: string;
  description: string;
  icon: string;
  color: string;
  version?: string;
  installCommand?: string;
  repoUrl?: string;
  isInstalled: boolean;
  isEnabled: boolean;
  isActive?: boolean;
  health?: RuntimeHealth | null;
}

export interface RuntimeHealth {
  status: RuntimeHealthStatus;
  running: boolean;
  sshConnected: boolean;
  port: number | null;
  version?: string;
  uptime?: string;
  pid?: number;
  lastError?: string;
  lastCheck?: string;
}

export interface RuntimeSession {
  id: string;
  title: string;
  createdAt: string;
  runtimeId: RuntimeId;
  model?: string;
  provider?: string;
  messageCount?: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  defaultModel?: string;
  isEnabled: boolean;
}

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  isEnabled: boolean;
}

// ── Labels ──

export const RUNTIME_ICONS: Record<RuntimeId, string> = {
  opencode: "◇",
  crush: "💎",
  "free-claude-code": "🆓",
  "claude-code": "◆",
  codex: "◉",
  "gemini-cli": "◇",
  cline: "⚡",
  continue: "▶",
  goose: "🪿",
  "qwen-code": "🐉",
  acp: "🔌",
  openhands: "✋",
  deerflow: "🦌",
  voltagent: "⚡",
  langgraph: "🔗",
  crewai: "👥",
  autogen: "🔄",
  agentarius: "🌐",
  custom: "⚙",
};

export const RUNTIME_COLORS: Record<RuntimeId, string> = {
  opencode: "text-blue-400",
  crush: "text-purple-400",
  "free-claude-code": "text-yellow-400",
  "claude-code": "text-orange-400",
  codex: "text-green-400",
  "gemini-cli": "text-blue-400",
  cline: "text-cyan-400",
  continue: "text-emerald-400",
  goose: "text-amber-400",
  "qwen-code": "text-red-400",
  acp: "text-white",
  openhands: "text-blue-400",
  deerflow: "text-amber-400",
  voltagent: "text-yellow-400",
  langgraph: "text-green-400",
  crewai: "text-orange-400",
  autogen: "text-purple-400",
  agentarius: "text-cyan-400",
  custom: "text-gray-400",
};

export const HEALTH_COLORS: Record<RuntimeHealthStatus, string> = {
  healthy: "text-green-400",
  degraded: "text-yellow-400",
  down: "text-red-400",
  unknown: "text-gray-400",
};

export const HEALTH_BG: Record<RuntimeHealthStatus, string> = {
  healthy: "bg-green-500/10 border-green-500/30",
  degraded: "bg-yellow-500/10 border-yellow-500/30",
  down: "bg-red-500/10 border-red-500/30",
  unknown: "bg-gray-500/10 border-gray-500/30",
};

export const HEALTH_DOTS: Record<RuntimeHealthStatus, string> = {
  healthy: "bg-green-500",
  degraded: "bg-yellow-500",
  down: "bg-red-500",
  unknown: "bg-gray-500",
};

// ── API ──

export async function listRuntimes(): Promise<RuntimeDefinition[]> {
  return api("/runtimes");
}

export async function getActiveRuntime(): Promise<{
  id: RuntimeId;
  definition: RuntimeDefinition | null;
  health: RuntimeHealth | null;
}> {
  return api("/runtimes/active");
}

export async function switchRuntime(runtimeId: RuntimeId): Promise<{ ok: boolean; runtime: RuntimeDefinition }> {
  return api("/runtimes/switch", {
    method: "POST",
    body: JSON.stringify({ runtimeId }),
  });
}

export async function checkRuntimeHealth(machineId: string, runtimeId: RuntimeId): Promise<RuntimeHealth> {
  return api(`/runtimes/${runtimeId}/health?machineId=${machineId}`);
}

/**
 * Result of a VPS connection verification.
 * `vpsStatus` drives the topbar lamp. `"offline"` means the runtime is not
 * reachable / not running; `"reconnecting"` means we are about to (or are)
 * attempting an automatic reconnect.
 */
export interface VpsVerifyResult {
  vpsStatus: "ready" | "offline" | "reconnecting" | "error";
  health?: RuntimeHealth | null;
}

function isReachable(health: RuntimeHealth | null | undefined): boolean {
  if (!health) return false;
  return health.running === true;
}

/**
 * Verify that a VPS-bound runtime is actually alive before reporting "ready".
 *
 * 1. Calls GET /runtimes/opencode/health.
 * 2. If it returns running → ready.
 * 3. Otherwise → offline. NO automatic reconnect: reconnecting to a VPS is a
 *    MANUAL action the user takes from the SSH form / engine menu, never a
 *    silent background side-effect of restore or navigation.
 *
 * `machineId` is the concrete VPS machine id (never a `local:` id).
 */
export async function verifyVpsConnection(
  machineId: string,
  opts?: { timeoutMs?: number }
): Promise<VpsVerifyResult> {
  const timeout = opts?.timeoutMs ?? 12_000;

  let health: RuntimeHealth | null = null;
  try {
    health = await withTimeout(
      checkRuntimeHealth(machineId, "opencode"),
      timeout
    );
  } catch {
    health = null;
  }

  if (isReachable(health)) {
    return { vpsStatus: "ready", health };
  }

  // Not reachable → report offline. The user decides whether/when to reconnect
  // manually; the app never auto-triggers a VPS connection from the main loop.
  return { vpsStatus: "offline", health };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

export async function restartRuntime(machineId: string, runtimeId: RuntimeId): Promise<RuntimeHealth> {
  return api(`/runtimes/${runtimeId}/restart`, {
    method: "POST",
    body: JSON.stringify({ machineId }),
  });
}

export async function reconnectRuntime(machineId: string, runtimeId: RuntimeId): Promise<RuntimeHealth> {
  return api(`/runtimes/${runtimeId}/reconnect`, {
    method: "POST",
    body: JSON.stringify({ machineId }),
  });
}

export async function updateRuntime(
  machineId: string,
  runtimeId: RuntimeId,
  channel: RuntimeChannel,
  version?: string
): Promise<RuntimeHealth> {
  return api(`/runtimes/${runtimeId}/update`, {
    method: "POST",
    body: JSON.stringify({ machineId, channel, version }),
  });
}

export async function installRuntime(machineId: string, runtimeId: RuntimeId): Promise<void> {
  await api(`/runtimes/${runtimeId}/install`, {
    method: "POST",
    body: JSON.stringify({ machineId }),
  });
}

// Sessions

export async function createRuntimeSession(
  machineId: string,
  title: string,
  runtimeId?: RuntimeId
): Promise<RuntimeSession> {
  return api("/runtimes/sessions", {
    method: "POST",
    body: JSON.stringify({ machineId, title, runtimeId }),
  });
}

export async function listRuntimeSessions(
  machineId: string,
  runtimeId?: RuntimeId
): Promise<RuntimeSession[]> {
  const params = new URLSearchParams({ machineId });
  if (runtimeId) params.set("runtimeId", runtimeId);
  return api(`/runtimes/sessions?${params}`);
}

export async function sendRuntimeMessage(
  machineId: string,
  sessionId: string,
  text: string,
  opts?: { mode?: "sync" | "async"; systemPrompt?: string; runtimeId?: RuntimeId }
): Promise<{ parts?: unknown[] }> {
  return api(`/runtimes/sessions/${sessionId}/send`, {
    method: "POST",
    body: JSON.stringify({ machineId, text, ...opts }),
  });
}

export async function getRuntimeTodos(
  machineId: string,
  sessionId: string,
  runtimeId?: RuntimeId
): Promise<{ id: string; content: string; status: string }[]> {
  const params = new URLSearchParams({ machineId });
  if (runtimeId) params.set("runtimeId", runtimeId);
  return api(`/runtimes/sessions/${sessionId}/todos?${params}`);
}

export async function getRuntimeDiff(
  machineId: string,
  sessionId: string,
  runtimeId?: RuntimeId
): Promise<{ path: string; additions: string[]; deletions: string[] }[]> {
  const params = new URLSearchParams({ machineId });
  if (runtimeId) params.set("runtimeId", runtimeId);
  return api(`/runtimes/sessions/${sessionId}/diff?${params}`);
}

export async function abortRuntimeSession(
  machineId: string,
  sessionId: string,
  runtimeId?: RuntimeId
): Promise<boolean> {
  const res = await api<{ ok: boolean }>(`/runtimes/sessions/${sessionId}/abort`, {
    method: "POST",
    body: JSON.stringify({ machineId, runtimeId }),
  });
  return res.ok;
}

// Providers

export async function setRuntimeProvider(
  machineId: string,
  runtimeId: RuntimeId,
  config: ProviderConfig
): Promise<void> {
  await api("/runtimes/providers", {
    method: "POST",
    body: JSON.stringify({ machineId, runtimeId, ...config }),
  });
}

export async function getRuntimeProvider(
  machineId: string,
  runtimeId?: RuntimeId
): Promise<ProviderConfig | null> {
  const params = new URLSearchParams({ machineId });
  if (runtimeId) params.set("runtimeId", runtimeId);
  return api(`/runtimes/providers?${params}`);
}

// MCP

export async function listMCPServers(
  machineId: string,
  runtimeId?: RuntimeId
): Promise<MCPServerConfig[]> {
  const params = new URLSearchParams({ machineId });
  if (runtimeId) params.set("runtimeId", runtimeId);
  return api(`/runtimes/mcp?${params}`);
}

export async function addMCPServer(
  machineId: string,
  runtimeId: RuntimeId,
  config: MCPServerConfig
): Promise<void> {
  await api("/runtimes/mcp", {
    method: "POST",
    body: JSON.stringify({ machineId, runtimeId, ...config }),
  });
}

export async function removeMCPServer(
  machineId: string,
  serverId: string,
  runtimeId?: RuntimeId
): Promise<void> {
  const params = new URLSearchParams();
  if (runtimeId) params.set("runtimeId", runtimeId);
  params.set("machineId", machineId);
  await api(`/runtimes/mcp/${serverId}?${params}`, { method: "DELETE" });
}

// Shell

export async function execRuntimeCommand(
  machineId: string,
  command: string,
  runtimeId?: RuntimeId
): Promise<string> {
  const res = await api<{ stdout: string }>("/runtimes/exec", {
    method: "POST",
    body: JSON.stringify({ machineId, command, runtimeId }),
  });
  return res.stdout;
}
