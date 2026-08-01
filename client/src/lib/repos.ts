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
  createdAt: string;
  updatedAt: string;
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

export async function connectRepo(platform: GitPlatformId, fullName: string) {
  return api<{ success: boolean; id: string; repo: GitRemoteRepo }>(`/connect`, {
    method: "POST",
    body: JSON.stringify({ platform, fullName }),
  });
}

export async function setActiveRepo(platform: GitPlatformId, fullName: string) {
  return api<{ success: boolean }>(`/active`, {
    method: "POST",
    body: JSON.stringify({ platform, fullName }),
  });
}

export async function disconnectRepo(platform: GitPlatformId, fullName: string) {
  return api<{ success: boolean }>(`/disconnect`, {
    method: "POST",
    body: JSON.stringify({ platform, fullName }),
  });
}
