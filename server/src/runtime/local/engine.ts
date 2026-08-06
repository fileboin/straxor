// ── Local Engine Runner ──
// Spawns `opencode serve` (or another engine) as a child process INSIDE a
// user's cloned workspace dir and exposes its HTTP port over Localhost.
// This is the "no VPS" transport: repo is local, engine is local.
//
// machineId convention for the local transport: "local:<engine>"
// e.g. "local:opencode", "local:crush" (engine defaults to "opencode").

import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import net from "net";
import { db } from "../../db/index.js";
import { repoConnections } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { getGitRemoteToken } from "../../adapters/git/remote/registry.js";
import { ensureWorkspace, type WorkspaceInfo } from "./workspace.js";
import { buildOpenCodeModelConfig } from "./opencode-model.js";
import { normalizeSlot, type RepoSlot } from "./shared-workspace.js";
import type { GitPlatformId } from "../../adapters/git/remote/adapter.js";

export type LocalEngineId = "opencode" | "crush";

export interface LocalEngineHandle {
  key: string;
  userId: string;
  engine: string;
  slot: RepoSlot;
  port: number;
  cwd: string;
  process: ChildProcess;
  startedAt: number;
}

const LOCAL_PREFIX = "local:";
const BASE_PORT = 4100;

// ── In-process registry ──

const handles = new Map<string, LocalEngineHandle>();
const logs = new Map<string, string>();

export function isLocalMachineId(machineId: string): boolean {
  return machineId.startsWith(LOCAL_PREFIX);
}

export function engineFromMachineId(machineId: string): string {
  const parts = machineId.slice(LOCAL_PREFIX.length).split(":");
  const engine = parts[0];
  return engine || "opencode";
}

export function slotFromMachineId(machineId: string): RepoSlot {
  const parts = machineId.slice(LOCAL_PREFIX.length).split(":");
  const slot = parts[1];
  return normalizeSlot(slot);
}

function log(key: string, line: string): void {
  const current = logs.get(key) || "";
  logs.set(key, (current + line + "\n").slice(-20000));
}

export function getLocalEngineLog(key: string): string {
  return logs.get(key) || "";
}

function resolveBin(engine: LocalEngineId): string {
  const envBin = process.env.OPENCODE_BIN || process.env.ENGINE_BIN;
  if (envBin) return envBin;
  if (engine === "crush") return process.platform === "win32" ? "crush.cmd" : "crush";
  if (process.platform === "win32") {
    const candidate = path.join(process.env.APPDATA || "", "npm", "opencode.cmd");
    if (fs.existsSync(candidate)) return candidate;
    return "opencode";
  }
  return "opencode";
}

export { resolveBin };

function findFreePort(start: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => {
      probe.close();
      resolve(findFreePort(start + 1));
    });
    probe.listen(start, "127.0.0.1", () => {
      const port = (probe.address() as net.AddressInfo).port;
      probe.close(() => resolve(port));
    });
    probe.once("error", reject);
  });
}

async function getActiveRepo(userId: string, slot: RepoSlot) {
  const rows = await db
    .select()
    .from(repoConnections)
    .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true), eq(repoConnections.slot, slot)))
    .limit(1);
  return rows[0];
}

export async function getLocalEngineKey(userId: string, engine: string, slot?: string | null): Promise<string> {
  const normalized = normalizeSlot(slot);
  const repo = await getActiveRepo(userId, normalized);
  const fullName = repo ? repo.fullName : "no-repo";
  return `${userId}:${engine}:${normalized}:${fullName}`;
}

export async function ensureLocalEngine(userId: string, engine: string, slot?: string | null): Promise<LocalEngineHandle> {
  const normalized = (engine || "opencode").toLowerCase() as LocalEngineId;
  const panelSlot = normalizeSlot(slot);
  const key = await getLocalEngineKey(userId, normalized, panelSlot);
  const existing = handles.get(key);
  if (existing && existing.process.exitCode === null) {
    const alive = await isPortOpen(existing.port);
    if (alive) return existing;
    stopHandle(existing);
  }

  const repo = await getActiveRepo(userId, panelSlot);
  if (!repo) throw new Error("No active repo — connect a GitHub repo for this panel");

  // TEST ONLY: allow overriding the stored (encrypted) token with a temporary
  // PAT via env, so the agent↔repo pipeline can be verified without touching
  // the DB or existing tokens. Remove once real token flow is confirmed.
  const testToken = process.env.STRAXOR_TEST_GITHUB_TOKEN;
  const token = testToken || (await getGitRemoteToken(userId, repo.platform as GitPlatformId));
  if (!token) throw new Error("Platform token missing — save a token first");

  const ws: WorkspaceInfo = await ensureWorkspace({
    userId,
    platform: repo.platform,
    owner: repo.owner,
    name: repo.name,
    fullName: repo.fullName,
    cloneUrl: repo.cloneUrl,
    defaultBranch: repo.defaultBranch,
    token,
  });

  const port = await findFreePort(BASE_PORT + Math.abs(hashCode(key) % 1000));
  const bin = resolveBin(normalized);
  const args = normalized === "crush" ? ["serve", "--port", String(port)] : ["serve", "--port", String(port)];
  const logFile = path.join(ws.dir, ".straxor-engine.log");

  // Feed the OpenCode engine an active AI model from the user's stored keys.
  // Without this the engine is spawned with NO provider -> "empty gap".
  const modelCfg = await buildOpenCodeModelConfig(userId);
  if (normalized === "opencode" && modelCfg.provider === "none") {
    throw new Error(
      "No AI provider key configured for this account. Add an OpenRouter, DeepSeek, Anthropic, OpenAI, or Google key before starting the agent."
    );
  }
  const modelEnv = {
    ...process.env,
    PORT: String(port),
    OPENCODE_SERVER_PORT: String(port),
    OPENCODE_MODEL: `${modelCfg.provider}/${modelCfg.model}`,
    OPENCODE_SMALL_MODEL: `${modelCfg.provider}/${modelCfg.model}`,
    OPENCODE_CONFIG_CONTENT: modelCfg.configContent,
    GIT_AUTHOR_NAME: "Straxor Agent",
    GIT_AUTHOR_EMAIL: "agent@straxor.dev",
    GIT_COMMITTER_NAME: "Straxor Agent",
    GIT_COMMITTER_EMAIL: "agent@straxor.dev",
    ...modelCfg.env,
  };
  if (normalized === "opencode" && modelCfg.provider !== "none") {
    log(key, `[opencode-model] ${modelCfg.reason}`);
  }

  const child = spawn(bin, args, {
    cwd: ws.dir,
    shell: true,
    env: modelEnv,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const handle: LocalEngineHandle = {
    key,
    userId,
    engine: normalized,
    slot: panelSlot,
    port,
    cwd: ws.dir,
    process: child,
    startedAt: Date.now(),
  };
  handles.set(key, handle);

  const append = (chunk: Buffer) => {
    const text = chunk.toString();
    log(key, text);
    try { fs.appendFileSync(logFile, text); } catch {}
  };
  child.stdout?.on("data", append);
  child.stderr?.on("data", append);
  child.on("error", (err) => log(key, `[engine error] ${err.message}`));
  child.on("exit", (code, signal) => {
    log(key, `[engine exit] code=${code} signal=${signal}`);
    if (handles.get(key) === handle) handles.delete(key);
  });

  // Wait until the HTTP server is up.
  await waitForPort(port, 45_000);
  return handle;
}

export async function stopLocalEngine(userId: string, engine?: string, slot?: string | null): Promise<void> {
  const targetEngine = engine || "opencode";
  const targetSlot = normalizeSlot(slot);
  for (const handle of Array.from(handles.values())) {
    if (handle.userId === userId && handle.engine === targetEngine && handle.slot === targetSlot) {
      stopHandle(handle);
    }
  }
}

export async function stopLocalEnginesForUser(userId: string): Promise<void> {
  for (const handle of Array.from(handles.values())) {
    if (handle.userId === userId) stopHandle(handle);
  }
}

export function stopAllLocalEngines(): void {
  for (const handle of Array.from(handles.values())) stopHandle(handle);
  handles.clear();
}

function stopHandle(handle: LocalEngineHandle): void {
  try {
    handle.process.kill();
  } catch {}
  try {
    handle.process.kill("SIGKILL");
  } catch {}
  handles.delete(handle.key);
  setTimeout(() => {
    try { handle.process.kill("SIGKILL"); } catch {}
  }, 2000).unref();
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host: "127.0.0.1" });
    sock.setTimeout(1500);
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", () => resolve(false));
    sock.once("timeout", () => { sock.destroy(); resolve(false); });
  });
}

function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (await isPortOpen(port)) return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Engine did not start listening on port ${port} within ${timeoutMs}ms`));
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
