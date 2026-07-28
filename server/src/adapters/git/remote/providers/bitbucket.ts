import type { GitRemoteAdapter, GitRemoteRepo, GitBranch, GitPullRequest, GitIssue } from "../adapter.js";

export function createBitbucketAdapter(token?: string): GitRemoteAdapter {
  let authToken = token || "";

  const api = async <T>(path: string, opts: RequestInit = {}): Promise<T> => {
    const headers: Record<string, string> = { "Accept": "application/json", "User-Agent": "straxor" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    if (opts.body) headers["Content-Type"] = "application/json";
    const res = await fetch(`https://api.bitbucket.org/2.0${path}`, { ...opts, headers });
    if (!res.ok) throw new Error(`Bitbucket API error: ${res.status} ${res.statusText}`);
    return res.json();
  };

  return {
    platform: "bitbucket",
    name: "Bitbucket",

    isAuthenticated: () => !!authToken,
    setToken: (token: string) => { authToken = token; },

    async listRepos(): Promise<GitRemoteRepo[]> {
      const data: any = await api("/repositories?role=member&pagelen=100&sort=-updated_on");
      return (data.values || []).map(mapRepo);
    },

    async getRepo(owner: string, repo: string): Promise<GitRemoteRepo> {
      const data: any = await api(`/repositories/${owner}/${repo}`);
      return mapRepo(data);
    },

    async createRepo(name: string, opts?: { description?: string; private?: boolean }): Promise<GitRemoteRepo> {
      const data: any = await api("/repositories", {
        method: "POST",
        body: JSON.stringify({
          scm: "git",
          name,
          description: opts?.description,
          is_private: opts?.private ?? false,
        }),
      });
      return mapRepo(data);
    },

    async forkRepo(owner: string, repo: string): Promise<GitRemoteRepo> {
      const data: any = await api(`/repositories/${owner}/${repo}/forks`, { method: "POST" });
      return mapRepo(data);
    },

    async listBranches(owner: string, repo: string): Promise<GitBranch[]> {
      const data: any = await api(`/repositories/${owner}/${repo}/refs/branches?pagelen=100`);
      return (data.values || []).map((b: any) => ({
        name: b.name,
        commitSha: b.target?.hash || "",
        isDefault: b.name === "main" || b.name === "master",
        protected: false,
      }));
    },

    async createBranch(owner: string, repo: string, name: string, fromSha: string): Promise<void> {
      await api(`/repositories/${owner}/${repo}/refs/branches`, {
        method: "POST",
        body: JSON.stringify({ name, target: { hash: fromSha } }),
      });
    },

    async listPullRequests(owner: string, repo: string, state?: "open" | "closed" | "all"): Promise<GitPullRequest[]> {
      const s = state === "all" ? "OPEN,CLOSED,MERGED" : state === "closed" ? "CLOSED,MERGED" : "OPEN";
      const data: any = await api(`/repositories/${owner}/${repo}/pullrequests?state=${s}&pagelen=100`);
      return (data.values || []).map((pr: any) => ({
        id: pr.id,
        title: pr.title,
        description: pr.description || "",
        sourceBranch: pr.source?.branch?.name || "",
        targetBranch: pr.destination?.branch?.name || "",
        state: pr.state === "MERGED" ? "merged" : pr.state === "CLOSED" ? "closed" : "open",
        author: pr.author?.display_name || pr.author?.nickname || "",
        createdAt: pr.created_on,
        url: pr.links?.html?.href || "",
      }));
    },

    async createPullRequest(owner: string, repo: string, pr: { title: string; description: string; sourceBranch: string; targetBranch: string }): Promise<GitPullRequest> {
      const data: any = await api(`/repositories/${owner}/${repo}/pullrequests`, {
        method: "POST",
        body: JSON.stringify({
          title: pr.title,
          description: pr.description,
          source: { branch: { name: pr.sourceBranch } },
          destination: { branch: { name: pr.targetBranch } },
        }),
      });
      return {
        id: data.id,
        title: data.title,
        description: data.description || "",
        sourceBranch: data.source?.branch?.name || "",
        targetBranch: data.destination?.branch?.name || "",
        state: "open",
        author: data.author?.display_name || "",
        createdAt: data.created_on,
        url: data.links?.html?.href || "",
      };
    },

    async mergePullRequest(owner: string, repo: string, prId: number): Promise<void> {
      await api(`/repositories/${owner}/${repo}/pullrequests/${prId}/merge`, { method: "POST" });
    },

    async listIssues(owner: string, repo: string, state?: "open" | "closed" | "all"): Promise<GitIssue[]> {
      const s = state === "all" ? "open,closed" : state || "open";
      const data: any = await api(`/repositories/${owner}/${repo}/issues?state=${s}&pagelen=100`);
      return (data.values || []).map((i: any) => ({
        id: i.id,
        title: i.title,
        description: i.content?.raw || "",
        state: i.state,
        author: i.reporter?.display_name || i.reporter?.nickname || "",
        labels: i.labels?.map((l: any) => l.name) || [],
        createdAt: i.created_on,
        url: i.links?.html?.href || "",
      }));
    },

    async createIssue(owner: string, repo: string, issue: { title: string; description: string; labels?: string[] }): Promise<GitIssue> {
      const data: any = await api(`/repositories/${owner}/${repo}/issues`, {
        method: "POST",
        body: JSON.stringify({ title: issue.title, content: { raw: issue.description }, labels: issue.labels }),
      });
      return {
        id: data.id,
        title: data.title,
        description: data.content?.raw || "",
        state: data.state,
        author: data.reporter?.display_name || "",
        labels: data.labels?.map((l: any) => l.name) || [],
        createdAt: data.created_on,
        url: data.links?.html?.href || "",
      };
    },
  };
}

function mapRepo(data: any): GitRemoteRepo {
  const owner = data.owner?.display_name || data.owner?.nickname || data.owner?.username || "";
  return {
    id: data.uuid || String(data.id),
    name: data.name || data.slug,
    fullName: `${owner}/${data.name || data.slug}`,
    description: data.description || "",
    url: data.links?.html?.href || "",
    cloneUrl: data.links?.clone?.find((c: any) => c.name === "https")?.href || "",
    sshUrl: data.links?.clone?.find((c: any) => c.name === "ssh")?.href || "",
    platform: "bitbucket",
    private: data.is_private,
    defaultBranch: data.mainbranch?.name || "main",
    language: data.language || "",
    stars: 0,
    forks: 0,
    updatedAt: data.updated_on,
    createdAt: data.created_on,
  };
}
