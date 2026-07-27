const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Worktree {
  id: string;
  userId: string;
  machineId: string;
  branch: string;
  worktreePath: string;
  taskName: string | null;
  status: "active" | "merged" | "deleted";
  head?: string;
  isMain?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GitStatus {
  path: string;
  status: "modified" | "added" | "deleted" | "untracked" | "renamed";
}

export interface GitDiff {
  path: string;
  additions: string[];
  deletions: string[];
}

export interface MergeResult {
  success: boolean;
  conflicts: string[];
  mergedFiles: string[];
  message: string;
}

export const STATUS_COLORS: Record<string, string> = {
  active: "text-green-400",
  merged: "text-accent-blue",
  deleted: "text-red-400",
};

export const STATUS_BG: Record<string, string> = {
  active: "bg-green-500/10 border-green-500/30",
  merged: "bg-accent-blue/10 border-accent-blue/30",
  deleted: "bg-red-500/10 border-red-500/30",
};

export async function fetchWorktrees(machineId?: string): Promise<Worktree[]> {
  const query = machineId ? `?machineId=${machineId}` : "";
  const res = await fetch(`${API_BASE}/api/worktrees${query}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchLiveWorktrees(machineId: string): Promise<Worktree[]> {
  const res = await fetch(`${API_BASE}/api/worktrees/${machineId}/live`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function createWorktree(
  machineId: string,
  branch: string,
  fromBranch?: string,
  taskName?: string
): Promise<Worktree> {
  const res = await fetch(`${API_BASE}/api/worktrees`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ machineId, branch, fromBranch, taskName }),
  });
  if (!res.ok) throw new Error("Failed to create worktree");
  return res.json();
}

export async function removeWorktree(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/worktrees/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to remove worktree");
}

export async function mergeWorktree(
  id: string,
  targetBranch?: string
): Promise<MergeResult> {
  const res = await fetch(`${API_BASE}/api/worktrees/${id}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ targetBranch }),
  });
  if (!res.ok) throw new Error("Failed to merge worktree");
  return res.json();
}

export async function getWorktreeStatus(id: string): Promise<GitStatus[]> {
  const res = await fetch(`${API_BASE}/api/worktrees/${id}/status`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getWorktreeDiff(id: string): Promise<GitDiff[]> {
  const res = await fetch(`${API_BASE}/api/worktrees/${id}/diff`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}
