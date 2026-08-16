// ── Persistent Task State (MVP) ──
// Task rows follow the lifecycle QUEUED → RUNNING → VERIFYING → WAITING_APPROVAL
// → VERIFIED (or FAILED/CANCELLED). Transitions are validated against
// task-state.ts so an agent can never mark its own work VERIFIED out of order.

import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "../db/index.js";
import { tasks } from "../db/schema.js";
import { canTransition, type TaskStatus } from "./task-state.js";

export interface CreateTaskInput {
  userId: string;
  projectId?: string | null;
  repo?: string | null;
  title: string;
  prompt?: string;
  branch?: string | null;
}

export interface TaskPatch {
  workspaceDir?: string | null;
  branch?: string | null;
  commitHash?: string | null;
  diff?: string | null;
  error?: string | null;
  retries?: number;
}

export async function createTask(input: CreateTaskInput): Promise<{ id: string }> {
  const [row] = await db
    .insert(tasks)
    .values({
      userId: input.userId,
      projectId: input.projectId ?? null,
      repo: input.repo ?? null,
      title: input.title,
      prompt: input.prompt ?? "",
      branch: input.branch ?? null,
      status: "QUEUED",
    })
    .returning({ id: tasks.id });
  return { id: row.id };
}

export async function getTask(userId: string, taskId: string) {
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listTasksForUser(userId: string, limit = 50) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(desc(tasks.createdAt))
    .limit(limit);
}

export async function transitionTaskStatus(
  userId: string,
  taskId: string,
  to: TaskStatus,
  patch: TaskPatch = {},
): Promise<boolean> {
  const existing = await getTask(userId, taskId);
  if (!existing) throw new Error("Task not found");
  const from = existing.status as TaskStatus;
  if (from !== to && !canTransition(from, to)) {
    throw new Error(`Invalid task transition: ${from} -> ${to}`);
  }
  await db
    .update(tasks)
    .set({ status: to, updatedAt: new Date(), ...patch })
    .where(eq(tasks.id, taskId));
  return true;
}

export async function setTaskFields(userId: string, taskId: string, patch: TaskPatch): Promise<void> {
  await db
    .update(tasks)
    .set({ updatedAt: new Date(), ...patch })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}

/** Mark RUNNING tasks that haven't been updated since `cutoff` as FAILED. */
export async function failStaleTasks(cutoff: Date): Promise<number> {
  const rows = await db
    .select({ id: tasks.id, retries: tasks.retries })
    .from(tasks)
    .where(and(eq(tasks.status, "RUNNING"), lt(tasks.updatedAt, cutoff)));
  for (const row of rows) {
    await db
      .update(tasks)
      .set({
        status: "FAILED",
        error: "Timed out: task stayed RUNNING beyond MAX_PROCESS_TIME",
        retries: (row.retries ?? 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, row.id));
  }
  return rows.length;
}
