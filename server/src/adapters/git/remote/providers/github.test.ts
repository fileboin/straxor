import { describe, it, expect, vi, afterEach } from "vitest";
import { createGitHubAdapter } from "./github";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(ok: boolean, data: unknown, status = 200, linkHeader?: string | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status,
      json: async () => data,
      headers: new Headers(linkHeader ? { Link: linkHeader } : {}),
    }))
  );
}

const REPO_RAW = {
  id: 123,
  name: "straxor",
  full_name: "fileboin/straxor",
  description: "dummy",
  html_url: "https://github.com/fileboin/straxor",
  clone_url: "https://github.com/fileboin/straxor.git",
  ssh_url: "git@github.com:fileboin/straxor.git",
  private: false,
  default_branch: "main",
  language: "TypeScript",
  stargazers_count: 42,
  forks_count: 7,
  updated_at: "2026-01-01T00:00:00Z",
  created_at: "2025-01-01T00:00:00Z",
};

describe("createGitHubAdapter", () => {
  it("isAuthenticated je false bez tokena, true nakon setToken", () => {
    const a = createGitHubAdapter();
    expect(a.isAuthenticated()).toBe(false);
    a.setToken("ghp_abc");
    expect(a.isAuthenticated()).toBe(true);
  });

  it("getUser vraÄ‡a null bez tokena", async () => {
    const a = createGitHubAdapter();
    expect(await a.getUser?.()).toBeNull();
  });

  it("getUser vraÄ‡a username kad /user odgovori", async () => {
    mockFetch(true, { login: "fileboin" });
    const a = createGitHubAdapter("ghp_abc");
    expect(await a.getUser?.()).toEqual({ username: "fileboin" });
  });

  it("getUser vraÄ‡a null kad API odbije (401/403)", async () => {
    mockFetch(false, { message: "Bad credentials" }, 401);
    const a = createGitHubAdapter("ghp_invalid");
    expect(await a.getUser?.()).toBeNull();
  });

  it("getUser vraÄ‡a null kad fetch baci greÅ¡ku", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    const a = createGitHubAdapter("ghp_abc");
    expect(await a.getUser?.()).toBeNull();
  });

  it("listRepos mapira polja (mapRepo)", async () => {
    mockFetch(true, [REPO_RAW]);
    const a = createGitHubAdapter("ghp_abc");
    const repos = await a.listRepos();
    expect(repos).toHaveLength(1);
    const r = repos[0];
    expect(r.fullName).toBe("fileboin/straxor");
    expect(r.cloneUrl).toBe("https://github.com/fileboin/straxor.git");
    expect(r.defaultBranch).toBe("main");
    expect(r.stars).toBe(42);
    expect(r.forks).toBe(7);
    expect(r.platform).toBe("github");
    expect(r.private).toBe(false);
    expect(r.language).toBe("TypeScript");
  });

  it("listRepos baca čitljivu grešku kad API odbije (401 Bad credentials)", async () => {
    mockFetch(false, { message: "Bad credentials" }, 401);
    const a = createGitHubAdapter("ghp_invalid");
    await expect(a.listRepos()).rejects.toThrow(/token nije validan \(401\)/);
  });

  it("listRepos baca jasnu scope grešku na 403 bez potrebnog opsega", async () => {
    mockFetch(false, { message: "Resource not accessible by integration or requires missing scope" }, 403);
    const a = createGitHubAdapter("ghp_scoped");
    await expect(a.listRepos()).rejects.toThrow(/nema dovoljan opseg \(403\)/);
  });

  it("listRepos prati Link header i sakupi sve stranice pagination", async () => {
    const page1 = [REPO_RAW, { ...REPO_RAW, id: 2, full_name: "fileboin/a", name: "a" }];
    const page2 = [{ ...REPO_RAW, id: 3, full_name: "fileboin/b", name: "b" }];
    const BASE = "https://api.github.com";
    const userReposPath = "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member";
    const page1Url = `${BASE}${userReposPath}`;
    const page2Url = `${page1Url}&page=2`;
    const link = `<${page2Url}>; rel="next", <${page2Url}>; rel="last"`;
    const callCount = { n: 0 };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        callCount.n++;
        const u = String(url);
        if (u === `${BASE}/user/orgs?per_page=100`) return { ok: true, status: 200, json: async () => [], headers: new Headers({}) };
        if (u === page2Url) return { ok: true, status: 200, json: async () => page2, headers: new Headers({}) };
        if (u === page1Url) return { ok: true, status: 200, json: async () => page1, headers: new Headers({ Link: link }) };
        return { ok: false, status: 404, json: async () => ({ message: "nope" }), headers: new Headers({}) };
      })
    );

    const a = createGitHubAdapter("ghp_abc");
    const repos = await a.listRepos();
    expect(repos.map((r) => r.fullName)).toEqual(["fileboin/straxor", "fileboin/a", "fileboin/b"]);
    expect(callCount.n).toBe(3); // page1 + page2 + orgs
  });

  it("listRepos pokupi i repoe iz orgova i deduplicira ih", async () => {
    const userRepo = { ...REPO_RAW, full_name: "fileboin/straxor" };
    const orgRepo = { ...REPO_RAW, id: 9, full_name: "acme/widgets", name: "widgets" };
    const BASE = "https://api.github.com";
    const userReposPath = "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member";
    const orgsPath = "/user/orgs?per_page=100";
    const orgReposPath = "/orgs/acme/repos?per_page=100&type=all";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const u = String(url);
        if (u === `${BASE}${orgsPath}`) return { ok: true, status: 200, json: async () => [{ login: "acme" }], headers: new Headers({}) };
        if (u === `${BASE}${orgReposPath}`) return { ok: true, status: 200, json: async () => [orgRepo], headers: new Headers({}) };
        if (u === `${BASE}${userReposPath}`) return { ok: true, status: 200, json: async () => [userRepo], headers: new Headers({}) };
        return { ok: false, status: 404, json: async () => ({ message: "nope" }), headers: new Headers({}) };
      })
    );

    const a = createGitHubAdapter("ghp_abc");
    const repos = await a.listRepos();
    const names = repos.map((r) => r.fullName).sort();
    expect(names).toEqual(["acme/widgets", "fileboin/straxor"]);
  });

  it("listRepos radi i bez tokena/org pristupa (samo lični repoi)", async () => {
    const BASE = "https://api.github.com";
    const userReposPath = "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member";
    const orgsPath = "/user/orgs?per_page=100";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const u = String(url);
        if (u === `${BASE}${orgsPath}`) return { ok: false, status: 403, json: async () => ({ message: "requires missing scope" }), headers: new Headers({}) };
        if (u === `${BASE}${userReposPath}`) return { ok: true, status: 200, json: async () => [REPO_RAW], headers: new Headers({}) };
        return { ok: false, status: 404, json: async () => ({ message: "nope" }), headers: new Headers({}) };
      })
    );
    const a = createGitHubAdapter("ghp_abc");
    const repos = await a.listRepos();
    expect(repos).toHaveLength(1);
    expect(repos[0].fullName).toBe("fileboin/straxor");
  });

  it("getRepo koristi /repos/:owner/:repo", async () => {
    mockFetch(true, REPO_RAW);
    const a = createGitHubAdapter("ghp_abc");
    const r = await a.getRepo("fileboin", "straxor");
    expect(r.fullName).toBe("fileboin/straxor");
  });

  it("validateToken vraća username i canReadRepos kad /user i /user/repos uspiju", async () => {
    const BASE = "https://api.github.com";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const u = String(url);
        if (u === `${BASE}/user`) return { ok: true, status: 200, json: async () => ({ login: "fileboin" }), headers: new Headers({}) };
        if (u === `${BASE}/user/repos?per_page=1&affiliation=owner,collaborator,organization_member`) return { ok: true, status: 200, json: async () => [], headers: new Headers({}) };
        return { ok: false, status: 404, json: async () => ({ message: "nope" }), headers: new Headers({}) };
      })
    );
    const a = createGitHubAdapter("ghp_abc");
    const r = await a.validateToken!();
    expect(r).toEqual({ username: "fileboin", canReadRepos: true });
  });

  it("validateToken baca jasnu grešku kad /user/repos vrati 403 (scope)", async () => {
    const BASE = "https://api.github.com";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const u = String(url);
        if (u === `${BASE}/user`) return { ok: true, status: 200, json: async () => ({ login: "fileboin" }), headers: new Headers({}) };
        if (u === `${BASE}/user/repos?per_page=1&affiliation=owner,collaborator,organization_member`) return { ok: false, status: 403, json: async () => ({ message: "Resource not accessible by integration or requires missing scope" }), headers: new Headers({}) };
        return { ok: false, status: 404, json: async () => ({ message: "nope" }), headers: new Headers({}) };
      })
    );
    const a = createGitHubAdapter("ghp_abc");
    await expect(a.validateToken!()).rejects.toThrow(/nema dovoljan opseg \(403\)/);
  });
});
