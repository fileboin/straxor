import type { GitRemoteAdapter, GitRemoteRepo, GitBranch, GitPullRequest, GitIssue } from "../adapter.js";

const PER_PAGE = 100;
const AFFILIATION = "owner,collaborator,organization_member";

// Parse a GitHub API Link header into a record of rel → URL.
// URLs inside the header may themselves contain commas (e.g. an
// `affiliation=owner,collaborator,organization_member` query), so we match the
// `rel="…"` boundary rather than naively splitting on the comma separator.
// e.g. `<https://api.github.com/user/repos?page=2>; rel="next", …`
function parseLinkHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  const re = /<([^>]*)>[^;]*;\s*rel="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header)) !== null) {
    out[m[2]] = m[1];
  }
  return out;
}

// Build a helpful, deterministic message from a non-2xx GitHub response so the
// UI can tell scope problems (403) from bad credentials (401) from missing
// access without showing the raw token.
function githubErrorMessage(status: number, body: unknown): string {
  const msg = (body as { message?: string })?.message || "";
  if (status === 401) {
    return "GitHub token nije validan (401) — token je nevažeć, istekao ili uklonjen. Sačuvaj novi token.";
  }
  if (status === 403) {
    const scoped = /(requires|missing|scope|permission|not permitted)/i.test(msg);
    if (scoped) {
      return `GitHub token nema dovoljan opseg (403) — tokenu nedostaju tražene dozvole. Za repo pristup treba: classic=repo+read:org, fine-grained=Contents+Metadata (read). Detalj: ${msg}`;
    }
    return `GitHub rate limit / zabranjen pristup (403) — ${msg || "proveri dozvole tokena"}.`;
  }
  if (status === 404) return `GitHub resurs nije pronađen (404) — ${msg || ""}`.trim();
  return `GitHub API error: ${status} ${msg || ""}`.trim();
}

export function createGitHubAdapter(token?: string): GitRemoteAdapter {
  let authToken = token || "";

  // Same-origin fetch wrapper that returns the raw Response (so callers can
  // read the Link header for pagination) and throws a clear 401/403 error.
  const apiResponse = async (path: string, opts: RequestInit = {}): Promise<Response> => {
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "straxor",
    };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    if (opts.body) headers["Content-Type"] = "application/json";
    const res = await fetch(`https://api.github.com${path}`, { ...opts, headers });
    if (!res.ok) {
      let body: unknown = null;
      try { body = await res.json(); } catch { /* non-JSON error body */ }
      throw new Error(githubErrorMessage(res.status, body));
    }
    return res;
  };

  const api = async <T>(path: string, opts: RequestInit = {}): Promise<T> => {
    const res = await apiResponse(path, opts);
    return res.json();
  };

  // Paginate every page of a GitHub resource by following the Link header
  // (rel="next"), returning the concatenated array. Handles any page count;
  // avoids the 100-repo ceiling that a single per_page=100 call would hit.
  const paginate = async (firstPath: string, opts: RequestInit = {}): Promise<any[]> => {
    const all: any[] = [];
    let url: string | null = `https://api.github.com${firstPath}`;
    while (url) {
      const res = await fetch(url, {
        ...opts,
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "straxor",
        },
      });
      if (!res.ok) {
        let body: unknown = null;
        try { body = await res.json(); } catch { /* ignore */ }
        throw new Error(githubErrorMessage(res.status, body));
      }
      const page: any[] = await res.json();
      all.push(...page);
      const rel = parseLinkHeader(res.headers.get("Link"));
      url = rel.next ?? null;
    }
    return all;
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

    // Verify the token can actually read repositories — not just confirm it is
    // syntactically valid. A token that fails /user but can read repos is still
    // usable; a token that cannot read repos throws a clear 401/403 error.
    async validateToken(): Promise<{ username: string; canReadRepos: boolean } | null> {
      if (!authToken) return null;
      let user: { username: string } | null = null;
      try {
        const data: any = await api("/user");
        user = { username: data.login };
      } catch {
        // /user can 401 on a fine-grained token limited to a single repo while
        // repo listing still works — don't reject solely on /user failure.
      }
      try {
        await api(`/user/repos?per_page=1&affiliation=${AFFILIATION}`);
        return { username: user?.username || "unknown", canReadRepos: true };
      } catch (e) {
        // Re-throw the adapter's own 401/403 message (bad creds vs missing scope).
        throw e;
      }
    },

    async listRepos(): Promise<GitRemoteRepo[]> {
      // Paginate every page of a GitHub resource by following the Link header
      // (rel="next"), returning the concatenated array. Handles any page count;
      // avoids the 100-repo ceiling that a single per_page=100 call would hit.
      // Errors (401/403/404/rate-limit) throw a clear message — never a silent [].
      const collect = (path: string): Promise<any[]> => paginate(path);

      // 1) Personal + collaborator + already-member repos (fully paginated).
      const userRepos = await collect(
        `/user/repos?per_page=${PER_PAGE}&sort=updated&affiliation=${AFFILIATION}`
      );

      // 2) Repos from every organisation the user belongs to and can see.
      // `/user/repos` already covers org repos the token can list, but some
      // org memberships are private or require an explicit per-org query, so
      // list /orgs/{org}/repos too and de-duplicate.
      const orgSlugs: string[] = [];
      try {
        const orgs = await collect(`/user/orgs?per_page=${PER_PAGE}`);
        for (const org of orgs) orgSlugs.push(org.login);
      } catch {
        // Token may not expose orgs (e.g. fine-grained without org scope) —
        // personal repos still work; don't fail the whole list for that.
        console.warn("[github] could not list orgs — continuing with user repos");
      }

      // Fetch repos for each org individually (paginated). Failures on one org
      // shouldn't wipe the whole result set.
      const orgRepos: any[] = [];
      for (const org of orgSlugs) {
        try {
          orgRepos.push(...(await collect(`/orgs/${encodeURIComponent(org)}/repos?per_page=${PER_PAGE}&type=all`)));
        } catch (e) {
          console.warn(`[github] could not list repos for org ${org}: ${(e as Error).message}`);
        }
      }

      const byFullName = new Map<string, any>();
      for (const repo of [...userRepos, ...orgRepos]) byFullName.set(repo.full_name, repo);

      return [...byFullName.values()].map(mapRepo);
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
