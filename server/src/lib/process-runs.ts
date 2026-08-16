// ── Persistent Process Runs ──
// Mirrors the in-memory ProcessRegistry into the `process_runs` table so
// process history survives restarts. Best-effort: DB failures are logged, not
// thrown, so a DB outage never breaks an in-flight process.

import { desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { processRuns } from "../db/schema.js";
import type { ProcessRecord } from "./process-registry.js";

export async function recordProcessStart(rec: ProcessRecord): Promise<void> {
  try {
    await db.insert(processRuns).values({
      id: rec.id,
      taskId: rec.taskId,
      userId: rec.userId,
      pid: rec.pid,
      command: rec.command,
      args: JSON.stringify(rec.args),
      cwd: rec.cwd || null,
      status: "running",
      startedAt: new Date(rec.startedAt),
      stdoutBytes: rec.stdoutBytes,
      stderrBytes: rec.stderrBytes,
    });
  } catch (err) {
    console.warn("[process-runs] start record failed:", err);
  }
}

export async function recordProcessEnd(rec: ProcessRecord): Promise<void> {
  try {
    await db
      .update(processRuns)
      .set({
        status: rec.status,
        exitCode: rec.exitCode,
        signal: rec.signal,
        endedAt: rec.endedAt ? new Date(rec.endedAt) : new Date(),
        stdoutBytes: rec.stdoutBytes,
        stderrBytes: rec.stderrBytes,
        error: rec.error,
      })
      .where(eq(processRuns.id, rec.id));
  } catch (err) {
    console.warn("[process-runs] end record failed:", err);
  }
}

export async function listProcessRuns(taskId: string, limit = 100) {
  return db
    .select()
    .from(processRuns)
    .where(eq(processRuns.taskId, taskId))
    .orderBy(desc(processRuns.startedAt))
    .limit(limit);
}
