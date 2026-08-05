// ── Local Workspace Module ──
// Clones/pulls the connected GitHub repo into a server-local sandbox dir so
// agent engines (OpenCode, Crush, ...) can work on it WITHOUT any VPS.
//
// Primary transport: the `git` binary (present on Render node images).
// Fallback: isomorphic-git (pure JS) if the binary is missing.

import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execFileP = promisify(execFile);

export interface WorkspaceRepo {
  userId: string;
  platform: string;
  owner: string;
  name: string;
  fullName: string;
  cloneUrl: string;
  defaultBranch: string;
  token?: string;
}

export interface WorkspaceInfo {
  dir: string;
  branch: string;
  lastCommit: string;
  cloned: boolean;
  gitBinary: boolean;
}

export function getWorkspaceRoot(): string {
  return process.env.STRAXOR_WORKSPACE_DIR || path.join(process.cwd(), ".straxor-workspaces");
}

export function getRepoWorkspaceDir(userId: string, owner: string, name: string): string {
  // Sanitize identifiers so a repo name can never escape the sandbox root.
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeOwner = owner.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(getWorkspaceRoot(), safeUser, `${safeOwner}__${safeName}`);
}

let gitBinaryCheck: boolean | null = null;

export async function hasGitBinary(): Promise<boolean> {
  if (gitBinaryCheck !== null) return gitBinaryCheck;
  try {
    await execFileP("git", ["--version"], { timeout: 5000, windowsHide: true });
    gitBinaryCheck = true;
  } catch {
    gitBinaryCheck = false;
  }
  return gitBinaryCheck;
}

function tokenizedCloneUrl(cloneUrl: string, token?: string): string {
  if (!token) return cloneUrl;
  try {
    const url = new URL(cloneUrl);
    url.username = "x-access-token";
    url.password = token;
    return url.toString();
  } catch {
    return cloneUrl.replace(/^https:\/\//, `https://x-access-token:${token}@`);
  }
}

async function gitExec(cwd: string, args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileP("git", args, {
    cwd,
    timeout: 120000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  return (stdout + stderr).trim();
}

function auth() {
  return () => Promise.resolve({ username: "x-access-token", password: "" });
}

// ── Binary-based implementation ──

async function ensureBinary(cwd: string, repo: WorkspaceRepo): Promise<void> {
  const authUrl = tokenizedCloneUrl(repo.cloneUrl, repo.token);
  const isRepo = fs.existsSync(path.join(cwd, ".git"));

  if (!isRepo) {
    await gitExec(cwd, ["clone", "--no-checkout", "--single-branch", "--branch", repo.defaultBranch || "main", authUrl, "."]);
    await gitExec(cwd, ["checkout", "-B", repo.defaultBranch || "main", "origin/" + (repo.defaultBranch || "main")]);
  } else {
    await gitExec(cwd, ["remote", "set-url", "origin", authUrl]).catch(() => {});
    await gitExec(cwd, ["fetch", "origin", "--prune"]).catch(() => {});
    const head = await gitExec(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]).catch(() => "");
    if (head !== repo.defaultBranch) {
      await gitExec(cwd, ["checkout", "-B", repo.defaultBranch || "main", "origin/" + (repo.defaultBranch || "main")]).catch(() => {});
    }
    await gitExec(cwd, ["pull", "--ff-only", "origin", repo.defaultBranch || "main"]).catch(() => {});
  }
  await gitExec(cwd, ["remote", "set-url", "origin", authUrl]).catch(() => {});
  await gitExec(cwd, ["config", "user.name", "Straxor Agent"]).catch(() => {});
  await gitExec(cwd, ["config", "user.email", "agent@straxor.dev"]).catch(() => {});
}

// ── isomorphic-git fallback ──

async function ensureIsomorphic(cwd: string, repo: WorkspaceRepo): Promise<void> {
  const g = await import("isomorphic-git");
  const http = await import("isomorphic-git/http/node").then((m) => m.default);
  const fsP = fs.promises;
  const isRepo = fs.existsSync(path.join(cwd, ".git"));
  const branch = repo.defaultBranch || "main";

  const onAuth = () => Promise.resolve({ username: "x-access-token", password: repo.token });

  if (!isRepo) {
    await g.clone({ fs: fsP, http, dir: cwd, url: repo.cloneUrl, ref: branch, singleBranch: true, depth: 1, onAuth });
  } else {
    await g.fetch({ fs: fsP, http, dir: cwd, ref: branch, singleBranch: true, depth: 1, onAuth }).catch(() => {});
    await g.merge({ fs: fsP, dir: cwd, ours: branch, theirs: "origin/" + branch, fastForwardOnly: true, abortOnConflict: false }).catch(() => {});
  }
  await g.setConfig({ fs: fsP, dir: cwd, path: "user.name", value: "Straxor Agent" }).catch(() => {});
  await g.setConfig({ fs: fsP, dir: cwd, path: "user.email", value: "agent@straxor.dev" }).catch(() => {});
}

// Push the local sandbox to the remote origin (requires git binary).
export async function pushWorkspace(
  userId: string,
  owner: string,
  name: string,
  branch?: string
): Promise<string> {
  const dir = getRepoWorkspaceDir(userId, owner, name);
  const target = branch || "main";
  return gitExec(dir, ["push", "origin", `HEAD:refs/heads/${target}`]);
}

// Stage all changes and create a commit in the sandbox clone, authored as the
// Straxor Agent identity. Returns the short commit hash. No-op if nothing changed.
export async function commitWorkspace(
  userId: string,
  owner: string,
  name: string,
  message: string,
  branch?: string
): Promise<{ hash: string; committed: boolean; message: string }> {
  const dir = getRepoWorkspaceDir(userId, owner, name);
  await gitExec(dir, ["config", "user.name", "Straxor Agent"]).catch(() => {});
  await gitExec(dir, ["config", "user.email", "agent@straxor.dev"]).catch(() => {});
  await gitExec(dir, ["add", "-A"]).catch(() => {});
  const status = await gitExec(dir, ["status", "--porcelain"]).catch(() => "");
  if (!status.trim()) {
    return { hash: await gitExec(dir, ["rev-parse", "--short", "HEAD"]).catch(() => ""), committed: false, message };
  }
  // Do not swallow a failed commit. Reporting success here would make the
  // following push look like an agent/GitHub failure even though no commit was
  // created (for example a hook or git identity error).
  await gitExec(dir, ["commit", "-m", message]);
  const hash = await gitExec(dir, ["rev-parse", "--short", "HEAD"]);
  return { hash, committed: true, message };
}

export async function ensureWorkspace(repo: WorkspaceRepo): Promise<WorkspaceInfo> {
  const dir = getRepoWorkspaceDir(repo.userId, repo.owner, repo.name);
  await fs.promises.mkdir(dir, { recursive: true });
  const wasRepo = fs.existsSync(path.join(dir, ".git"));

  if (await hasGitBinary()) {
    await ensureBinary(dir, repo);
  } else {
    await ensureIsomorphic(dir, repo);
  }

  let branch = "";
  let lastCommit = "";
  try {
    if (await hasGitBinary()) {
      branch = await gitExec(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
      lastCommit = await gitExec(dir, ["rev-parse", "--short", "HEAD"]);
    } else {
      const g = await import("isomorphic-git");
      const fsP = fs.promises;
      const cur = await g.currentBranch({ fs: fsP, dir, fullname: false }).catch(() => "");
      branch = cur || repo.defaultBranch || "main";
      const log = await g.log({ fs: fsP, dir, depth: 1 }).catch(() => [] as { oid: string }[]);
      lastCommit = log[0]?.oid?.slice(0, 7) || "";
    }
  } catch {}

  return { dir, branch, lastCommit, cloned: !wasRepo, gitBinary: await hasGitBinary() };
}
