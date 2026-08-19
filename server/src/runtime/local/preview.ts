// ── Local Live Preview (Iteration 3) ──
// Starts a dev server in a repo sandbox via the TerminalManager, detects the
// port from stdout, waits until it accepts connections on localhost/127.0.0.1,
// health-checks it, detects crashes, supports restart and enforces
// MAX_PREVIEW_TIME. One preview instance per (user, repo, task).

import fs from "fs";
import http from "http";
import net from "net";
import path from "path";
import { getConfig } from "../../lib/config.js";
import {
  cancelTerminalProcess,
  getTerminalProcess,
  startTerminalProcess,
  subscribeToTerminal,
} from "../../lib/terminal.js";
import { getRepoWorkspaceDir } from "./workspace.js";
import { buildPreviewUrl } from "./preview-proxy.js";
import { dispatchWebhook } from "../../lib/webhooks.js";

export type LocalPreviewState = "starting" | "running" | "crashed" | "stopped" | "error";

export interface LocalPreviewInfo {
  previewId: string;
  state: LocalPreviewState;
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

export interface LocalPreviewStartInput {
  userId: string;
  owner: string;
  name: string;
  taskId?: string | null;
  command?: string;
  args?: string[];
  port?: number;
  env?: Record<string, string>;
}

interface PreviewEntry {
  info: LocalPreviewInfo;
  logs: string[];
  detectedPort: number | null;
  stopRequested: boolean;
  healthTimer: NodeJS.Timeout | null;
  unsub: (() => void) | null;
  userId: string;
}

const MAX_LOGS = 300;
const previews = new Map<string, PreviewEntry>();

function npmBin(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function previewKey(userId: string, owner: string, name: string, taskId?: string | null): string {
  return `${userId}:${owner}__${name}:${taskId ?? "default"}`;
}

/**
 * Extract a listening port from a dev-server stdout line. Covers the common
 * formats (Vite, CRA, Next, plain Node, Express), including the common ports
 * 3000 / 4173 / 5173 / 8080 and any custom port.
 */
export function detectPortFromText(text: string): number | null {
  const patterns: RegExp[] = [
    /(?:Local|Network|Preview|url):\s*https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})/i,
    /https?:\/\/(?:localhost|127\.0\.0\.1):(\d{2,5})/i,
    /listening on(?: port)?\s*:?\s*(\d{2,5})/i,
    /(?:localhost|127\.0\.0\.1)\s*:\s*(\d{2,5})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const port = parseInt(m[1], 10);
      if (port >= 1 && port <= 65535) return port;
    }
  }
  return null;
}

function canConnect(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    sock.setTimeout(timeoutMs);
    sock.once("connect", () => {
      sock.destroy();
      resolve(true);
    });
    sock.once("error", () => resolve(false));
    sock.once("timeout", () => {
      sock.destroy();
      resolve(false);
    });
  });
}

/** Both localhost and 127.0.0.1 are probed (the plan requires verifying both). */
export async function isPortOpen(port: number): Promise<boolean> {
  return (await canConnect("127.0.0.1", port)) || (await canConnect("localhost", port));
}

async function httpHealth(port: number): Promise<boolean> {
  const tryHost = (host: string) =>
    new Promise<boolean>((resolve) => {
      const req = http.get({ host, port, path: "/", timeout: 3000 }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on("error", () => resolve(false));
    });
  return (await tryHost("127.0.0.1")) || (await tryHost("localhost"));
}

export function findFreePort(start = 4173): Promise<number> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => {
      probe.close();
      resolve(findFreePort(start + 1));
    });
    probe.listen(start, "127.0.0.1", () => {
      const port = (probe.address() as net.AddressInfo).port;
      probe.close(() => resolve(port));
    });
  });
}

async function detectDevCommand(cwd: string): Promise<{ command: string; args: string[] } | null> {
  try {
    const raw = await fs.promises.readFile(path.join(cwd, "package.json"), "utf8");
    const scripts = (JSON.parse(raw) as { scripts?: Record<string, string> }).scripts || {};
    if (scripts.dev) return { command: npmBin(), args: ["run", "dev"] };
    if (scripts.start) return { command: npmBin(), args: ["run", "start"] };
    if (scripts.preview) return { command: npmBin(), args: ["run", "preview"] };
  } catch {
    // no package.json / unreadable — caller must supply an explicit command
  }
  return null;
}

function log(entry: PreviewEntry, line: string): void {
  entry.logs.push(line);
  if (entry.logs.length > MAX_LOGS) entry.logs.shift();
}

/**
 * Keep the public `url` pointing at the same-origin reverse proxy (works in
 * production on Render, where the browser cannot reach this server's
 * localhost). Regenerated on every read so the signed cookie stays fresh.
 */
function syncProxyUrl(entry: PreviewEntry): void {
  if (entry.info.state === "running" && entry.info.port) {
    entry.info.url = buildPreviewUrl(entry.info.previewId);
  }
}

function baseInfo(key: string, command: string): LocalPreviewInfo {
  return {
    previewId: key,
    state: "starting",
    port: null,
    internalUrl: null,
    url: null,
    pid: null,
    processId: null,
    command,
    startedAt: null,
    readyAt: null,
    health: "unknown",
    restarts: 0,
    lastError: null,
  };
}

/** Phase 3 webhooks — notify external integrations of preview lifecycle. */
function dispatchPreviewEvent(
  userId: string,
  event: "preview.started" | "preview.stopped",
  info: LocalPreviewInfo
): void {
  void dispatchWebhook(userId, event, {
    previewId: info.previewId,
    state: info.state,
    port: info.port,
    url: info.url,
    command: info.command,
  });
}

export async function startPreview(input: LocalPreviewStartInput): Promise<LocalPreviewInfo> {
  const cfg = getConfig();
  const key = previewKey(input.userId, input.owner, input.name, input.taskId);
  const existing = previews.get(key);

  // Unique instance per task: an already-running preview is returned as-is.
  if (existing && (existing.info.state === "starting" || existing.info.state === "running")) {
    syncProxyUrl(existing);
    return existing.info;
  }

  const cwd = getRepoWorkspaceDir(input.userId, input.owner, input.name);
  const resolved = input.command
    ? { command: input.command, args: input.args ?? [] }
    : await detectDevCommand(cwd);

  if (!resolved) {
    const info = baseInfo(key, "");
    info.state = "error";
    info.lastError = "No dev command found — add a dev/start/preview script to package.json or pass an explicit command";
    previews.set(key, { info, logs: [], detectedPort: null, stopRequested: false, healthTimer: null, unsub: null, userId: input.userId });
    return info;
  }

  // Prefer a requested port, otherwise reserve a free one and pass it via PORT
  // so frameworks that read env still bind predictably.
  const assignedPort = input.port ?? (await findFreePort(4173));
  const entry: PreviewEntry = {
    info: baseInfo(key, `${resolved.command} ${resolved.args.join(" ")}`.trim()),
    logs: [],
    detectedPort: input.port ?? null,
    stopRequested: false,
    healthTimer: null,
    unsub: null,
    userId: input.userId,
  };
  entry.info.port = assignedPort;
  entry.info.internalUrl = `http://localhost:${assignedPort}`;
  entry.info.url = entry.info.internalUrl;
  entry.info.startedAt = Date.now();
  previews.set(key, entry);

  try {
    const { processId } = startTerminalProcess({
      userId: input.userId,
      cwd,
      command: resolved.command,
      args: resolved.args,
      taskId: input.taskId ?? null,
      scope: `preview:${key}`,
      timeoutMs: cfg.maxPreviewTimeMs,
      env: {
        PORT: String(assignedPort),
        HOST: "0.0.0.0",
        ...(input.env ?? {}),
      },
    });
    entry.info.processId = processId;
    entry.info.pid = getTerminalProcess(processId)?.pid ?? null;

    // Live output → logs + port detection.
    entry.unsub = subscribeToTerminal(processId, (event) => {
      if (event.data) {
        log(entry, event.data);
        const detected = detectPortFromText(event.data);
        if (detected && !entry.detectedPort) {
          entry.detectedPort = detected;
          entry.info.port = detected;
          entry.info.internalUrl = `http://localhost:${detected}`;
          entry.info.url = entry.info.internalUrl;
        }
      }
      if (event.type === "exit") {
        if (entry.healthTimer) clearInterval(entry.healthTimer);
        if (!entry.stopRequested) {
          if (event.status === "timeout") {
            entry.info.state = "stopped";
            entry.info.lastError = "Preview exceeded MAX_PREVIEW_TIME and was stopped";
          } else {
            entry.info.state = "crashed";
            entry.info.lastError = `Preview process exited (code ${event.exitCode ?? "null"}, signal ${event.signal ?? "none"})`;
          }
          dispatchPreviewEvent(entry.userId, "preview.stopped", entry.info);
        }
      }
    });

    // Poll until the server accepts connections on localhost/127.0.0.1.
    const deadline = Date.now() + cfg.maxPreviewStartupMs;
    entry.healthTimer = setInterval(async () => {
      if (entry.info.state === "crashed" || entry.info.state === "stopped" || entry.info.state === "error") {
        clearInterval(entry.healthTimer!);
        return;
      }
      const port = entry.detectedPort ?? assignedPort;
      const open = await isPortOpen(port);
      if (open) {
        entry.info.state = "running";
        entry.info.readyAt = Date.now();
        entry.info.health = (await httpHealth(port)) ? "ok" : "unreachable";
        syncProxyUrl(entry);
        clearInterval(entry.healthTimer!);
        dispatchPreviewEvent(entry.userId, "preview.started", entry.info);
      } else if (Date.now() > deadline) {
        entry.info.state = "error";
        entry.info.health = "unreachable";
        entry.info.lastError = `Dev server did not start listening on port ${port} within MAX_PREVIEW_STARTUP`;
        clearInterval(entry.healthTimer!);
        cancelTerminalProcess(processId, "SIGKILL");
      }
    }, 250);

    return entry.info;
  } catch (error) {
    entry.info.state = "error";
    entry.info.lastError = error instanceof Error ? error.message : String(error);
    return entry.info;
  }
}

export async function stopPreview(key: string): Promise<LocalPreviewInfo | null> {
  const entry = previews.get(key);
  if (!entry) return null;
  entry.stopRequested = true;
  if (entry.healthTimer) clearInterval(entry.healthTimer);
  if (entry.info.processId) cancelTerminalProcess(entry.info.processId, "SIGTERM");
  entry.info.state = "stopped";
  dispatchPreviewEvent(entry.userId, "preview.stopped", entry.info);
  return entry.info;
}

export async function restartPreview(input: LocalPreviewStartInput): Promise<LocalPreviewInfo> {
  const key = previewKey(input.userId, input.owner, input.name, input.taskId);
  const previous = previews.get(key);
  if (previous) {
    previous.info.restarts += 1;
    await stopPreview(key);
  }
  const info = await startPreview(input);
  if (previous) info.restarts = previous.info.restarts;
  return info;
}

export function getPreviewInfo(key: string): LocalPreviewInfo | null {
  const entry = previews.get(key);
  if (!entry) return null;
  syncProxyUrl(entry);
  return entry.info;
}

/** Re-check liveness/health of a running preview (crash detection on poll). */
export async function refreshPreviewStatus(key: string): Promise<LocalPreviewInfo | null> {
  const entry = previews.get(key);
  if (!entry) return null;
  if (entry.info.state === "running" && entry.info.port) {
    const open = await isPortOpen(entry.info.port);
    if (!open) {
      entry.info.state = "crashed";
      entry.info.lastError = "Dev server stopped responding on its port";
    } else {
      entry.info.health = (await httpHealth(entry.info.port)) ? "ok" : "unreachable";
      syncProxyUrl(entry);
    }
  }
  return entry.info;
}

/** Detect the web framework from a workspace package.json (best-effort). */
export async function detectLocalFramework(cwd: string): Promise<string | null> {
  try {
    const raw = await fs.promises.readFile(path.join(cwd, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    if (all.next) return "next";
    if (all.nuxt) return "nuxt";
    if (all.svelte || all["@sveltejs/kit"]) return "svelte";
    if (all.vue) return "vue";
    if (all["react-scripts"]) return "react";
    if (all.vite) return "vite";
    return null;
  } catch {
    return null;
  }
}

export function getPreviewLogs(key: string, limit?: number): string[] {
  const entry = previews.get(key);
  if (!entry) return [];
  return limit ? entry.logs.slice(-limit) : entry.logs;
}

export function listPreviews(userId: string): LocalPreviewInfo[] {
  const prefix = `${userId}:`;
  return Array.from(previews.entries())
    .filter(([k]) => k.startsWith(prefix))
    .map(([, e]) => {
      syncProxyUrl(e);
      return e.info;
    });
}

export async function stopAllPreviews(): Promise<number> {
  const keys = Array.from(previews.keys());
  for (const key of keys) await stopPreview(key);
  return keys.length;
}

export function clearPreviews(): void {
  for (const entry of previews.values()) {
    if (entry.healthTimer) clearInterval(entry.healthTimer);
    if (entry.unsub) entry.unsub();
  }
  previews.clear();
}

export function previewCount(): number {
  return previews.size;
}
