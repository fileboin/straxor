// ── FAZA 6 — App-level push kroz HTTP tok (POST /api/repos/push) ──
// Verifies the REAL Express route the UI calls, end to end and offline: the
// database and token registry are mocked (no Neon DB / no network needed),
// while the git mechanics — clone → commit → push → remote HEAD — run for real
// against a local `--bare` repo that stands in for github.com/<owner>/<repo>.
//
// Covered contracts:
//   1. happy path: /prepare → agent edit → /commit → /push → 200 + remote HEAD
//   2. no active repo        → 404
//   3. active repo, no token → 401
//   4. token but no write    → 403 (permission-denied mapping)

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { execFile, execFileSync } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import reposRouter from "./repos.js";
import { getRepoWorkspaceDir } from "../runtime/local/workspace.js";

const execFileP = promisify(execFile);

// ── Mutable mock state (hoisted above vi.mock) ──
const dbState = vi.hoisted(() => ({ active: [] as unknown[] }));
const regState = vi.hoisted(() => ({ token: undefined as string | undefined }));
const wsState = vi.hoisted(() => ({ pushError: null as string | null }));

// Mock the Postgres-backed db layer: every drizzle chain resolves to dbState.active.
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

// Mock the token registry (encrypted DB rows + GitHub adapter) — no network.
vi.mock("../adapters/git/remote/registry.js", () => ({
  hydrateGitRemoteConfig: vi.fn(async () => {}),
  getGitRemoteToken: vi.fn(async () => regState.token),
  getGitRemoteAdapter: vi.fn(() => ({ isAuthenticated: () => false })),
}));

// Mock only the engine lifecycle (pulls in opencode-model/ssh2); not needed here.
vi.mock("../runtime/local/engine.js", () => ({
  stopLocalEnginesForUser: vi.fn(async () => {}),
}));

// Wrap the real workspace module: everything is real except pushWorkspace can
// be forced to throw the exact "permission denied" error GitHub returns.
vi.mock("../runtime/local/workspace.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../runtime/local/workspace.js")>();
  return {
    ...actual,
    pushWorkspace: async (userId: string, owner: string, name: string, branch?: string) => {
      if (wsState.pushError) throw new Error(wsState.pushError);
      return actual.pushWorkspace(userId, owner, name, branch);
    },
  };
});

const execFilePSync = execFileSync;
function gitAvailable(): boolean {
  try {
    execFilePSync("git", ["--version"], { stdio: "ignore", windowsHide: true });
    return true;
  } catch {
    return false;
  }
}
const describeRouteE2E = gitAvailable() ? describe : describe.skip;

async function git(args: string[], cwd?: string): Promise<string> {
  const { stdout, stderr } = await execFileP("git", args, {
    cwd,
    timeout: 30_000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  return (stdout + stderr).trim();
}

const USER_ID = "route-e2e-user";
const OWNER = "fileboin";
const NAME = "route-e2e-repo";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const bearer = jwt.sign({ userId: USER_ID, email: "route@straxor.test", role: "user" }, JWT_SECRET);

let tmpRoot = "";
let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/repos", reposRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "straxor-route-e2e-"));
  process.env.STRAXOR_WORKSPACE_DIR = tmpRoot;
  dbState.active = [];
  regState.token = undefined;
  wsState.pushError = null;
});

afterEach(() => {
  delete process.env.STRAXOR_WORKSPACE_DIR;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

async function initMain(dir: string): Promise<void> {
  try {
    await git(["init", "-b", "main"], dir);
  } catch {
    await git(["init"], dir);
    await git(["checkout", "-b", "main"], dir);
  }
}

/** Local seed repo + bare mirror that plays the role of the GitHub origin. */
async function setupRemote(): Promise<string> {
  const seed = path.join(tmpRoot, "seed");
  fs.mkdirSync(seed, { recursive: true });
  await initMain(seed);
  fs.writeFileSync(path.join(seed, "README.md"), "# route e2e\n");
  await git(["add", "-A"], seed);
  await git(["-c", "user.name=Test Author", "-c", "user.email=test@straxor.test", "commit", "-m", "initial commit"], seed);
  const bare = path.join(tmpRoot, "remote.git");
  await git(["clone", "--bare", seed, bare]);
  return bare;
}

function activeRow(cloneUrl: string) {
  return {
    id: "conn-1",
    userId: USER_ID,
    platform: "github",
    owner: OWNER,
    name: NAME,
    fullName: `${OWNER}/${NAME}`,
    cloneUrl,
    defaultBranch: "main",
    isActive: true,
    slot: "agent",
    connectionType: "token",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function post(route: string, body?: unknown) {
  const res = await fetch(baseUrl + route, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: body === undefined ? "{}" : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

describeRouteE2E("FAZA 6 — POST /api/repos/push (HTTP E2E, offline)", () => {
  it("1. happy path: /prepare → agent edit → /commit → /push → remote HEAD == local HEAD", async () => {
    const bare = await setupRemote();
    dbState.active = [activeRow(bare)];
    regState.token = "ghp_dummy_token";

    const prep = await post("/api/repos/prepare");
    expect(prep.status).toBe(200);
    expect(prep.body.cloned).toBe(true);

    const dir = getRepoWorkspaceDir(USER_ID, OWNER, NAME);
    fs.writeFileSync(path.join(dir, "agent.txt"), "hello from agent\n");

    const commit = await post("/api/repos/commit", { message: "agent: route e2e" });
    expect(commit.status).toBe(200);
    expect(commit.body.committed).toBe(true);
    expect(commit.body.hash).toMatch(/^[0-9a-f]{7,}$/);

    const push = await post("/api/repos/push");
    expect(push.status).toBe(200);
    expect(push.body.success).toBe(true);

    const localHead = await git(["rev-parse", "HEAD"], dir);
    const remoteHead = await git(["--git-dir", bare, "rev-parse", "main"]);
    expect(remoteHead).toBe(localHead);
    expect(await git(["--git-dir", bare, "log", "-1", "--format=%s"])).toBe("agent: route e2e");
  });

  it("2. bez aktivnog repo-a → 404", async () => {
    dbState.active = [];
    const res = await post("/api/repos/push");
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("No active repo");
  });

  it("3. aktivan repo ali nema tokena → 401", async () => {
    const bare = await setupRemote();
    dbState.active = [activeRow(bare)];
    regState.token = undefined;
    const res = await post("/api/repos/push");
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("token missing");
  });

  it("4. token postoji ali nema write pristup → 403 sa jasnom porukom", async () => {
    const bare = await setupRemote();
    dbState.active = [activeRow(bare)];
    regState.token = "ghp_dummy_token";
    wsState.pushError = "remote: Permission to fileboin/route-e2e-repo.git denied to e2e-user.";
    const res = await post("/api/repos/push");
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("nema write pristup");
  });
});
