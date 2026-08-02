import { describe, it, expect, vi, afterEach } from "vitest";
import { createGitHubAdapter } from "./github";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetch(ok: boolean, data: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status, json: async () => data }))
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

  it("listRepos baca greÅ¡ku kad API odbije", async () => {
    mockFetch(false, { message: "Bad credentials" }, 401);
    const a = createGitHubAdapter("ghp_invalid");
    await expect(a.listRepos()).rejects.toThrow(/GitHub API error: 401/);
  });

  it("getRepo koristi /repos/:owner/:repo", async () => {
    mockFetch(true, REPO_RAW);
    const a = createGitHubAdapter("ghp_abc");
    const r = await a.getRepo("fileboin", "straxor");
    expect(r.fullName).toBe("fileboin/straxor");
  });
});
