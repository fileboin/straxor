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

export interface TeamTask {
  id: string;
  title: string;
  prompt: string;
  status: string;
  error?: string | null;
}

export interface TeamTaskDetail {
  task: TeamTask;
  jobs: TeamJob[];
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
  taskId: string
): Promise<{ ok: boolean; status: string }> {
  return api<{ ok: boolean; status: string }>(`/agent/team/${taskId}/approve`, {
    method: "POST",
  });
}
