import { api } from "./api.js";

export type KanbanColumn = "active" | "waiting" | "paused" | "error" | "completed";

export interface KanbanCard {
  id: string;
  type: "session" | "deployment" | "machine";
  column: KanbanColumn;
  title: string;
  description: string;
  projectName: string | null;
  agentName: string | null;
  runtimeId: string | null;
  model: string | null;
  status: string;
  error: string | null;
  updatedAt: string;
  actions: {
    canPause: boolean;
    canResume: boolean;
    canChangeModel: boolean;
    canChangeRuntime: boolean;
    canRestart: boolean;
  };
  metadata: Record<string, unknown>;
}

export interface KanbanData {
  columns: Record<KanbanColumn, KanbanCard[]>;
  summary: {
    total: number;
    active: number;
    waiting: number;
    paused: number;
    error: number;
    completed: number;
  };
}

export async function fetchKanban(): Promise<KanbanData> {
  return api("/kanban");
}

export async function pauseSession(sessionId: string): Promise<void> {
  await api(`/kanban/session/${sessionId}/pause`, { method: "POST" });
}

export async function resumeSession(sessionId: string): Promise<void> {
  await api(`/kanban/session/${sessionId}/resume`, { method: "POST" });
}

export async function changeSessionModel(sessionId: string, provider?: string, model?: string): Promise<void> {
  await api(`/kanban/session/${sessionId}/change-model`, {
    method: "POST",
    body: JSON.stringify({ provider, model }),
  });
}

export async function changeSessionRuntime(sessionId: string, runtimeId: string): Promise<void> {
  await api(`/kanban/session/${sessionId}/change-runtime`, {
    method: "POST",
    body: JSON.stringify({ runtimeId }),
  });
}
