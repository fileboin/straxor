import type { GitRemoteAdapter, GitRemoteRepo, GitBranch, GitPullRequest, GitIssue } from "../adapter.js";

export function createGitHubAdapter(token?: string): GitRemoteAdapter {
  let authToken = token || "";

  const api = async <T>(path: string, opts: RequestInit = {}): Promise<T> => {
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "straxor",
    };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    if (opts.body) headers["Content-Type"] = "application/json";
    const res = await fetch(`https://api.github.com${path}`, { ...opts, headers });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    return res.json();
  };

  return {
    platform: "github",
    name: "GitHub",

    isAuthenticated: () => !!authToken,
    setToken: (token: string) => { authToken = token; },

    async getUser(): Promise<{ username: string } | null> {
      if (!authToken) return null;
      try {
        const data: any = await api("/user");
        return { username: data.login };
      } catch {
        return null;
      }
    },

    async listRepos(): Promise<GitRemoteRepo[]> {
      const data: any[] = await api("/user/repos?per_page=100&sort=updated");
      return data.map(mapRepo);
    },

    async getRepo(owner: string, repo: string): Promise<GitRemoteRepo> {
      const data: any = await api(`/repos/${owner}/${repo}`);
      return mapRepo(data);
    },

    async createRepo(name: string, opts?: { description?: string; private?: boolean }): Promise<GitRemoteRepo> {
      const data: any = await api("/user/repos", {
        method: "POST",
        body: JSON.stringify({ name, description: opts?.description, private: opts?.private ?? false }),
      });
      return mapRepo(data);
    },

    async forkRepo(owner: string, repo: string): Promise<GitRemoteRepo> {
      const data: any = await api(`/repos/${owner}/${repo}/forks`, { method: "POST" });
      return mapRepo(data);
    },

    async listBranches(owner: string, repo: string): Promise<GitBranch[]> {
      const data: any[] = await api(`/repos/${owner}/${repo}/branches?per_page=100`);
      return data.map((b: any) => ({ name: b.name, commitSha: b.commit.sha, isDefault: false, protected: b.protected }));
    },

    async createBranch(owner: string, repo: string, name: string, fromSha: string): Promise<void> {
      await api(`/repos/${owner}/${repo}/git/refs`, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${name}`, sha: fromSha }),
      });
    },

    async listPullRequests(owner: string, repo: string, state?: "open" | "closed" | "all"): Promise<GitPullRequest[]> {
      const s = state === "all" ? "all" : state || "open";
      const data: any[] = await api(`/repos/${owner}/${repo}/pulls?state=${s}&per_page=100`);
      return data.map((pr: any) => ({
        id: pr.number,
        title: pr.title,
        description: pr.body || "",
        sourceBranch: pr.head.ref,
        targetBranch: pr.base.ref,
        state: pr.merged_at ? "merged" : pr.state as any,
        author: pr.user?.login || "",
        createdAt: pr.created_at,
        url: pr.html_url,
      }));
    },

    async createPullRequest(owner: string, repo: string, pr: { title: string; description: string; sourceBranch: string; targetBranch: string }): Promise<GitPullRequest> {
      const data: any = await api(`/repos/${owner}/${repo}/pulls`, {
        method: "POST",
        body: JSON.stringify({ title: pr.title, body: pr.description, head: pr.sourceBranch, base: pr.targetBranch }),
      });
      return {
        id: data.number,
        title: data.title,
        description: data.body || "",
        sourceBranch: data.head.ref,
        targetBranch: data.base.ref,
        state: data.state,
        author: data.user?.login || "",
        createdAt: data.created_at,
        url: data.html_url,
      };
    },

    async mergePullRequest(owner: string, repo: string, prId: number): Promise<void> {
      await api(`/repos/${owner}/${repo}/pulls/${prId}/merge`, { method: "PUT" });
    },

    async listIssues(owner: string, repo: string, state?: "open" | "closed" | "all"): Promise<GitIssue[]> {
      const s = state === "all" ? "all" : state || "open";
      const data: any[] = await api(`/repos/${owner}/${repo}/issues?state=${s}&per_page=100`);
      return data.filter((i: any) => !i.pull_request).map((i: any) => ({
        id: i.number,
        title: i.title,
        description: i.body || "",
        state: i.state,
        author: i.user?.login || "",
        labels: i.labels?.map((l: any) => l.name) || [],
        createdAt: i.created_at,
        url: i.html_url,
      }));
    },

    async createIssue(owner: string, repo: string, issue: { title: string; description: string; labels?: string[] }): Promise<GitIssue> {
      const data: any = await api(`/repos/${owner}/${repo}/issues`, {
        method: "POST",
        body: JSON.stringify({ title: issue.title, body: issue.description, labels: issue.labels }),
      });
      return {
        id: data.number,
        title: data.title,
        description: data.body || "",
        state: data.state,
        author: data.user?.login || "",
        labels: data.labels?.map((l: any) => l.name) || [],
        createdAt: data.created_at,
        url: data.html_url,
      };
    },
  };
}

function mapRepo(data: any): GitRemoteRepo {
  return {
    id: String(data.id),
    name: data.name,
    fullName: data.full_name,
    description: data.description || "",
    url: data.html_url,
    cloneUrl: data.clone_url,
    sshUrl: data.ssh_url,
    platform: "github",
    private: data.private,
    defaultBranch: data.default_branch,
    language: data.language,
    stars: data.stargazers_count || 0,
    forks: data.forks_count || 0,
    updatedAt: data.updated_at,
    createdAt: data.created_at,
  };
}
