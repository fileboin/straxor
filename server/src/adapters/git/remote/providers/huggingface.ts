import type { GitRemoteAdapter, GitRemoteRepo, GitBranch, GitPullRequest, GitIssue } from "../adapter.js";

export function createHuggingFaceAdapter(token?: string): GitRemoteAdapter {
  let authToken = token || "";

  const api = async <T>(path: string, opts: RequestInit = {}): Promise<T> => {
    const headers: Record<string, string> = { "User-Agent": "straxor" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    if (opts.body) headers["Content-Type"] = "application/json";
    const url = `https://huggingface.co/api${path}`;
    const res = await fetch(url, { ...opts, headers });
    if (!res.ok) throw new Error(`Hugging Face API error: ${res.status} ${res.statusText}`);
    return res.json();
  };

  return {
    platform: "huggingface",
    name: "Hugging Face Hub",

    isAuthenticated: () => !!authToken,
    setToken: (token: string) => { authToken = token; },

    async listRepos(): Promise<GitRemoteRepo[]> {
      const data: any[] = await api("/repos?type=model&limit=100");
      return data.map(mapRepo);
    },

    async getRepo(owner: string, repo: string): Promise<GitRemoteRepo> {
      const data: any = await api(`/models/${owner}/${repo}`);
      return mapRepo(data);
    },

    async createRepo(name: string, opts?: { description?: string; private?: boolean }): Promise<GitRemoteRepo> {
      const data: any = await api("/repos", {
        method: "POST",
        body: JSON.stringify({ name, description: opts?.description, private: opts?.private ?? false, type: "model" }),
      });
      return mapRepo(data);
    },

    async forkRepo(owner: string, repo: string): Promise<GitRemoteRepo> {
      const data: any = await api(`/models/${owner}/${repo}/fork`, { method: "POST" });
      return mapRepo(data);
    },

    async listBranches(owner: string, repo: string): Promise<GitBranch[]> {
      const data: any[] = await api(`/models/${owner}/${repo}/refs`);
      const branches = data.filter((r: any) => r.ref?.startsWith("refs/heads/"));
      return branches.map((b: any) => ({
        name: b.ref.replace("refs/heads/", ""),
        commitSha: b.sha || "",
        isDefault: b.ref === "refs/heads/main",
        protected: false,
      }));
    },

    async createBranch(owner: string, repo: string, name: string, fromSha: string): Promise<void> {
      await api(`/models/${owner}/${repo}/git/refs`, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${name}`, sha: fromSha }),
      });
    },

    // HF Hub doesn't have native PRs — use discussions as a substitute
    async listPullRequests(_owner: string, _repo: string, _state?: "open" | "closed" | "all"): Promise<GitPullRequest[]> {
      return [];
    },

    async createPullRequest(_owner: string, _repo: string, _pr: { title: string; description: string; sourceBranch: string; targetBranch: string }): Promise<GitPullRequest> {
      throw new Error("Pull requests are not supported on Hugging Face Hub");
    },

    async mergePullRequest(_owner: string, _repo: string, _prId: number): Promise<void> {
      throw new Error("Pull requests are not supported on Hugging Face Hub");
    },

    async listIssues(owner: string, repo: string, state?: "open" | "closed" | "all"): Promise<GitIssue[]> {
      const s = state === "all" ? "" : state || "open";
      const qs = s ? `?status=${s}` : "";
      const data: any[] = await api(`/models/${owner}/${repo}/discussions${qs}&limit=100`);
      return data.map((d: any) => ({
        id: d.num,
        title: d.title,
        description: d.body || "",
        state: d.status,
        author: d.author?.name || "",
        labels: [],
        createdAt: d.created_at,
        url: `https://huggingface.co/${owner}/${repo}/discussions/${d.num}`,
      }));
    },

    async createIssue(owner: string, repo: string, issue: { title: string; description: string; labels?: string[] }): Promise<GitIssue> {
      const data: any = await api(`/models/${owner}/${repo}/discussions`, {
        method: "POST",
        body: JSON.stringify({ title: issue.title, body: issue.description }),
      });
      return {
        id: data.num,
        title: data.title,
        description: data.body || "",
        state: data.status || "open",
        author: data.author?.name || "",
        labels: [],
        createdAt: data.created_at,
        url: `https://huggingface.co/${owner}/${repo}/discussions/${data.num}`,
      };
    },
  };
}

function mapRepo(data: any): GitRemoteRepo {
  const id = data.id || data.modelId || `${data.author?.name || ""}/${data.name || ""}`;
  return {
    id: String(data.id || id),
    name: data.name || data.modelId?.split("/")[1] || "",
    fullName: data.modelId || id,
    description: data.description || data.pipeline_tag || "",
    url: `https://huggingface.co/${data.modelId || id}`,
    cloneUrl: `https://huggingface.co/${data.modelId || id}`,
    sshUrl: `git@hf.co:${data.modelId || id}.git`,
    platform: "huggingface",
    private: data.private ?? false,
    defaultBranch: "main",
    language: data.pipeline_tag || "",
    stars: data.likes || 0,
    forks: 0,
    updatedAt: data.lastModified || data.created_at,
    createdAt: data.created_at,
  };
}
