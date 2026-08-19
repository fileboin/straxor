// ── ITERATION 1 — GITHUB PROOF (automated E2E) ──
// Proves the full flow from a GitHub-style remote to a pushed commit using the
// REAL workspace module code paths (ensureWorkspace / runWorkspaceCommand /
// statusWorkspace / diffWorkspace / commitWorkspace / pushWorkspace).
//
// The "GitHub remote" here is a local bare repository so the test is fully
// deterministic and offline — the GitHub *API* adapter itself (listRepos with
// 3+ repos, pagination, org dedup, error mapping) is covered separately in
// adapters/git/remote/providers/github.test.ts. A full OpenCode agent session
// additionally requires a user AI key, so this suite asserts the engine binary
// resolves and runs; model injection is covered in opencode-model.test.ts.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import {
  commitWorkspace,
  diffWorkspace,
  ensureWorkspace,
  getRepoWorkspaceDir,
  pushWorkspace,
  runWorkspaceCommand,
  statusWorkspace,
  type WorkspaceRepo,
} from "../runtime/local/workspace.js";
import { clearProcessRegistry, registrySize } from "../lib/process-registry.js";

const execFileP = promisify(execFile);

const USER_ID = "e2e-user";
const OWNER = "acme";
const NAME = "demo-app";

let base = "";
let remoteDir = "";
let repo: WorkspaceRepo;

function npmBin(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function opencodeBin(): string {
  if (process.env.OPENCODE_BIN) return process.env.OPENCODE_BIN;
  const local = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    "opencode" + (process.platform === "win32" ? ".cmd" : ""),
  );
  if (fs.existsSync(local)) return local;
  return "opencode";
}

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
  base = await fs.promises.mkdtemp(path.join(os.tmpdir(), "straxor-e2e-"));
  process.env.STRAXOR_WORKSPACE_DIR = path.join(base, "workspaces");
  const seed = path.join(base, "seed");
  remoteDir = path.join(base, "remote.git");

  // Seed a tiny, dependency-free Node project so npm install/build/test all run
  // offline and fast while still exercising the real command paths.
  await fs.promises.mkdir(path.join(seed, "src"), { recursive: true });
  await fs.promises.mkdir(path.join(seed, "scripts"), { recursive: true });
  await fs.promises.mkdir(path.join(seed, "test"), { recursive: true });
  await fs.promises.writeFile(
    path.join(seed, "package.json"),
    JSON.stringify(
      {
        name: "e2e-demo-app",
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
});

afterAll(async () => {
  clearProcessRegistry();
  delete process.env.STRAXOR_WORKSPACE_DIR;
  if (base) {
    await fs.promises.rm(base, { recursive: true, force: true }).catch(() => {});
  }
});

describe("Iteration 1 — GitHub Proof (E2E)", () => {
  it("1. clones the GitHub remote into an isolated local workspace", async () => {
    const info = await ensureWorkspace(repo);
    expect(info.cloned).toBe(true);
    expect(info.gitBinary).toBe(true);
    expect(info.branch).toBe("main");
    expect(info.lastCommit).toMatch(/^[0-9a-f]{7,}$/);
    const dir = getRepoWorkspaceDir(USER_ID, OWNER, NAME);
    expect(fs.existsSync(path.join(dir, ".git"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "src", "index.js"))).toBe(true);
  });

  it("2. verifies file read/write inside the workspace", async () => {
    const dir = getRepoWorkspaceDir(USER_ID, OWNER, NAME);
    const source = await fs.promises.readFile(path.join(dir, "src", "index.js"), "utf8");
    expect(source).toContain("greet");

    const scratch = path.join(dir, "scratch.txt");
    await fs.promises.writeFile(scratch, "write works\n");
    expect(await fs.promises.readFile(scratch, "utf8")).toContain("write works");
    await fs.promises.rm(scratch); // keep the sandbox clean for the agent change
  });

  it("3. resolves and runs the OpenCode engine binary", async () => {
    const bin = opencodeBin();
    const result = await runWorkspaceCommand(USER_ID, OWNER, NAME, bin, ["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout + result.stderr).toMatch(/\d+\.\d+\.\d+/);
  });

  it("4. the agent makes a real source change", async () => {
    const dir = getRepoWorkspaceDir(USER_ID, OWNER, NAME);
    await fs.promises.writeFile(
      path.join(dir, "src", "index.js"),
      [
        'module.exports = function greet(name) { return "hello " + name; };',
        'module.exports.greetLoud = function greetLoud(name) { return ("hello " + name).toUpperCase(); };',
        "",
      ].join("\n"),
    );
    await fs.promises.writeFile(path.join(dir, "src", "agent-note.txt"), "changed by the Straxor agent\n");
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

    const content = await fs.promises.readFile(path.join(dir, "src", "index.js"), "utf8");
    expect(content).toContain("greetLoud");
  });

  it("5. runs npm install in the workspace", async () => {
    const result = await runWorkspaceCommand(USER_ID, OWNER, NAME, npmBin(), [
      "install",
      "--no-audit",
      "--no-fund",
    ]);
    expect(result.exitCode).toBe(0);
  });

  it("6. runs npm run build and captures stdout/stderr", async () => {
    const result = await runWorkspaceCommand(USER_ID, OWNER, NAME, npmBin(), ["run", "build"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("build ok");
  });

  it("7. runs the test command and captures stdout/stderr", async () => {
    const result = await runWorkspaceCommand(USER_ID, OWNER, NAME, npmBin(), ["test"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("greet works");
    expect(result.stdout).toContain("agent added greetLoud");
  });

  it("8. generates and shows the git diff for the change", async () => {
    const files = (await statusWorkspace(USER_ID, OWNER, NAME)).map((f) => f.path);
    expect(files).toContain("src/index.js");
    expect(files).toContain("src/agent-note.txt");
    expect(files).toContain("test/agent.test.js");

    const { diff, stat } = await diffWorkspace(USER_ID, OWNER, NAME);
    expect(diff).toContain("greetLoud");
    expect(stat).toContain("src/index.js");
  });

  it("9. commits the change as the Straxor Agent identity", async () => {
    const result = await commitWorkspace(USER_ID, OWNER, NAME, "agent: add greetLoud (E2E)");
    expect(result.committed).toBe(true);
    expect(result.hash).toMatch(/^[0-9a-f]{7,}$/);
  });

  it("10. pushes the commit to the remote and verifies remote HEAD", async () => {
    const output = await pushWorkspace(USER_ID, OWNER, NAME, "main");
    expect(output.length).toBeGreaterThan(0);

    const dir = getRepoWorkspaceDir(USER_ID, OWNER, NAME);
    const localHead = (await sh(dir, "git", ["rev-parse", "HEAD"])).trim();
    const remoteHead = (await sh(base, "git", ["--git-dir", remoteDir, "rev-parse", "HEAD"])).trim();
    expect(remoteHead).toBe(localHead);

    const tree = await sh(base, "git", ["--git-dir", remoteDir, "ls-tree", "-r", "--name-only", "HEAD"]);
    expect(tree).toContain("src/agent-note.txt");
    expect(tree).toContain("test/agent.test.js");
  });

  it("tracks every command run in the process registry", () => {
    // The pipeline above registers each spawned command (clone steps run through
    // gitExec, and npm/build/test through runWorkspaceCommand). At least the
    // explicit runWorkspaceCommand calls must have left a trace.
    expect(registrySize()).toBeGreaterThanOrEqual(4);
  });
});
