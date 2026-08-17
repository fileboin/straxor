// ── ITERATION 4 — CLOSED LOOP: Verification → Diff → Approval → Commit → Push ──
// Proves the approval gate end to end with the REAL workspace module code paths
// and a local bare remote (deterministic + offline, same approach as Iteration 1):
//   1. agent changes source files
//   2. diffWorkspace returns the diff + a SHA-256 fingerprint
//   3. verifyWorkspace runs npm build + test and reports a structured result
//   4. approveAndCommitWorkspace REFUSES a stale fingerprint (files changed
//      since the diff was shown) — unapproved changes can never be committed
//   5. approveAndCommitWorkspace commits when the fingerprint matches
//   6. pushWorkspace → remote HEAD == local HEAD
//   7. a breaking change makes verifyWorkspace fail with the failing step captured

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
  statusWorkspace,
  verifyWorkspace,
  type WorkspaceRepo,
} from "../runtime/local/workspace.js";
import { clearProcessRegistry } from "../lib/process-registry.js";

const execFileP = promisify(execFile);

const USER_ID = "loop-user";
const OWNER = "acme";
const NAME = "loop-app";

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

beforeAll(async () => {
  base = await fs.promises.mkdtemp(path.join(os.tmpdir(), "straxor-loop-"));
  process.env.STRAXOR_WORKSPACE_DIR = path.join(base, "workspaces");
  const seed = path.join(base, "seed");
  remoteDir = path.join(base, "remote.git");

  await fs.promises.mkdir(path.join(seed, "src"), { recursive: true });
  await fs.promises.mkdir(path.join(seed, "scripts"), { recursive: true });
  await fs.promises.mkdir(path.join(seed, "test"), { recursive: true });
  await fs.promises.writeFile(
    path.join(seed, "package.json"),
    JSON.stringify(
      {
        name: "loop-demo-app",
        version: "1.0.0",
        private: true,
        scripts: { build: "node scripts/build.js", test: "node --test" },
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

  await sh(seed, "git", ["init"]);
  await sh(seed, "git", ["config", "user.name", "Straxor Agent"]);
  await sh(seed, "git", ["config", "user.email", "agent@straxor.dev"]);
  await sh(seed, "git", ["add", "-A"]);
  await sh(seed, "git", ["commit", "-m", "initial fixture"]);
  await sh(seed, "git", ["branch", "-M", "main"]);

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

  await ensureWorkspace(repo);
  dir = getRepoWorkspaceDir(USER_ID, OWNER, NAME);
  // Install deps once so verification steps are fast and offline.
  await sh(dir, process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--no-audit", "--no-fund"]);
});

afterAll(async () => {
  clearProcessRegistry();
  delete process.env.STRAXOR_WORKSPACE_DIR;
  if (base) {
    await fs.promises.rm(base, { recursive: true, force: true }).catch(() => {});
  }
});

describe("Iteration 4 — Closed Loop (E2E)", () => {
  it("1. agent makes a source change and the diff carries a fingerprint", async () => {
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

    const files = (await statusWorkspace(USER_ID, OWNER, NAME)).map((f) => f.path);
    expect(files).toContain("src/index.js");
    expect(files).toContain("test/agent.test.js");

    const { diff, hash } = await diffWorkspace(USER_ID, OWNER, NAME);
    expect(diff).toContain("greetLoud");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("2. verification runs build + test and reports a structured pass", async () => {
    const result = await verifyWorkspace(USER_ID, OWNER, NAME, { install: false });
    expect(result.skipped).toBe(false);
    expect(result.passed).toBe(true);
    const names = result.steps.map((s) => s.name);
    expect(names).toContain("build");
    expect(names).toContain("test");
    const build = result.steps.find((s) => s.name === "build")!;
    const test = result.steps.find((s) => s.name === "test")!;
    expect(build.exitCode).toBe(0);
    expect(build.stdout).toContain("build ok");
    expect(test.exitCode).toBe(0);
    expect(test.stdout).toContain("greet works");
    expect(test.stdout).toContain("agent added greetLoud");
  });

  it("3. approval with a STALE diff fingerprint is refused", async () => {
    const stale = await approveAndCommitWorkspace(USER_ID, OWNER, NAME, "agent: stale", "0".repeat(64));
    expect(stale.committed).toBe(false);
    expect(stale.diffChanged).toBe(true);
    expect(stale.empty).toBe(false);
  });

  it("4. approval with the CURRENT fingerprint commits", async () => {
    const { hash } = await diffWorkspace(USER_ID, OWNER, NAME);
    const result = await approveAndCommitWorkspace(USER_ID, OWNER, NAME, "agent: add greetLoud (loop E2E)", hash);
    expect(result.committed).toBe(true);
    expect(result.diffChanged).toBe(false);
    expect(result.hash).toMatch(/^[0-9a-f]{7,}$/);
  });

  it("5. approval with nothing to commit reports empty", async () => {
    const result = await approveAndCommitWorkspace(USER_ID, OWNER, NAME, "agent: nothing");
    expect(result.empty).toBe(true);
    expect(result.committed).toBe(false);
  });

  it("6. pushes the approved commit and remote HEAD matches local", async () => {
    const output = await pushWorkspace(USER_ID, OWNER, NAME, "main");
    expect(output.length).toBeGreaterThan(0);

    const localHead = (await sh(dir, "git", ["rev-parse", "HEAD"])).trim();
    const remoteHead = (await sh(base, "git", ["--git-dir", remoteDir, "rev-parse", "HEAD"])).trim();
    expect(remoteHead).toBe(localHead);

    const tree = await sh(base, "git", ["--git-dir", remoteDir, "ls-tree", "-r", "--name-only", "HEAD"]);
    expect(tree).toContain("test/agent.test.js");
  });

  it("7. a breaking change makes verification fail with the failing step captured", async () => {
    // Untracked failing test — never committed, so the remote stays clean.
    await fs.promises.writeFile(
      path.join(dir, "test", "fail.test.js"),
      [
        'const test = require("node:test");',
        'test("this should fail", () => { throw new Error("boom"); });',
        "",
      ].join("\n"),
    );

    const result = await verifyWorkspace(USER_ID, OWNER, NAME, { install: false });
    expect(result.passed).toBe(false);
    const test = result.steps.find((s) => s.name === "test")!;
    expect(test.exitCode).not.toBe(0);
    expect(test.stderr + test.stdout).toContain("boom");

    await fs.promises.rm(path.join(dir, "test", "fail.test.js"));
    // Sandbox is clean again.
    const files = (await statusWorkspace(USER_ID, OWNER, NAME)).map((f) => f.path);
    expect(files).not.toContain("test/fail.test.js");
  });
});
