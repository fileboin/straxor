// ── FAZA 7d — Team fan-out → CLOSED LOOP (approve → commit → push) ──
// Extends the team flow so approving a WAITING_APPROVAL run commits the
// combined sandbox changes to the active repo and (optionally) pushes them.
// This suite runs the REAL Express routes + the REAL workspace module against
// a local `--bare` repo standing in for github.com/<owner>/<repo>; only the
// database, token registry, task/job persistence, and the runtime adapter are
// mocked (no Neon DB, no engine spawn, no network).
//
// Covered contracts:
//   1. happy path: team drains → change in sandbox → approve {diffHash, push}
//      → 200, committed + pushed, task VERIFIED with commitHash, remote HEAD
//      == local HEAD, remote log message matches the commit message
//   2. stale diffHash → 409, nothing committed, task stays WAITING_APPROVAL
//   3. approve when not WAITING_APPROVAL → 400
//   4. no active repo → approve still ok (committed:false), task VERIFIED
//   5. approve with push:false → committed but not pushed, remote unchanged

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import jwt from "jsonwebtoken";
import { PassThrough } from "node:stream";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import agentRouter from "./agent.js";
import {
  ensureWorkspace,
  diffWorkspace,
  getRepoWorkspaceDir,
  type WorkspaceRepo,
} from "../runtime/local/workspace.js";

const execFileP = promisify(execFile);

// ── Mutable mock state (hoisted above vi.mock) ──
const dbState = vi.hoisted(() => ({ active: [] as unknown[] }));
const regState = vi.hoisted(() => ({ token: undefined as string | undefined }));
const adapterState = vi.hoisted(() => ({
  sessions: 0,
  messages: [] as { machineId: string; sessionId: string; text: string; system?: string }[],
  inFlight: 0,
  finishDelayMs: 20,
}));
const taskStore = vi.hoisted(() => new Map<string, Record<string, any>>());
const jobStore = vi.hoisted(() => new Map<string, Record<string, any>>());

vi.mock("../db/index.js", () => ({
  db: (() => {
    const chainable = (): unknown => {
      const thenable = {
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(dbState.active).then(resolve, reject),
      };
      return new Proxy(thenable, {
        get(target, prop) {
          if (prop === "then") return (target as typeof thenable).then;
          return () => chainable();
        },
      });
    };
    return chainable();
  })(),
}));

// Token registry — no network, token controllable per test.
vi.mock("../adapters/git/remote/registry.js", () => ({
  getGitRemoteToken: vi.fn(async () => regState.token),
  getGitRemoteAdapter: vi.fn(() => ({ isAuthenticated: () => false })),
  hydrateGitRemoteConfig: vi.fn(async () => {}),
}));

// Keep the turn off the local-engine/workspace path (no engine spawn).
vi.mock("../runtime/local/engine.js", () => ({
  isLocalMachineId: () => false,
  slotFromMachineId: () => "agent",
  stopLocalEnginesForUser: vi.fn(async () => {}),
}));

vi.mock("../runtime/local/shared-workspace.js", () => ({
  withSharedWorkspace: async (_userId: string, work: (ctx: unknown) => Promise<unknown>) => work({}),
  getSharedWorkspaceStatus: async () => ({ connected: false }),
}));

// Controllable runtime adapter (same contract as agent-team.test.ts).
vi.mock("../adapters/registry.js", () => {
  const fakeRuntime = {
    async createSession(_machineId: string, _title: string) {
      adapterState.sessions += 1;
      return { id: `sess-${adapterState.sessions}` };
    },
    async sendMessage(
      machineId: string,
      sessionId: string,
      text: string,
      _mode?: string,
      _attachments?: unknown[],
      system?: string,
    ) {
      adapterState.messages.push({ machineId, sessionId, text, system });
      adapterState.inFlight += 1;
      return { parts: [{ type: "text", text: "ok" }] };
    },
    async openEventStream(_machineId: string) {
      const stream = new PassThrough();
      const last = adapterState.messages[adapterState.messages.length - 1];
      setTimeout(() => {
        adapterState.inFlight = Math.max(0, adapterState.inFlight - 1);
        stream.write(
          `data: ${JSON.stringify({ type: "session.idle", properties: { sessionID: last?.sessionId } })}\n\n`,
        );
        stream.end();
      }, adapterState.finishDelayMs);
      return stream;
    },
    async abortSession() { return true; },
    async listSessions() { return []; },
    async getTodos() { return []; },
    async getDiff() { return []; },
    async healthCheck() { return { running: true }; },
    async restart() { return {}; },
    async reconnect() { return {}; },
    async updateRuntime() { return {}; },
    async executeCommand() { return ""; },
  };
  return { getAdapters: () => ({ runtime: () => fakeRuntime }), initAdapters: () => ({}) };
});

// In-memory task store that keeps the REAL transition validation.
vi.mock("../lib/tasks.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/tasks.js")>();
  const { canTransition } = await import("../lib/task-state.js");
  let seq = 0;
  return {
    ...actual,
    createTask: async (input: { userId: string; title: string; prompt?: string; repo?: string | null; branch?: string | null }) => {
      seq += 1;
      const id = `task-${seq}`;
      taskStore.set(id, {
        id,
        userId: input.userId,
        title: input.title,
        prompt: input.prompt ?? "",
        repo: input.repo ?? null,
        branch: input.branch ?? null,
        status: "QUEUED",
        commitHash: null,
        diff: null,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { id };
    },
    getTask: async (userId: string, taskId: string) => {
      const t = taskStore.get(taskId);
      return t && t.userId === userId ? t : null;
    },
    transitionTaskStatus: async (userId: string, taskId: string, to: string, patch: Record<string, any> = {}) => {
      const t = taskStore.get(taskId);
      if (!t || t.userId !== userId) throw new Error("Task not found");
      const from = t.status as string;
      if (from !== to && !canTransition(from as never, to as never)) {
        throw new Error(`Invalid task transition: ${from} -> ${to}`);
      }
      Object.assign(t, { status: to, updatedAt: new Date(), ...patch });
      return true;
    },
    setTaskFields: async (userId: string, taskId: string, patch: Record<string, any>) => {
      const t = taskStore.get(taskId);
      if (t && t.userId === userId) Object.assign(t, patch, { updatedAt: new Date() });
    },
  };
});

// In-memory job store (same contract as agent-team.test.ts).
vi.mock("../lib/agent-jobs.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/agent-jobs.js")>();
  return {
    ...actual,
    createAgentJob: async (input: { id: string; userId: string; machineId: string; sessionId: string; taskId?: string | null; label?: string | null }) => {
      jobStore.set(input.id, {
        id: input.id,
        userId: input.userId,
        machineId: input.machineId,
        sessionId: input.sessionId,
        taskId: input.taskId ?? null,
        label: input.label ?? null,
        status: "running",
        error: null,
        finished: false,
        timeline: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    },
    updateAgentJob: async (userId: string, jobId: string, patch: Record<string, any>) => {
      const j = jobStore.get(jobId);
      if (j && j.userId === userId) Object.assign(j, patch, { updatedAt: new Date() });
    },
    finishAgentJob: async (userId: string, jobId: string, status: string, error: string | null, timeline: unknown[]) => {
      const j = jobStore.get(jobId);
      if (j && j.userId === userId) Object.assign(j, { status, error, finished: true, timeline, updatedAt: new Date() });
    },
    getAgentJob: async (userId: string, jobId: string) => {
      const j = jobStore.get(jobId);
      return j && j.userId === userId ? j : null;
    },
    listAgentJobsForTask: async (userId: string, taskId: string) => {
      return Array.from(jobStore.values()).filter((j) => j.userId === userId && j.taskId === taskId);
    },
  };
});

const USER_ID = "team-loop-user";
const OWNER = "fileboin";
const NAME = "team-loop-repo";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const bearer = jwt.sign({ userId: USER_ID, email: "loop@straxor.test", role: "user" }, JWT_SECRET);

let tmpRoot = "";
let remoteDir = "";
let server: Server;
let baseUrl = "";

async function git(args: string[], cwd?: string): Promise<string> {
  const { stdout, stderr } = await execFileP("git", args, {
    cwd,
    timeout: 30_000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  return (stdout + stderr).trim();
}

function gitAvailable(): boolean {
  try {
    require("child_process").execFileSync("git", ["--version"], { stdio: "ignore", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}
const describeRouteE2E = gitAvailable() ? describe : describe.skip;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/agent", agentRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "straxor-team-loop-"));
  process.env.STRAXOR_WORKSPACE_DIR = path.join(tmpRoot, "workspaces");
  dbState.active = [];
  regState.token = "ghp_dummy_token";
  adapterState.sessions = 0;
  adapterState.messages = [];
  adapterState.inFlight = 0;
  adapterState.finishDelayMs = 20;
  taskStore.clear();
  jobStore.clear();

  // Local seed repo + bare mirror that plays the role of the GitHub origin.
  const seed = path.join(tmpRoot, "seed");
  fs.mkdirSync(seed, { recursive: true });
  await git(["init", "-b", "main"], seed).catch(async () => {
    await git(["init"], seed);
    await git(["checkout", "-b", "main"], seed);
  });
  fs.writeFileSync(path.join(seed, "README.md"), "# team loop\n");
  await git(["add", "-A"], seed);
  await git(["-c", "user.name=Test Author", "-c", "user.email=test@straxor.test", "commit", "-m", "initial commit"], seed);
  remoteDir = path.join(tmpRoot, "remote.git");
  await git(["clone", "--bare", seed, remoteDir]);
});

afterEach(() => {
  delete process.env.STRAXOR_WORKSPACE_DIR;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function activeRow() {
  return {
    id: "conn-1",
    userId: USER_ID,
    platform: "github",
    owner: OWNER,
    name: NAME,
    fullName: `${OWNER}/${NAME}`,
    cloneUrl: remoteDir,
    defaultBranch: "main",
    isActive: true,
    slot: "agent",
    connectionType: "token",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function repo(): WorkspaceRepo {
  return {
    userId: USER_ID,
    platform: "github",
    owner: OWNER,
    name: NAME,
    fullName: `${OWNER}/${NAME}`,
    cloneUrl: remoteDir,
    defaultBranch: "main",
    token: regState.token,
  };
}

async function post(route: string, body?: unknown): Promise<{ status: number; body: any }> {
  const res = await fetch(baseUrl + route, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: body === undefined ? "{}" : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function get(route: string): Promise<{ status: number; body: any }> {
  const res = await fetch(baseUrl + route, { headers: { Authorization: `Bearer ${bearer}` } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForTaskStatus(taskId: string, status: string, timeoutMs = 9000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await get(`/api/agent/team/${taskId}`);
    if (r.status === 200 && r.body.task?.status === status) return r.body;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for task status ${status}`);
}

/** Clone the workspace and make a tracked-file change (so git diff sees it). */
async function makeSandboxChange(): Promise<{ dir: string; hash: string }> {
  await ensureWorkspace(repo());
  const dir = getRepoWorkspaceDir(USER_ID, OWNER, NAME);
  fs.writeFileSync(path.join(dir, "README.md"), "# team loop\n\nchanged by the team\n");
  const { hash } = await diffWorkspace(USER_ID, OWNER, NAME);
  expect(hash).toMatch(/^[0-9a-f]{64}$/);
  return { dir, hash };
}

/**
 * Write a real npm fixture (build + node --test) into a cloned sandbox so the
 * FAZA 8 verification gate has something to run. `failing` adds a test that
 * always throws.
 */
async function writeFixture(dir: string, failing = false): Promise<void> {
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "test"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "team-verify-app",
        version: "1.0.0",
        private: true,
        scripts: { build: "node scripts/build.js", test: "node --test" },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(dir, "src", "index.js"),
    'module.exports = function greet(name) { return "hello " + name; };\n',
  );
  fs.writeFileSync(
    path.join(dir, "scripts", "build.js"),
    [
      'const fs = require("fs");',
      'const path = require("path");',
      'const src = fs.readFileSync(path.join(__dirname, "..", "src", "index.js"), "utf8");',
      'if (!src.includes("greet")) throw new Error("missing greet");',
      'console.log("build ok");',
      "",
    ].join("\n"),
  );
  if (failing) {
    fs.writeFileSync(
      path.join(dir, "test", "fail.test.js"),
      ['const test = require("node:test");', 'test("boom", () => { throw new Error("boom"); });', ""].join("\n"),
    );
  } else {
    fs.writeFileSync(
      path.join(dir, "test", "index.test.js"),
      [
        'const test = require("node:test");',
        'const assert = require("node:assert");',
        'const greet = require("../src/index.js");',
        'test("greet works", () => assert.strictEqual(greet("world"), "hello world"));',
        "",
      ].join("\n"),
    );
  }
}

describeRouteE2E("FAZA 7d — Team approve → commit → push (HTTP E2E, offline)", () => {
  it("1. happy path: approve with diffHash + push commits and pushes, task VERIFIED", async () => {
    dbState.active = [activeRow()];
    const start = await post("/api/agent/team", { prompt: "Add a feature" });
    expect(start.status).toBe(200);
    const taskId = start.body.taskId as string;
    await waitForTaskStatus(taskId, "WAITING_APPROVAL");

    const { hash } = await makeSandboxChange();

    const approve = await post(`/api/agent/team/${taskId}/approve`, {
      push: true,
      commitMessage: "team: add a feature",
      diffHash: hash,
    });
    expect(approve.status).toBe(200);
    expect(approve.body.ok).toBe(true);
    expect(approve.body.status).toBe("VERIFIED");
    expect(approve.body.committed).toBe(true);
    expect(approve.body.pushed).toBe(true);
    expect(approve.body.hash).toMatch(/^[0-9a-f]{7,}$/);

    // Task is VERIFIED and carries the commit hash.
    const detail = await get(`/api/agent/team/${taskId}`);
    expect(detail.body.task.status).toBe("VERIFIED");
    expect(detail.body.task.commitHash).toBe(approve.body.hash);

    // Remote HEAD == local HEAD and the commit message is on the remote.
    const dir = getRepoWorkspaceDir(USER_ID, OWNER, NAME);
    const localHead = await git(["rev-parse", "HEAD"], dir);
    const remoteHead = await git(["--git-dir", remoteDir, "rev-parse", "main"]);
    expect(remoteHead).toBe(localHead);
    expect(await git(["--git-dir", remoteDir, "log", "-1", "--format=%s"])).toBe("team: add a feature");
  });

  it("2. a STALE diffHash refuses the commit (409) and the task stays WAITING_APPROVAL", async () => {
    dbState.active = [activeRow()];
    const start = await post("/api/agent/team", { prompt: "Another feature" });
    const taskId = start.body.taskId as string;
    await waitForTaskStatus(taskId, "WAITING_APPROVAL");

    await makeSandboxChange();

    const approve = await post(`/api/agent/team/${taskId}/approve`, {
      push: true,
      diffHash: "0".repeat(64),
    });
    expect(approve.status).toBe(409);
    expect(approve.body.diffChanged).toBe(true);
    expect(approve.body.committed).toBe(false);

    // Nothing reached the remote and the task is still awaiting approval.
    expect(await git(["--git-dir", remoteDir, "log", "-1", "--format=%s"])).toBe("initial commit");
    const detail = await get(`/api/agent/team/${taskId}`);
    expect(detail.body.task.status).toBe("WAITING_APPROVAL");
  });

  it("3. approving a run that is not WAITING_APPROVAL → 400", async () => {
    dbState.active = [activeRow()];
    const start = await post("/api/agent/team", { prompt: "Immediate approve" });
    const taskId = start.body.taskId as string;
    // Approve before the run drains (status is RUNNING).
    const approve = await post(`/api/agent/team/${taskId}/approve`, { push: false });
    expect(approve.status).toBe(400);
    expect(String(approve.body.error)).toContain("WAITING_APPROVAL");
    // Drain so the shared slot is free for any later test.
    await waitForTaskStatus(taskId, "WAITING_APPROVAL");
  });

  it("4. no active repo → approval still works (committed:false), task VERIFIED", async () => {
    dbState.active = [];
    const start = await post("/api/agent/team", { prompt: "Docs only" });
    const taskId = start.body.taskId as string;
    await waitForTaskStatus(taskId, "WAITING_APPROVAL");

    const approve = await post(`/api/agent/team/${taskId}/approve`, { push: true });
    expect(approve.status).toBe(200);
    expect(approve.body.ok).toBe(true);
    expect(approve.body.committed).toBe(false);
    expect(approve.body.status).toBe("VERIFIED");
  });

  it("5. approve with push:false commits locally but does not push", async () => {
    dbState.active = [activeRow()];
    const start = await post("/api/agent/team", { prompt: "Local commit only" });
    const taskId = start.body.taskId as string;
    await waitForTaskStatus(taskId, "WAITING_APPROVAL");

    const { hash } = await makeSandboxChange();
    const approve = await post(`/api/agent/team/${taskId}/approve`, {
      push: false,
      commitMessage: "team: local only",
      diffHash: hash,
    });
    expect(approve.status).toBe(200);
    expect(approve.body.committed).toBe(true);
    expect(approve.body.pushed).toBe(false);
    expect(approve.body.status).toBe("VERIFIED");

    // Remote is untouched while the local sandbox has the commit.
    expect(await git(["--git-dir", remoteDir, "log", "-1", "--format=%s"])).toBe("initial commit");
    const dir = getRepoWorkspaceDir(USER_ID, OWNER, NAME);
    expect(await git(["log", "-1", "--format=%s"], dir)).toBe("team: local only");
  });

  it("6. a passing build+test verifies the run (VERIFYING → WAITING_APPROVAL) and records the result", async () => {
    dbState.active = [activeRow()];
    const start = await post("/api/agent/team", { prompt: "Add verified feature" });
    const taskId = start.body.taskId as string;

    // Make the sandbox exist with a real (passing) npm fixture BEFORE the
    // 3s verification-gate tick fires.
    await ensureWorkspace(repo());
    await writeFixture(getRepoWorkspaceDir(USER_ID, OWNER, NAME));

    const detail = await waitForTaskStatus(taskId, "WAITING_APPROVAL");
    expect(detail.task.verify).toBeTruthy();
    expect(detail.task.verify.skipped).toBe(false);
    expect(detail.task.verify.passed).toBe(true);
    const names = detail.task.verify.steps.map((s: { name: string }) => s.name);
    expect(names).toContain("build");
    expect(names).toContain("test");
    const build = detail.task.verify.steps.find((s: any) => s.name === "build");
    const test = detail.task.verify.steps.find((s: any) => s.name === "test");
    expect(build.exitCode).toBe(0);
    expect(test.exitCode).toBe(0);
  });

  it("7. a failing test fails the whole team run (VERIFYING → FAILED) with the error captured", async () => {
    dbState.active = [activeRow()];
    const start = await post("/api/agent/team", { prompt: "Add broken feature" });
    const taskId = start.body.taskId as string;

    await ensureWorkspace(repo());
    await writeFixture(getRepoWorkspaceDir(USER_ID, OWNER, NAME), true);

    const detail = await waitForTaskStatus(taskId, "FAILED");
    expect(detail.task.verify).toBeTruthy();
    expect(detail.task.verify.passed).toBe(false);
    expect(String(detail.task.error)).toContain("Verifikacija nije prošla");
    expect(String(detail.task.error)).toContain("test");
  });
});
