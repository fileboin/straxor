// ── Process Registry ──
// In-memory registry for spawned commands (build/test/preview/agents) so they
// can be observed and killed/cancelled from the API. The persistent mirror is
// the `process_runs` table (see process-runs.ts); this module stays DB-free so
// it can be unit tested and used by short-lived workers.

import { randomUUID } from "crypto";

export type ProcessStatus = "running" | "finished" | "failed" | "cancelled" | "timeout";

export interface ProcessHandle {
  pid?: number;
  kill(signal?: NodeJS.Signals): boolean;
}

export interface ProcessRecord {
  id: string;
  taskId: string | null;
  userId: string | null;
  pid: number | null;
  command: string;
  args: string[];
  cwd: string;
  status: ProcessStatus;
  exitCode: number | null;
  signal: string | null;
  startedAt: number;
  endedAt: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  error: string | null;
}

export interface RegisterProcessInput {
  taskId?: string | null;
  userId?: string | null;
  command: string;
  args?: string[];
  cwd?: string;
  pid?: number | null;
  handle?: ProcessHandle | null;
}

type Entry = ProcessRecord & { handle: ProcessHandle | null };

const registry = new Map<string, Entry>();

export function registerProcess(input: RegisterProcessInput): ProcessRecord {
  const rec: ProcessRecord = {
    id: randomUUID(),
    taskId: input.taskId ?? null,
    userId: input.userId ?? null,
    pid: input.pid ?? input.handle?.pid ?? null,
    command: input.command,
    args: input.args ?? [],
    cwd: input.cwd ?? "",
    status: "running",
    exitCode: null,
    signal: null,
    startedAt: Date.now(),
    endedAt: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    error: null,
  };
  registry.set(rec.id, { ...rec, handle: input.handle ?? null });
  return rec;
}

export function getProcess(id: string): ProcessRecord | undefined {
  const entry = registry.get(id);
  return entry ? publicRecord(entry) : undefined;
}

export function listProcesses(predicate?: (rec: ProcessRecord) => boolean): ProcessRecord[] {
  const all = Array.from(registry.values()).map(publicRecord);
  return predicate ? all.filter(predicate) : all;
}

export function updateProcess(id: string, patch: Partial<Omit<ProcessRecord, "id">>): ProcessRecord | undefined {
  const entry = registry.get(id);
  if (!entry) return undefined;
  Object.assign(entry, patch);
  return publicRecord(entry);
}

export interface FinishProcessResult {
  status: ProcessStatus;
  exitCode?: number | null;
  signal?: string | null;
  error?: string | null;
}

export function finishProcess(id: string, result: FinishProcessResult): ProcessRecord | undefined {
  const entry = registry.get(id);
  if (!entry) return undefined;
  entry.status = result.status;
  entry.exitCode = result.exitCode ?? null;
  entry.signal = result.signal ?? null;
  entry.error = result.error ?? null;
  entry.endedAt = Date.now();
  return publicRecord(entry);
}

export function killProcess(id: string, signal: NodeJS.Signals = "SIGTERM"): boolean {
  const entry = registry.get(id);
  if (!entry || entry.status !== "running") return false;
  let killed = false;
  try {
    killed = entry.handle ? entry.handle.kill(signal) : false;
  } catch {
    killed = false;
  }
  if (killed) {
    entry.status = "cancelled";
    entry.endedAt = Date.now();
    entry.signal = signal;
  }
  return killed;
}

export function killProcessesForTask(taskId: string, signal: NodeJS.Signals = "SIGTERM"): number {
  let count = 0;
  for (const entry of Array.from(registry.values())) {
    if (entry.taskId === taskId && entry.status === "running" && killProcess(entry.id, signal)) {
      count++;
    }
  }
  return count;
}

export function killAllProcesses(signal: NodeJS.Signals = "SIGTERM"): number {
  let count = 0;
  for (const entry of Array.from(registry.values())) {
    if (entry.status === "running" && killProcess(entry.id, signal)) {
      count++;
    }
  }
  return count;
}

/** A process is orphaned when it has outlived MAX_PROCESS_TIME while running. */
export function isProcessOrphan(rec: ProcessRecord, nowMs: number, maxAgeMs: number): boolean {
  return rec.status === "running" && nowMs - rec.startedAt > maxAgeMs;
}

export function clearProcessRegistry(): void {
  registry.clear();
}

export function registrySize(): number {
  return registry.size;
}

function publicRecord(entry: Entry): ProcessRecord {
  const { handle: _handle, ...rec } = entry;
  return rec;
}
