import { api } from "./api.js";

export type RestorePointType = "version" | "task" | "diff" | "build" | "manual";

export interface RestorePoint {
  id: string;
  name: string;
  description: string;
  type: RestorePointType;
  snapshotPath: string;
  gitCommit: string | null;
  fileCount: number;
  totalSize: string;
  metadata: string | null;
  createdAt: string;
}

export interface SnapshotDiff {
  filesAdded: string[];
  filesRemoved: string[];
  filesModified: string[];
  totalChanges: number;
}

export const RESTORE_TYPE_LABELS: Record<RestorePointType, string> = {
  version: "Verzija",
  task: "Zadatak",
  diff: "Diff",
  build: "Build",
  manual: "Ručno",
};

export const RESTORE_TYPE_ICONS: Record<RestorePointType, string> = {
  version: "📌",
  task: "📋",
  diff: "🔀",
  build: "🔨",
  manual: "💾",
};

export async function createSnapshot(
  machineId: string,
  projectPath: string,
  name: string,
  description: string,
  type: RestorePointType
): Promise<RestorePoint> {
  return api<RestorePoint>("/rollback/create", {
    method: "POST",
    body: JSON.stringify({ machineId, projectPath, name, description, type }),
  });
}

export async function listSnapshots(
  machineId: string,
  projectPath: string
): Promise<RestorePoint[]> {
  const params = new URLSearchParams({ machineId, projectPath });
  return api<RestorePoint[]>(`/rollback/list?${params}`);
}

export async function restoreSnapshot(
  machineId: string,
  projectPath: string,
  snapshotPath: string
): Promise<{ success: boolean; filesRestored: number }> {
  return api("/rollback/restore", {
    method: "POST",
    body: JSON.stringify({ machineId, projectPath, snapshotPath }),
  });
}

export async function deleteSnapshot(
  machineId: string,
  snapshotId: string,
  snapshotPath: string
): Promise<void> {
  const params = new URLSearchParams({ snapshotPath, machineId });
  await api(`/rollback/${snapshotId}?${params}`, {
    method: "DELETE",
  });
}

export async function diffSnapshot(
  machineId: string,
  projectPath: string,
  snapshotPath: string
): Promise<SnapshotDiff> {
  const params = new URLSearchParams({ machineId, projectPath, snapshotPath });
  return api<SnapshotDiff>(`/rollback/diff/${encodeURIComponent(snapshotPath)}?${params}`);
}
