// ── Local Workspace Module ──
// Clones/pulls the connected GitHub repo into a server-local sandbox dir so
// agent engines (OpenCode, Crush, ...) can work on it WITHOUT any VPS.
//
// Primary transport: the `git` binary (present on Render node images).
// Fallback: isomorphic-git (pure JS) if the binary is missing.

import { execFile } from "child_process";
import { promisify } from "util";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { getTerminalOutput, startTerminalProcess, waitForTerminalExit } from "../../lib/terminal.js";

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

// Bare per-user sandbox used when there is no connected repo — the interactive
// Terminal tab runs here (npm/git/build) so it is usable without a GitHub repo.
export function getBareWorkspaceDir(userId: string, slot: string = "agent"): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeSlot = slot.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(getWorkspaceRoot(), safeUser, `__${safeSlot}`);
}

// Per-task workspace lives OUTSIDE the repo clone (under <root>/<userId>/tasks/)
// so an agent working in a task workspace never pollutes the project repo's
// `git status` (workspace isolation, Iteration 0).
export function getTaskWorkspaceDir(userId: string, taskId: string): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeTask = taskId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(getWorkspaceRoot(), safeUser, "tasks", safeTask);
}

/**
 * Collect task workspace directories under `root` for the cleanup janitor.
 * Scans <root>/<userId>/tasks/<taskId>; never throws on a missing/empty root.
 */
export function collectTaskWorkspaceDirs(root: string): string[] {
  const out: string[] = [];
  let userDirs: string[] = [];
  try {
    userDirs = fs.readdirSync(root);
  } catch {
    return out;
  }
  for (const userDir of userDirs) {
    const userPath = path.join(root, userDir);
    let userStat: fs.Stats;
    try {
      userStat = fs.statSync(userPath);
    } catch {
      continue;
    }
    if (!userStat.isDirectory()) continue;
    const tasksRoot = path.join(userPath, "tasks");
    let taskDirs: string[] = [];
    try {
      taskDirs = fs.readdirSync(tasksRoot);
    } catch {
      continue;
    }
    for (const td of taskDirs) {
      const p = path.join(tasksRoot, td);
      let s: fs.Stats;
      try {
        s = fs.statSync(p);
      } catch {
        continue;
      }
      if (s.isDirectory()) out.push(p);
    }
  }
  return out;
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

// Porcelain output is column-aligned (e.g. " M path"), so trimming would strip
// the leading status column and corrupt path parsing. Return it verbatim.
async function gitExecRaw(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileP("git", args, {
    cwd,
    timeout: 120000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  return stdout;
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

export interface WorkspaceFileStatus {
  path: string;
  status: "modified" | "added" | "deleted" | "untracked" | "renamed";
}

/**
 * Map the two-char porcelain status code to the GitAdapter vocabulary.
 * Renames use the "X -> Y" form on the path column; everything else keeps
 * only the real file path.
 */
function parsePorcelainLine(line: string): WorkspaceFileStatus | null {
  if (!line || line.length < 3) return null;
  const code = line.slice(0, 2).trim();
  const rest = line.slice(3);
  if (!code && !rest) return null;

  if (rest.includes(" -> ")) {
    const target = rest.split(" -> ").pop()?.trim() || rest;
    return { path: target, status: "renamed" };
  }
  if (code === "??") return { path: rest.trim(), status: "untracked" };
  if (code.startsWith("A")) return { path: rest.trim(), status: "added" };
  if (code.startsWith("D")) return { path: rest.trim(), status: "deleted" };
  if (code.startsWith("M")) return { path: rest.trim(), status: "modified" };
  if (code.startsWith("R")) return { path: rest.trim(), status: "renamed" };
  return { path: rest.trim(), status: "modified" };
}

/** List changed/untracked files in the local sandbox (porcelain). */
export async function statusWorkspace(
  userId: string,
  owner: string,
  name: string,
): Promise<WorkspaceFileStatus[]> {
  const dir = getRepoWorkspaceDir(userId, owner, name);
  const raw = await gitExecRaw(dir, ["status", "--porcelain"]).catch(() => "");
  return raw
    .split("\n")
    .map(parsePorcelainLine)
    .filter((s): s is WorkspaceFileStatus => s !== null);
}

export interface WorkspaceDiff {
  stat: string;
  diff: string;
  /** SHA-256 of the diff text — binds an approval to the exact diff shown. */
  hash: string;
}

/**
 * Generate the unified diff (unstaged + staged) for the local sandbox so the
 * approval step can show exactly what the agent changed before commit/push.
 */
export async function diffWorkspace(
  userId: string,
  owner: string,
  name: string,
): Promise<WorkspaceDiff> {
  const dir = getRepoWorkspaceDir(userId, owner, name);
  const unstagedDiff = await gitExec(dir, ["diff"]).catch(() => "");
  const stagedDiff = await gitExec(dir, ["diff", "--cached"]).catch(() => "");
  const unstagedStat = await gitExec(dir, ["diff", "--stat"]).catch(() => "");
  const stagedStat = await gitExec(dir, ["diff", "--cached", "--stat"]).catch(() => "");
  const diff = [stagedDiff, unstagedDiff].filter(Boolean).join("\n");
  return {
    stat: [stagedStat, unstagedStat].filter(Boolean).join("\n"),
    diff,
    hash: diffHash(diff),
  };
}

/** SHA-256 of a diff string (used as the approval fingerprint). */
export function diffHash(diff: string): string {
  return createHash("sha256").update(diff, "utf8").digest("hex");
}

export interface WorkspaceCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface WorkspaceVerifyStep {
  name: "install" | "build" | "test";
  command: string;
  args: string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  passed: boolean;
}

export interface WorkspaceVerifyResult {
  steps: WorkspaceVerifyStep[];
  passed: boolean;
  /** True when the fixture has no npm scripts to verify at all. */
  skipped: boolean;
}

async function detectScripts(cwd: string): Promise<{ build?: string; test?: string }> {
  try {
    const raw = await fs.promises.readFile(path.join(cwd, "package.json"), "utf8");
    const scripts = (JSON.parse(raw) as { scripts?: Record<string, string> }).scripts || {};
    return { build: scripts.build, test: scripts.test };
  } catch {
    return {};
  }
}

export interface WorkspaceVerifyOptions {
  /** Install deps first (auto-runs when node_modules is missing). */
  install?: boolean;
  /** Run `npm run build` (default true; skipped when no build script). */
  build?: boolean;
  /** Run `npm test` (default true; skipped when no test script). */
  test?: boolean;
  timeoutMs?: number;
  taskId?: string | null;
}

/**
 * Iteration 4 — Verification: run the project's build + test commands in the
 * sandbox through the TerminalManager and return a structured report. `passed`
 * is true only when every executed step exited 0. A fixture without any npm
 * scripts reports `skipped` so the caller can decide how to treat it.
 */
export async function verifyWorkspace(
  userId: string,
  owner: string,
  name: string,
  options: WorkspaceVerifyOptions = {},
): Promise<WorkspaceVerifyResult> {
  const dir = getRepoWorkspaceDir(userId, owner, name);
  const scripts = await detectScripts(dir);
  const hasNodeModules = fs.existsSync(path.join(dir, "node_modules"));
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const steps: WorkspaceVerifyStep[] = [];

  const run = async (step: WorkspaceVerifyStep["name"], command: string, args: string[]) => {
    const result = await runWorkspaceCommand(userId, owner, name, command, args, {
      timeoutMs: options.timeoutMs,
      taskId: options.taskId ?? null,
    });
    steps.push({
      name: step,
      command,
      args,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      passed: result.exitCode === 0,
    });
  };

  if (options.install !== false && !hasNodeModules) {
    await run("install", npm, ["install", "--no-audit", "--no-fund"]);
  }
  if (options.build !== false && scripts.build) {
    await run("build", npm, ["run", "build"]);
  }
  if (options.test !== false && scripts.test) {
    await run("test", npm, ["run", "test"]);
  }

  if (steps.length === 0) {
    return { steps, passed: false, skipped: true };
  }
  return { steps, passed: steps.every((s) => s.passed), skipped: false };
}

export interface ApproveResult {
  committed: boolean;
  hash: string;
  message: string;
  /** True when the current diff no longer matches the one the user approved. */
  diffChanged: boolean;
  /** True when there is nothing to commit. */
  empty: boolean;
}

/**
 * Iteration 4 — Approval gate: commit the sandbox changes ONLY if the current
 * diff still matches the fingerprint the user approved. Passing a stale
 * `expectedDiffHash` (files changed since the diff was shown) refuses the
 * commit so an unapproved change can never sneak into the repository.
 */
export async function approveAndCommitWorkspace(
  userId: string,
  owner: string,
  name: string,
  message: string,
  expectedDiffHash?: string,
): Promise<ApproveResult> {
  const diff = await diffWorkspace(userId, owner, name);
  if (expectedDiffHash && diff.hash !== expectedDiffHash) {
    return { committed: false, hash: "", message, diffChanged: true, empty: false };
  }
  if (!diff.diff.trim()) {
    return { committed: false, hash: "", message, diffChanged: false, empty: true };
  }
  const result = await commitWorkspace(userId, owner, name, message);
  return {
    committed: result.committed,
    hash: result.hash,
    message: result.message,
    diffChanged: false,
    empty: false,
  };
}

export interface WorkspaceCommandOptions {
  timeoutMs?: number;
  env?: Record<string, string>;
  taskId?: string | null;
}

/**
 * Run a command (npm install / build / test / ...) inside the local sandbox,
 * capture stdout/stderr and mirror the run into the in-memory ProcessRegistry
 * (Iteration 0) so it can be observed and cancelled from the API.
 */
export function runWorkspaceCommand(
  userId: string,
  owner: string,
  name: string,
  command: string,
  args: string[] = [],
  options: WorkspaceCommandOptions = {},
): Promise<WorkspaceCommandResult> {
  const dir = getRepoWorkspaceDir(userId, owner, name);
  const started = Date.now();
  return (async () => {
    const { processId } = startTerminalProcess({
      userId,
      cwd: dir,
      command,
      args,
      taskId: options.taskId ?? null,
      timeoutMs: options.timeoutMs,
      env: options.env,
    });
    const exit = await waitForTerminalExit(processId);
    const out = getTerminalOutput(processId);
    return {
      exitCode: exit.exitCode ?? null,
      stdout: out.stdout,
      stderr: out.stderr,
      durationMs: Date.now() - started,
    };
  })();
}
