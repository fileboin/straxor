// ── Agent Memory: persistent background jobs (FAZA 7b) ──
// Write-through store for the /api/agent/background flow. The route keeps an
// in-memory map as its hot path, but every job is also persisted here so its
// progress and final result survive a server restart. All DB access is
// best-effort: if the agent_jobs table has not been migrated yet, the route
// falls back to its previous in-memory-only behavior.

import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  agentJobs,
  type AgentJobStatus,
  type AgentJobTimelineEntry,
} from "../db/schema.js";

export type { AgentJobStatus, AgentJobTimelineEntry };

export interface AgentJobRecord {
  id: string;
  userId: string;
  machineId: string;
  sessionId: string;
  status: AgentJobStatus;
  error: string | null;
  finished: boolean;
  timeline: AgentJobTimelineEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentJobInput {
  id: string;
  userId: string;
  machineId: string;
  sessionId: string;
}

export interface AgentJobPatch {
  status?: AgentJobStatus;
  error?: string | null;
  finished?: boolean;
  timeline?: AgentJobTimelineEntry[];
}

// ── Pure helpers (unit-tested without a DB) ──

/** A job is "done" unless an error entry was captured along the way. */
export function finalStatusForTimeline(timeline: AgentJobTimelineEntry[]): AgentJobStatus {
  return timeline.some((e) => e.t === "error") ? "error" : "done";
}

/** True when a running job has not been touched since `cutoffMs`. */
export function isStaleAgentJob(
  updatedAt: Date | string | number | null | undefined,
  cutoffMs: number,
  status: string,
): boolean {
  if (status !== "running") return false;
  const ts = updatedAt ? new Date(updatedAt).getTime() : 0;
  return ts < cutoffMs;
}

// ── DB write-through ──

export async function createAgentJob(input: CreateAgentJobInput): Promise<void> {
  await db.insert(agentJobs).values({
    id: input.id,
    userId: input.userId,
    machineId: input.machineId,
    sessionId: input.sessionId,
    status: "running",
    finished: false,
    timeline: [],
  });
}

export async function updateAgentJob(
  userId: string,
  jobId: string,
  patch: AgentJobPatch,
): Promise<void> {
  await db
    .update(agentJobs)
    .set({ updatedAt: new Date(), ...patch })
    .where(and(eq(agentJobs.id, jobId), eq(agentJobs.userId, userId)));
}

export async function finishAgentJob(
  userId: string,
  jobId: string,
  status: AgentJobStatus,
  error: string | null,
  timeline: AgentJobTimelineEntry[],
): Promise<void> {
  await db
    .update(agentJobs)
    .set({ status, error, finished: true, timeline, updatedAt: new Date() })
    .where(and(eq(agentJobs.id, jobId), eq(agentJobs.userId, userId)));
}

export async function getAgentJob(userId: string, jobId: string): Promise<AgentJobRecord | null> {
  const [row] = await db
    .select()
    .from(agentJobs)
    .where(and(eq(agentJobs.id, jobId), eq(agentJobs.userId, userId)))
    .limit(1);
  return row ? mapAgentJobRow(row) : null;
}

/**
 * Reconcile running jobs whose `updatedAt` is older than `cutoffMs` to an
 * interrupted error state. Used at startup (a restart orphans every running
 * job) and by the cleanup janitor (a job stuck past MAX_PROCESS_TIME).
 */
export async function markStaleAgentJobsInterrupted(cutoffMs: number): Promise<number> {
  const rows = await db
    .select({ id: agentJobs.id, status: agentJobs.status, updatedAt: agentJobs.updatedAt })
    .from(agentJobs)
    .where(eq(agentJobs.status, "running"));

  let marked = 0;
  for (const row of rows) {
    if (!isStaleAgentJob(row.updatedAt, cutoffMs, row.status)) continue;
    await db
      .update(agentJobs)
      .set({
        status: "error",
        error: "Interrupted: server restarted or the job exceeded its time limit",
        finished: true,
        updatedAt: new Date(),
      })
      .where(eq(agentJobs.id, row.id));
    marked++;
  }
  return marked;
}

function mapAgentJobRow(row: typeof agentJobs.$inferSelect): AgentJobRecord {
  return {
    id: row.id,
    userId: row.userId,
    machineId: row.machineId,
    sessionId: row.sessionId,
    status: row.status as AgentJobStatus,
    error: row.error,
    finished: row.finished,
    timeline: (row.timeline as AgentJobTimelineEntry[]) || [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
