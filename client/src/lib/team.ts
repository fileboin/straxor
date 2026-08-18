import { api } from "./api.js";
import type { BackgroundTimelineEntry } from "./agent.js";

export type TeamJobStatus = "queued" | "running" | "done" | "error";

export interface TeamRoleDef {
  id: string;
  name: string;
}

export interface TeamRunResult {
  taskId: string;
  roles: TeamRoleDef[];
  jobs: { role: string; jobId: string; sessionId: string; status: string }[];
  status: string;
}

export interface TeamJob {
  jobId: string;
  sessionId: string;
  machineId: string;
  role: string;
  status: TeamJobStatus;
  error?: string | null;
  finished: boolean;
  timeline: BackgroundTimelineEntry[];
}

export interface TeamVerifyStep {
  name: "install" | "build" | "test";
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  passed: boolean;
}

export interface TeamVerifyResult {
  steps: TeamVerifyStep[];
  passed: boolean;
  skipped: boolean;
}

export interface TeamTask {
  id: string;
  title: string;
  prompt: string;
  status: string;
  repo?: string | null;
  branch?: string | null;
  commitHash?: string | null;
  verify?: TeamVerifyResult | null;
  error?: string | null;
}

export interface TeamTaskDetail {
  task: TeamTask;
  jobs: TeamJob[];
}

export interface TeamApproveResult {
  ok: boolean;
  status: string;
  committed: boolean;
  hash: string;
  pushed: boolean;
  pushOutput: string;
  diffChanged?: boolean;
  empty?: boolean;
  error?: string | null;
}

export async function startTeamRun(input: {
  prompt: string;
  machineId?: string;
  roles?: string[];
}): Promise<TeamRunResult> {
  return api<TeamRunResult>("/agent/team", { method: "POST", body: input });
}

export async function fetchTeamTask(taskId: string): Promise<TeamTaskDetail> {
  return api<TeamTaskDetail>(`/agent/team/${taskId}`);
}

export async function approveTeamTask(
  taskId: string,
  opts?: { push?: boolean; commitMessage?: string; diffHash?: string }
): Promise<TeamApproveResult> {
  return api<TeamApproveResult>(`/agent/team/${taskId}/approve`, {
    method: "POST",
    body: opts ?? {},
  });
}
