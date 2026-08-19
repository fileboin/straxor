// ── Task lifecycle state (pure, DB-free) ──
// QUEUED → RUNNING → VERIFYING → WAITING_APPROVAL → VERIFIED
//                  └─(fix)──┘   └─(ask to fix)──┘
// Any active stage may also end in FAILED or CANCELLED.

export const TASK_STATUSES = [
  "QUEUED",
  "RUNNING",
  "VERIFYING",
  "WAITING_APPROVAL",
  "VERIFIED",
  "FAILED",
  "CANCELLED",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TERMINAL_TASK_STATUSES: readonly TaskStatus[] = ["VERIFIED", "FAILED", "CANCELLED"];

/**
 * Legal transitions between task statuses. An agent may never jump straight to
 * VERIFIED — only the verification engine may reach it via WAITING_APPROVAL.
 */
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  QUEUED: ["RUNNING", "FAILED", "CANCELLED"],
  RUNNING: ["VERIFYING", "FAILED", "CANCELLED"],
  VERIFYING: ["RUNNING", "WAITING_APPROVAL", "FAILED", "CANCELLED"],
  WAITING_APPROVAL: ["RUNNING", "VERIFIED", "FAILED", "CANCELLED"],
  VERIFIED: [],
  FAILED: ["QUEUED"],
  CANCELLED: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalTaskStatus(status: string): boolean {
  return (TERMINAL_TASK_STATUSES as readonly string[]).includes(status);
}
