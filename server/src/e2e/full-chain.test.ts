// ── FINALNI TEST — FULL MVP CHAIN ──
// One flow through every real module code path, offline against a local bare
// remote standing in for github.com/<owner>/<repo>:
//
//   GitHub → Workspace → Agent → Terminal/Process → Live Preview →
//   Verification → Diff → Approval → Commit → Push
//
//   1. ensureWorkspace clones the remote into an isolated sandbox
//   2. the agent's work product is a real source change (edit + new test)
//   3. runWorkspaceCommand runs npm install through the TerminalManager
//   4. startPreview boots a real dev server, port-detects it and health-checks
//      it (localhost + 127.0.0.1), then stops it
//   5. verifyWorkspace runs build + test and reports a structured pass
//   6. diffWorkspace returns the diff + SHA-256 fingerprint
//   7. approval REFUSES a stale fingerprint and COMMITS the current one
//   8. pushWorkspace pushes; remote HEAD == local HEAD, remote tree contains
//      the agent's change, commit message is on the remote

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import {
  approveAndCommitWorkspace,
  diffWorkspace,
  ensureWorkspace,
  getRepoWorkspaceDir,
  pushWorkspace,
  runWorkspaceCommand,
  statusWorkspace,
  verifyWorkspace,
  type WorkspaceRepo,
} from "../runtime/local/workspace.js";
import {
  clearPreviews,
  getPreviewInfo,
  previewKey,
  startPreview,
  stopAllPreviews,
  stopPreview,
  type LocalPreviewInfo,
} from "../runtime/local/preview.js";
import { clearTerminalEntries } from "../lib/terminal.js";
import { clearProcessRegistry, registrySize } from "../lib/process-registry.js";

const execFileP = promisify(execFile);

const USER_ID = "final-user";
const OWNER = "fileboin";
const NAME = "final-app";
const TASK_ID = "final-task";

let base = "";
let remoteDir = "";
let repo: WorkspaceRepo;
let dir = "";

async function sh(cwd: string, cmd: string, args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileP(cmd, args, {
    cwd,
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return (stdout + stderr).trim();
}

function npmBin(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function waitForState(key: string, state: string, timeoutMs = 15000): Promise<LocalPreviewInfo> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const info = getPreviewInfo(key);
    if (info && info.state === state) return info;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for preview state ${state}; last=${JSON.stringify(getPreviewInfo(key))}`);
}

beforeAll(async () => {
  base = await fs.promises.mkdtemp(path.join(os.tmpdir(), "straxor-final-"));
  process.env.STRAXOR_WORKSPACE_DIR = path.join(base, "workspaces");
  const seed = path.join(base, "seed");
  remoteDir = path.join(base, "remote.git");

  // Seed a dependency-free Node project with build + test + dev scripts so
  // every chain step runs offline and fast through the REAL command paths.
  await fs.promises.mkdir(path.join(seed, "src"), { recursive: true });
  await fs.promises.mkdir(path.join(seed, "scripts"), { recursive: true });
  await fs.promises.mkdir(path.join(seed, "test"), { recursive: true });
  await fs.promises.writeFile(
    path.join(seed, "package.json"),
    JSON.stringify(
      {
        name: "final-demo-app",
        version: "1.0.0",
        private: true,
        scripts: {
          dev: "node server.js",
          build: "node scripts/build.js",
          test: "node --test",
        },
      },
      null,
      2,
    ),
  );
  await fs.promises.writeFile(
    path.join(seed, "src", "index.js"),
    'module.exports = function greet(name) { return "hello " + name; };\n',
  );
  await fs.promises.writeFile(
    path.join(seed, "scripts", "build.js"),
    [
      'const fs = require("fs");',
      'const path = require("path");',
      'const src = fs.readFileSync(path.join(__dirname, "..", "src", "index.js"), "utf8");',
      'if (!src.includes("greet")) throw new Error("missing greet");',
      'console.log("build ok");',
      "",
    ].join("\n"),
  );
  await fs.promises.writeFile(
    path.join(seed, "test", "index.test.js"),
    [
      'const test = require("node:test");',
      'const assert = require("node:assert");',
      'const greet = require("../src/index.js");',
      'test("greet works", () => assert.strictEqual(greet("world"), "hello world"));',
      "",
    ].join("\n"),
  );
  // Dev server that binds 0.0.0.0 and prints its port (preview step).
  await fs.promises.writeFile(
    path.join(seed, "server.js"),
    [
      'const http = require("http");',
      'const port = process.env.PORT ? Number(process.env.PORT) : 4173;',
      'http.createServer((req, res) => { res.end("hello-preview"); }).listen(port, "0.0.0.0", () => console.log("listening on port " + port));',
      "",
    ].join("\n"),
  );

  await sh(seed, "git", ["init", "-b", "main"]).catch(async () => {
    await sh(seed, "git", ["init"]);
    await sh(seed, "git", ["checkout", "-b", "main"]);
  });
  await sh(seed, "git", ["config", "user.name", "Straxor Agent"]);
  await sh(seed, "git", ["config", "user.email", "agent@straxor.dev"]);
  await sh(seed, "git", ["add", "-A"]);
  await sh(seed, "git", ["commit", "-m", "initial fixture"]);
  await sh(base, "git", ["clone", "--bare", seed, remoteDir]);
  await sh(base, "git", ["--git-dir", remoteDir, "symbolic-ref", "HEAD", "refs/heads/main"]);

  repo = {
    userId: USER_ID,
    platform: "github",
    owner: OWNER,
    name: NAME,
    fullName: `${OWNER}/${NAME}`,
    cloneUrl: remoteDir,
    defaultBranch: "main",
  };
});

afterAll(async () => {
  await stopAllPreviews();
  clearPreviews();
  clearTerminalEntries();
  clearProcessRegistry();
  delete process.env.STRAXOR_WORKSPACE_DIR;
  if (base) {
    await fs.promises.rm(base, { recursive: true, force: true }).catch(() => {});
  }
});

describe("FINALNI TEST — Full MVP Chain (E2E, offline)", () => {
  it("runs GitHub → Workspace → Agent → Terminal → Preview → Verify → Diff → Approve → Commit → Push", async () => {
    // ── 1. GitHub → Workspace ──
    const info = await ensureWorkspace(repo);
    expect(info.cloned).toBe(true);
    expect(info.branch).toBe("main");
    dir = getRepoWorkspaceDir(USER_ID, OWNER, NAME);
    expect(fs.existsSync(path.join(dir, ".git"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "src", "index.js"))).toBe(true);

    // ── 2. Agent work: real source change + its test ──
    await fs.promises.writeFile(
      path.join(dir, "src", "index.js"),
      [
        'module.exports = function greet(name) { return "hello " + name; };',
        'module.exports.greetLoud = function greetLoud(name) { return ("hello " + name).toUpperCase(); };',
        "",
      ].join("\n"),
    );
    await fs.promises.writeFile(
      path.join(dir, "test", "agent.test.js"),
      [
        'const test = require("node:test");',
        'const assert = require("node:assert");',
        'const { greetLoud } = require("../src/index.js");',
        'test("agent added greetLoud", () => assert.strictEqual(greetLoud("world"), "HELLO WORLD"));',
        "",
      ].join("\n"),
    );
    expect(await fs.promises.readFile(path.join(dir, "src", "index.js"), "utf8")).toContain("greetLoud");

    // ── 3. Terminal/Process: npm install through the TerminalManager ──
    const install = await runWorkspaceCommand(USER_ID, OWNER, NAME, npmBin(), [
      "install",
      "--no-audit",
      "--no-fund",
    ]);
    expect(install.exitCode).toBe(0);

    // ── 4. Live Preview: real dev server, port detection, health, stop ──
    const key = previewKey(USER_ID, OWNER, NAME, TASK_ID);
    await startPreview({ userId: USER_ID, owner: OWNER, name: NAME, taskId: TASK_ID, command: "node", args: ["server.js"] });
    const running = await waitForState(key, "running");
    expect(running.port).toBeGreaterThan(0);
    expect(running.internalUrl).toContain(String(running.port));
    expect(running.health).toBe("ok");
    // Same-origin proxy URL (production-safe iframe).
    expect(running.url).toContain("/api/preview/proxy/");
    await stopPreview(key);

    // ── 5. Verification: build + test must pass on the agent's change ──
    const verify = await verifyWorkspace(USER_ID, OWNER, NAME, { install: false });
    expect(verify.skipped).toBe(false);
    expect(verify.passed).toBe(true);
    const names = verify.steps.map((s) => s.name);
    expect(names).toContain("build");
    expect(names).toContain("test");
    expect(verify.steps.find((s) => s.name === "build")!.exitCode).toBe(0);
    expect(verify.steps.find((s) => s.name === "test")!.exitCode).toBe(0);

    // ── 6. Diff: fingerprint of exactly what will be committed ──
    const changed = (await statusWorkspace(USER_ID, OWNER, NAME)).map((f) => f.path);
    expect(changed).toContain("src/index.js");
    expect(changed).toContain("test/agent.test.js");
    const { diff, hash } = await diffWorkspace(USER_ID, OWNER, NAME);
    expect(diff).toContain("greetLoud");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    // ── 7. Approval: stale fingerprint refused, current one commits ──
    const stale = await approveAndCommitWorkspace(USER_ID, OWNER, NAME, "agent: stale", "0".repeat(64));
    expect(stale.committed).toBe(false);
    expect(stale.diffChanged).toBe(true);

    const approved = await approveAndCommitWorkspace(USER_ID, OWNER, NAME, "agent: full chain (final E2E)", hash);
    expect(approved.committed).toBe(true);
    expect(approved.hash).toMatch(/^[0-9a-f]{7,}$/);

    // ── 8. Push: remote HEAD == local HEAD, agent change on the remote ──
    const output = await pushWorkspace(USER_ID, OWNER, NAME, "main");
    expect(output.length).toBeGreaterThan(0);

    const localHead = (await sh(dir, "git", ["rev-parse", "HEAD"])).trim();
    const remoteHead = (await sh(base, "git", ["--git-dir", remoteDir, "rev-parse", "HEAD"])).trim();
    expect(remoteHead).toBe(localHead);
    expect(await sh(base, "git", ["--git-dir", remoteDir, "log", "-1", "--format=%s"])).toBe(
      "agent: full chain (final E2E)",
    );
    const tree = await sh(base, "git", ["--git-dir", remoteDir, "ls-tree", "-r", "--name-only", "HEAD"]);
    expect(tree).toContain("src/index.js");
    expect(tree).toContain("test/agent.test.js");

    // The TerminalManager + ProcessRegistry traced the npm + preview runs.
    expect(registrySize()).toBeGreaterThanOrEqual(3);
  });
});
