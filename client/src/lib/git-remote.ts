export type GitPlatformId = "github" | "gitlab" | "forgejo" | "gitea" | "bitbucket" | "huggingface";

export interface GitRemoteRepo {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  cloneUrl: string;
  sshUrl: string;
  platform: GitPlatformId;
  private: boolean;
  defaultBranch: string;
  language?: string;
  stars: number;
  forks: number;
  updatedAt: string;
  createdAt: string;
}

export interface GitBranch {
  name: string;
  commitSha: string;
  isDefault: boolean;
  protected: boolean;
}

export interface GitPullRequest {
  id: number;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  state: "open" | "closed" | "merged";
  author: string;
  createdAt: string;
  url: string;
}

export interface GitIssue {
  id: number;
  title: string;
  description: string;
  state: "open" | "closed";
  author: string;
  labels: string[];
  createdAt: string;
  url: string;
}

const BASE = "/api/git-remote";

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
    throw new Error(err.error || "Git remote API error");
  }
  return res.json();
}

// ── Config ──

export async function getGitConfig(platform: GitPlatformId) {
  return api<{ platform: string; configured: boolean; baseUrl?: string }>(`/config/${platform}`);
}

export async function setGitConfig(platform: GitPlatformId, token: string, baseUrl?: string) {
  return api<{ platform: string; configured: boolean }>(`/config/${platform}`, {
    method: "POST",
    body: JSON.stringify({ token, baseUrl }),
  });
}

// ── Repos ──

export async function listRepos(platform: GitPlatformId) {
  return api<GitRemoteRepo[]>(`/${platform}/repos`);
}

export async function getRepo(platform: GitPlatformId, owner: string, repo: string) {
  return api<GitRemoteRepo>(`/${platform}/repo/${owner}/${repo}`);
}

export async function createRepo(platform: GitPlatformId, name: string, opts?: { description?: string; private?: boolean }) {
  return api<GitRemoteRepo>(`/${platform}/repos`, {
    method: "POST",
    body: JSON.stringify({ name, ...opts }),
  });
}

export async function forkRepo(platform: GitPlatformId, owner: string, repo: string) {
  return api<GitRemoteRepo>(`/${platform}/repo/${owner}/${repo}/fork`, { method: "POST" });
}

// ── Branches ──

export async function listBranches(platform: GitPlatformId, owner: string, repo: string) {
  return api<GitBranch[]>(`/${platform}/repo/${owner}/${repo}/branches`);
}

export async function createBranch(platform: GitPlatformId, owner: string, repo: string, name: string, fromSha: string) {
  return api<{ name: string }>(`/${platform}/repo/${owner}/${repo}/branches`, {
    method: "POST",
    body: JSON.stringify({ name, fromSha }),
  });
}

// ── Pull Requests ──

export async function listPullRequests(platform: GitPlatformId, owner: string, repo: string, state?: "open" | "closed" | "all") {
  const qs = state ? `?state=${state}` : "";
  return api<GitPullRequest[]>(`/${platform}/repo/${owner}/${repo}/pulls${qs}`);
}

export async function createPullRequest(
  platform: GitPlatformId,
  owner: string,
  repo: string,
  pr: { title: string; description: string; sourceBranch: string; targetBranch: string }
) {
  return api<GitPullRequest>(`/${platform}/repo/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify(pr),
  });
}

export async function mergePullRequest(platform: GitPlatformId, owner: string, repo: string, prId: number) {
  return api<{ success: boolean }>(`/${platform}/repo/${owner}/${repo}/pulls/${prId}/merge`, { method: "POST" });
}

// ── Issues ──

export async function listIssues(platform: GitPlatformId, owner: string, repo: string, state?: "open" | "closed" | "all") {
  const qs = state ? `?state=${state}` : "";
  return api<GitIssue[]>(`/${platform}/repo/${owner}/${repo}/issues${qs}`);
}

export async function createIssue(
  platform: GitPlatformId,
  owner: string,
  repo: string,
  issue: { title: string; description: string; labels?: string[] }
) {
  return api<GitIssue>(`/${platform}/repo/${owner}/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify(issue),
  });
}

export const GIT_PLATFORMS: { id: GitPlatformId; name: string; icon: string; color: string; selfHosted: boolean }[] = [
  { id: "github", name: "GitHub", icon: "🐙", color: "text-gray-300", selfHosted: false },
  { id: "gitlab", name: "GitLab", icon: "🦊", color: "text-orange-400", selfHosted: false },
  { id: "forgejo", name: "Forgejo", icon: "🔨", color: "text-green-400", selfHosted: true },
  { id: "gitea", name: "Gitea", icon: "🐊", color: "text-cyan-400", selfHosted: true },
  { id: "bitbucket", name: "Bitbucket", icon: "🔵", color: "text-blue-400", selfHosted: false },
  { id: "huggingface", name: "Hugging Face Hub", icon: "🤗", color: "text-yellow-400", selfHosted: false },
];
