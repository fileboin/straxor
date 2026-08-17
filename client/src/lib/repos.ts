import type { GitPlatformId, GitRemoteRepo } from "./git-remote";

export interface RepoConnection {
  id: string;
  userId: string;
  platform: GitPlatformId;
  owner: string;
  name: string;
  fullName: string;
  cloneUrl: string;
  defaultBranch: string;
  isActive: boolean;
  slot?: string;
  connectionType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UrlRepoMeta {
  fullName: string;
  name: string;
  description: string | null;
  defaultBranch: string;
  stars: number;
  isPrivate: boolean;
}

const BASE = "/api/repos";

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...opts?.headers,
    },
    ...opts,
    body: opts?.body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Repos API error");
  }
  return res.json();
}

export async function listRepoConnections() {
  return api<RepoConnection[]>(`/`);
}

export async function connectRepo(platform: GitPlatformId, fullName: string, slot?: string) {
  return api<{ success: boolean; id: string; repo: GitRemoteRepo }>(`/connect`, {
    method: "POST",
    body: JSON.stringify({ platform, fullName, slot }),
  });
}

export async function setActiveRepo(platform: GitPlatformId, fullName: string, slot?: string) {
  return api<{ success: boolean }>(`/active`, {
    method: "POST",
    body: JSON.stringify({ platform, fullName, slot }),
  });
}

export async function disconnectRepo(platform: GitPlatformId, fullName: string) {
  return api<{ success: boolean }>(`/disconnect`, {
    method: "POST",
    body: JSON.stringify({ platform, fullName }),
  });
}

export async function pushRepo() {
  return api<{ success: boolean; repo: string; branch: string; lastCommit: string; output: string }>(`/push`, {
    method: "POST",
  });
}

export interface RepoVerifyStep {
  name: "install" | "build" | "test";
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  passed: boolean;
}

export interface RepoVerifyResult {
  success: boolean;
  repo: string;
  branch: string;
  steps: RepoVerifyStep[];
  passed: boolean;
  skipped: boolean;
}

export async function verifyRepo(opts?: {
  build?: boolean;
  test?: boolean;
  install?: boolean;
  timeoutMs?: number;
}): Promise<RepoVerifyResult> {
  return api<RepoVerifyResult>(`/verify`, {
    method: "POST",
    body: JSON.stringify(opts ?? {}),
  });
}

export interface RepoDiffResult {
  success: boolean;
  repo: string;
  branch: string;
  stat: string;
  diff: string;
  hash: string;
}

export async function getRepoDiff(): Promise<RepoDiffResult> {
  return api<RepoDiffResult>(`/diff`);
}

export interface RepoApproveResult {
  success: boolean;
  repo: string;
  branch: string;
  committed: boolean;
  hash: string;
  message: string;
  diffChanged: boolean;
  empty: boolean;
  pushed: boolean;
  pushOutput: string;
}

export async function approveRepo(message: string, diffHash?: string, push = false): Promise<RepoApproveResult> {
  return api<RepoApproveResult>(`/approve`, {
    method: "POST",
    body: JSON.stringify({ message, diffHash, push }),
  });
}

export async function connectRepoUrl(repoUrl: string) {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/github/connect-url", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ repoUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Connect URL error");
  }
  return res.json() as Promise<{ success: boolean; id: string; readOnly: boolean; pushCapable?: boolean; repo: UrlRepoMeta }>;
}
