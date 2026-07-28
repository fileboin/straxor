import type { GitRemoteAdapter, GitRemoteRepo, GitBranch, GitPullRequest, GitIssue } from "../adapter.js";

export function createGitLabAdapter(token?: string): GitRemoteAdapter {
  let authToken = token || "";

  const api = async <T>(path: string, opts: RequestInit = {}): Promise<T> => {
    const headers: Record<string, string> = { "User-Agent": "straxor" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    if (opts.body) headers["Content-Type"] = "application/json";
    const res = await fetch(`https://gitlab.com/api/v4${path}`, { ...opts, headers });
    if (!res.ok) throw new Error(`GitLab API error: ${res.status} ${res.statusText}`);
    return res.json();
  };

  return {
    platform: "gitlab",
    name: "GitLab",

    isAuthenticated: () => !!authToken,
    setToken: (token: string) => { authToken = token; },

    async listRepos(): Promise<GitRemoteRepo[]> {
      const data: any[] = await api("/projects?per_page=100&membership=true&order_by=updated_at");
      return data.map(mapRepo);
    },

    async getRepo(owner: string, repo: string): Promise<GitRemoteRepo> {
      const encoded = encodeURIComponent(`${owner}/${repo}`);
      const data: any = await api(`/projects/${encoded}`);
      return mapRepo(data);
    },

    async createRepo(name: string, opts?: { description?: string; private?: boolean }): Promise<GitRemoteRepo> {
      const data: any = await api("/projects", {
        method: "POST",
        body: JSON.stringify({ name, description: opts?.description, visibility: opts?.private ? "private" : "public" }),
      });
      return mapRepo(data);
    },

    async forkRepo(owner: string, repo: string): Promise<GitRemoteRepo> {
      const encoded = encodeURIComponent(`${owner}/${repo}`);
      const data: any = await api(`/projects/${encoded}/fork`, { method: "POST" });
      return mapRepo(data);
    },

    async listBranches(owner: string, repo: string): Promise<GitBranch[]> {
      const encoded = encodeURIComponent(`${owner}/${repo}`);
      const data: any[] = await api(`/projects/${encoded}/repository/branches?per_page=100`);
      return data.map((b: any) => ({ name: b.name, commitSha: b.commit.id, isDefault: b.default, protected: b.protected }));
    },

    async createBranch(owner: string, repo: string, name: string, fromSha: string): Promise<void> {
      const encoded = encodeURIComponent(`${owner}/${repo}`);
      await api(`/projects/${encoded}/repository/branches`, {
        method: "POST",
        body: JSON.stringify({ branch: name, ref: fromSha }),
      });
    },

    async listPullRequests(owner: string, repo: string, state?: "open" | "closed" | "all"): Promise<GitPullRequest[]> {
      const encoded = encodeURIComponent(`${owner}/${repo}`);
      const s = state === "all" ? "opened,closed,merged" : state === "closed" ? "closed,merged" : "opened";
      const data: any[] = await api(`/projects/${encoded}/merge_requests?state=${s}&per_page=100`);
      return data.map((pr: any) => ({
        id: pr.iid,
        title: pr.title,
        description: pr.description || "",
        sourceBranch: pr.source_branch,
        targetBranch: pr.target_branch,
        state: pr.state === "merged" ? "merged" : pr.state as any,
        author: pr.author?.username || "",
        createdAt: pr.created_at,
        url: pr.web_url,
      }));
    },

    async createPullRequest(owner: string, repo: string, pr: { title: string; description: string; sourceBranch: string; targetBranch: string }): Promise<GitPullRequest> {
      const encoded = encodeURIComponent(`${owner}/${repo}`);
      const data: any = await api(`/projects/${encoded}/merge_requests`, {
        method: "POST",
        body: JSON.stringify({ title: pr.title, description: pr.description, source_branch: pr.sourceBranch, target_branch: pr.targetBranch }),
      });
      return {
        id: data.iid,
        title: data.title,
        description: data.description || "",
        sourceBranch: data.source_branch,
        targetBranch: data.target_branch,
        state: data.state,
        author: data.author?.username || "",
        createdAt: data.created_at,
        url: data.web_url,
      };
    },

    async mergePullRequest(owner: string, repo: string, prId: number): Promise<void> {
      const encoded = encodeURIComponent(`${owner}/${repo}`);
      await api(`/projects/${encoded}/merge_requests/${prId}/merge`, { method: "PUT" });
    },

    async listIssues(owner: string, repo: string, state?: "open" | "closed" | "all"): Promise<GitIssue[]> {
      const encoded = encodeURIComponent(`${owner}/${repo}`);
      const s = state === "all" ? "opened,closed" : state || "opened";
      const data: any[] = await api(`/projects/${encoded}/issues?state=${s}&per_page=100`);
      return data.map((i: any) => ({
        id: i.iid,
        title: i.title,
        description: i.description || "",
        state: i.state,
        author: i.author?.username || "",
        labels: i.labels || [],
        createdAt: i.created_at,
        url: i.web_url,
      }));
    },

    async createIssue(owner: string, repo: string, issue: { title: string; description: string; labels?: string[] }): Promise<GitIssue> {
      const encoded = encodeURIComponent(`${owner}/${repo}`);
      const data: any = await api(`/projects/${encoded}/issues`, {
        method: "POST",
        body: JSON.stringify({ title: issue.title, description: issue.description, labels: issue.labels?.join(",") }),
      });
      return {
        id: data.iid,
        title: data.title,
        description: data.description || "",
        state: data.state,
        author: data.author?.username || "",
        labels: data.labels || [],
        createdAt: data.created_at,
        url: data.web_url,
      };
    },
  };
}

function mapRepo(data: any): GitRemoteRepo {
  return {
    id: String(data.id),
    name: data.name || data.path,
    fullName: data.path_with_namespace || data.name,
    description: data.description || "",
    url: data.web_url,
    cloneUrl: data.http_url_to_repo,
    sshUrl: data.ssh_url_to_repo,
    platform: "gitlab",
    private: data.visibility === "private",
    defaultBranch: data.default_branch || "main",
    language: data.language || "",
    stars: data.star_count || 0,
    forks: data.forks_count || 0,
    updatedAt: data.last_activity_at,
    createdAt: data.created_at,
  };
}
