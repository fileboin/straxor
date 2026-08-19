// ── Cleanup ──
// Background janitor: kills orphan processes, fails stale RUNNING tasks and
// removes expired task workspaces. Runs on a timer and on graceful shutdown.

import fs from "fs";
import path from "path";
import { getConfig } from "./config.js";
import { isProcessOrphan, killProcess, listProcesses } from "./process-registry.js";
import { cancelTerminalProcess } from "./terminal.js";
import { failStaleTasks } from "./tasks.js";
import { collectTaskWorkspaceDirs, getWorkspaceRoot } from "../runtime/local/workspace.js";

export interface CleanupReport {
  ranAt: number;
  orphanProcessesKilled: number;
  staleTasksFailed: number;
  taskWorkspacesRemoved: number;
  errors: string[];
}

export async function runCleanupOnce(): Promise<CleanupReport> {
  const cfg = getConfig();
  const now = Date.now();
  const report: CleanupReport = {
    ranAt: now,
    orphanProcessesKilled: 0,
    staleTasksFailed: 0,
    taskWorkspacesRemoved: 0,
    errors: [],
  };

  for (const proc of listProcesses()) {
    if (isProcessOrphan(proc, now, cfg.maxProcessTimeMs)) {
      // Terminal-managed processes need the manager's cancel path so their
      // stream is closed and status is recorded as cancelled, not failed.
      const killed = cancelTerminalProcess(proc.id, "SIGKILL") || killProcess(proc.id, "SIGKILL");
      if (killed) report.orphanProcessesKilled++;
    }
  }

  try {
    report.staleTasksFailed = await failStaleTasks(new Date(now - cfg.maxProcessTimeMs));
  } catch (err) {
    report.errors.push(`stale tasks: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    report.taskWorkspacesRemoved = removeExpiredTaskWorkspaces(now - cfg.taskWorkspaceTtlMs);
  } catch (err) {
    report.errors.push(`workspaces: ${err instanceof Error ? err.message : String(err)}`);
  }

  return report;
}

/** Remove task workspace dirs whose mtime is older than `cutoffMs`. */
export function removeExpiredTaskWorkspaces(cutoffMs: number): number {
  const root = path.resolve(getWorkspaceRoot());
  let removed = 0;
  for (const dir of collectTaskWorkspaceDirs(root)) {
    let mtimeMs = 0;
    try {
      mtimeMs = fs.statSync(dir).mtimeMs;
    } catch {
      continue;
    }
    if (mtimeMs > 0 && mtimeMs < cutoffMs) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        removed++;
      } catch {
        // keep going — one locked dir must not stop the janitor
      }
    }
  }
  return removed;
}

let scheduler: NodeJS.Timeout | null = null;

export function startCleanupScheduler(intervalMs?: number): NodeJS.Timeout {
  if (scheduler) return scheduler;
  const interval = intervalMs ?? getConfig().cleanupIntervalMs;
  scheduler = setInterval(() => {
    runCleanupOnce().catch(() => {});
  }, interval);
  scheduler.unref?.();
  return scheduler;
}

export function stopCleanupScheduler(): void {
  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }
}
