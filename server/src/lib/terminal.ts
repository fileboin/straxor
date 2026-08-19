// ── Terminal / Process Manager (Iteration 2) ──
// Runs a command in a workspace directory as a child process with live
// stdout/stderr streaming, an enforced timeout, cancellation and per-scope
// concurrency protection. Every run is mirrored into the in-memory
// ProcessRegistry (Iteration 0) so the cleanup janitor can also reap orphans.

import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { getConfig } from "./config.js";
import {
  finishProcess,
  getProcess,
  listProcesses,
  registerProcess,
  type ProcessRecord,
} from "./process-registry.js";
import { dispatchWebhook } from "./webhooks.js";

export class TerminalBusyError extends Error {
  constructor(scope: string) {
    super(`Another process is already running in ${scope}`);
    this.name = "TerminalBusyError";
  }
}

export type TerminalStreamKind = "stdout" | "stderr";

export interface TerminalEvent {
  processId: string;
  type: TerminalStreamKind | "exit";
  data?: string;
  exitCode?: number | null;
  signal?: string | null;
  status?: string;
}

export interface TerminalStartInput {
  userId: string;
  cwd: string;
  command: string;
  args?: string[];
  taskId?: string | null;
  timeoutMs?: number;
  env?: Record<string, string>;
  /** Concurrency scope key. Defaults to `userId::cwd` (one command per sandbox). */
  scope?: string;
}

export interface TerminalStartResult {
  processId: string;
  status: string;
  startedAt: number;
}

interface TerminalEntry {
  child: ChildProcess;
  scope: string;
  stdout: string;
  stderr: string;
  timeout: NodeJS.Timeout | null;
  settled: boolean;
}

const entries = new Map<string, TerminalEntry>();
const runningScopes = new Set<string>();
const bus = new EventEmitter();
bus.setMaxListeners(200);

function defaultScope(userId: string, cwd: string): string {
  return `${userId}::${cwd}`;
}

function capBuffer(entry: TerminalEntry, maxBytes: number): void {
  const total = entry.stdout.length + entry.stderr.length;
  if (total <= maxBytes) return;
  const excess = total - maxBytes;
  // Drop the oldest bytes (stdout first) so a runaway process can't OOM us.
  if (entry.stdout.length >= excess) {
    entry.stdout = entry.stdout.slice(excess);
  } else {
    const rest = excess - entry.stdout.length;
    entry.stdout = "";
    entry.stderr = entry.stderr.slice(rest);
  }
}

/** Phase 3 webhooks — notify external integrations when a process exits. */
function dispatchTerminalExit(
  processId: string,
  status: string,
  exitCode: number | null,
  signal: string | null
): void {
  const rec = getProcess(processId);
  if (!rec?.userId) return;
  void dispatchWebhook(rec.userId, "terminal.process.exited", {
    processId: rec.id,
    taskId: rec.taskId,
    command: rec.command,
    status,
    exitCode,
    signal,
  });
}

export function startTerminalProcess(input: TerminalStartInput): TerminalStartResult {
  const cfg = getConfig();
  const scope = input.scope || defaultScope(input.userId, input.cwd);
  if (runningScopes.has(scope)) {
    throw new TerminalBusyError(scope);
  }

  const child = spawn(input.command, input.args ?? [], {
    cwd: input.cwd,
    env: { ...process.env, ...(input.env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell: false,
  });

  const rec = registerProcess({
    taskId: input.taskId ?? null,
    userId: input.userId,
    command: input.command,
    args: input.args ?? [],
    cwd: input.cwd,
    pid: child.pid ?? null,
    handle: {
      pid: child.pid ?? undefined,
      kill: (signal) => {
        try {
          child.kill(signal);
          return true;
        } catch {
          return false;
        }
      },
    },
  });

  const entry: TerminalEntry = {
    child,
    scope,
    stdout: "",
    stderr: "",
    timeout: null,
    settled: false,
  };
  entries.set(rec.id, entry);
  runningScopes.add(scope);

  const append = (buf: Buffer | string, kind: TerminalStreamKind) => {
    const text = Buffer.isBuffer(buf) ? buf.toString() : String(buf);
    if (!text) return;
    if (kind === "stdout") entry.stdout += text;
    else entry.stderr += text;
    capBuffer(entry, cfg.maxProcessOutputBytes);
    bus.emit("event", { processId: rec.id, type: kind, data: text } satisfies TerminalEvent);
  };

  child.stdout?.on("data", (d) => append(d, "stdout"));
  child.stderr?.on("data", (d) => append(d, "stderr"));

  const settle = (status: string, exitCode: number | null, signal: string | null) => {
    if (entry.settled) return;
    entry.settled = true;
    if (entry.timeout) clearTimeout(entry.timeout);
    finishProcess(rec.id, { status: status as ProcessRecord["status"], exitCode, signal });
    bus.emit("event", {
      processId: rec.id,
      type: "exit",
      exitCode,
      signal,
      status,
    } satisfies TerminalEvent);
    dispatchTerminalExit(rec.id, status, exitCode, signal);
  };

  // "close" fires after stdout/stderr streams are fully drained, so buffered
  // output is complete by the time we record the exit.
  child.on("close", (code, signal) => {
    settle(code === 0 ? "finished" : "failed", code, signal ?? null);
    runningScopes.delete(scope);
  });

  child.on("error", (err) => {
    // Spawn failure (e.g. missing binary) — the child never started.
    append(String(err), "stderr");
    settle("failed", null, null);
    runningScopes.delete(scope);
  });

  // Enforce MAX_PROCESS_TIME (or a caller-supplied shorter timeout).
  const timeoutMs = input.timeoutMs ?? cfg.maxProcessTimeMs;
  entry.timeout = setTimeout(() => {
    if (entry.settled) return;
    try {
      child.kill("SIGKILL");
    } catch {}
    settle("timeout", null, "SIGKILL");
    runningScopes.delete(scope);
  }, timeoutMs);
  entry.timeout.unref?.();

  return { processId: rec.id, status: rec.status, startedAt: rec.startedAt };
}

export function cancelTerminalProcess(processId: string, signal: NodeJS.Signals = "SIGTERM"): boolean {
  const entry = entries.get(processId);
  if (!entry || entry.settled) return false;
  entry.settled = true;
  try {
    entry.child.kill(signal);
  } catch {
    entry.settled = false;
    return false;
  }
  runningScopes.delete(entry.scope);
  finishProcess(processId, { status: "cancelled", signal });
  bus.emit("event", {
    processId,
    type: "exit",
    exitCode: null,
    signal,
    status: "cancelled",
  } satisfies TerminalEvent);
  dispatchTerminalExit(processId, "cancelled", null, signal);
  // Escalate to SIGKILL if the graceful signal is ignored.
  setTimeout(() => {
    try {
      entry.child.kill("SIGKILL");
    } catch {}
  }, 1000).unref?.();
  return true;
}

export function cancelTerminalProcessesForTask(taskId: string, signal: NodeJS.Signals = "SIGTERM"): number {
  let count = 0;
  for (const [id, entry] of Array.from(entries)) {
    if (!entry.settled && getProcess(id)?.taskId === taskId && cancelTerminalProcess(id, signal)) {
      count++;
    }
  }
  return count;
}

export interface TerminalOutput {
  stdout: string;
  stderr: string;
}

export function getTerminalOutput(processId: string): TerminalOutput {
  const entry = entries.get(processId);
  return entry ? { stdout: entry.stdout, stderr: entry.stderr } : { stdout: "", stderr: "" };
}

export function getTerminalProcess(processId: string): (ProcessRecord & TerminalOutput) | undefined {
  const rec = getProcess(processId);
  if (!rec) return undefined;
  return { ...rec, ...getTerminalOutput(processId) };
}

export function listTerminalProcesses(userId: string): Array<ProcessRecord & TerminalOutput> {
  return listProcesses((p) => p.userId === userId).map((rec) => ({ ...rec, ...getTerminalOutput(rec.id) }));
}

export function subscribeToTerminal(processId: string, listener: (event: TerminalEvent) => void): () => void {
  const handler = (event: TerminalEvent) => {
    if (event.processId === processId) listener(event);
  };
  bus.on("event", handler);
  return () => {
    bus.off("event", handler);
  };
}

/** Resolve when the process leaves the running state. */
export function waitForTerminalExit(processId: string, timeoutMs = 0): Promise<TerminalEvent> {
  return new Promise((resolve, reject) => {
    const rec = getTerminalProcess(processId);
    if (!rec) {
      reject(new Error(`Process ${processId} not found`));
      return;
    }
    if (rec.status !== "running") {
      resolve({
        processId,
        type: "exit",
        exitCode: rec.exitCode,
        signal: rec.signal,
        status: rec.status,
      } satisfies TerminalEvent);
      return;
    }
    let timer: NodeJS.Timeout | null = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        off();
        reject(new Error(`Timed out waiting for process ${processId}`));
      }, timeoutMs);
    }
    const off = subscribeToTerminal(processId, (event) => {
      if (event.type === "exit") {
        if (timer) clearTimeout(timer);
        off();
        resolve(event);
      }
    });
  });
}

export function isTerminalBusy(userId: string, cwd: string): boolean {
  return runningScopes.has(defaultScope(userId, cwd));
}

export function terminalEntryCount(): number {
  return entries.size;
}

/** Kill any live children and drop all entries (used by tests and shutdown). */
export function clearTerminalEntries(): void {
  for (const entry of entries.values()) {
    if (entry.timeout) clearTimeout(entry.timeout);
    if (!entry.settled) {
      try {
        entry.child.kill("SIGKILL");
      } catch {}
    }
  }
  entries.clear();
  runningScopes.clear();
}
