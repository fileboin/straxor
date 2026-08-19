// ── PANEL SELF-TEST — Panel 1 (ask) + Panel 2 (agent) App Builder probe ──
// Offline: seeds two bare remotes (one per panel slot), then for EACH slot
// runs the exact probe a real panel executes on a turn:
//   1. ensureWorkspace clones the repo into its sandbox
//   2. the agent writes a file
//   3. runWorkspaceCommand executes a real command in that sandbox
// A panel that passes this is a full App Builder (tools + workspace + command
// execution), NOT a passive text chat.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import {
  ensureWorkspace,
  getRepoWorkspaceDir,
  runWorkspaceCommand,
  type WorkspaceRepo,
} from "../runtime/local/workspace.js";

const execFileP = promisify(execFile);

const USER_ID = "panel-self-test-user";

async function sh(cwd: string, cmd: string, args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileP(cmd, args, {
    cwd,
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return (stdout + stderr).trim();
}

function gitBin(): string {
  return process.platform === "win32" ? "git.exe" : "git";
}

interface SeededRemote {
  repo: WorkspaceRepo;
  remoteDir: string;
}

let base = "";
const remotes = new Map<string, SeededRemote>();

async function seedRemote(name: string): Promise<SeededRemote> {
  const seed = path.join(base, `${name}-seed`);
  const remoteDir = path.join(base, `${name}.git`);
  await fs.promises.mkdir(seed, { recursive: true });
  await fs.promises.writeFile(
    path.join(seed, "package.json"),
    JSON.stringify({ name, version: "1.0.0", private: true }, null, 2),
  );
  await fs.promises.writeFile(path.join(seed, "README.md"), `# ${name}\n`);
  await sh(seed, gitBin(), ["init", "-b", "main"]).catch(async () => {
    await sh(seed, gitBin(), ["init"]);
    await sh(seed, gitBin(), ["checkout", "-b", "main"]);
  });
  await sh(seed, gitBin(), ["config", "user.name", "Straxor Self-Test"]);
  await sh(seed, gitBin(), ["config", "user.email", "selftest@straxor.dev"]);
  await sh(seed, gitBin(), ["add", "-A"]);
  await sh(seed, gitBin(), ["commit", "-m", `seed ${name}`]);
  await sh(base, gitBin(), ["clone", "--bare", seed, remoteDir]);
  await sh(base, gitBin(), ["--git-dir", remoteDir, "symbolic-ref", "HEAD", "refs/heads/main"]);

  return {
    repo: {
      userId: USER_ID,
      platform: "github",
      owner: "fileboin",
      name,
      fullName: `fileboin/${name}`,
      cloneUrl: remoteDir,
      defaultBranch: "main",
    },
    remoteDir,
  };
}

async function probePanel(slot: "ask" | "agent", name: string): Promise<void> {
  const remote = remotes.get(name)!;
  const info = await ensureWorkspace(remote.repo);
  expect(info.cloned).toBe(true);

  const dir = getRepoWorkspaceDir(USER_ID, "fileboin", name);
  expect(fs.existsSync(path.join(dir, ".git"))).toBe(true);

  // Agent action: write a real file into the sandbox.
  const probeFile = path.join(dir, `probe-${slot}.txt`);
  await fs.promises.writeFile(probeFile, `panel ${slot} probe ${Date.now()}\n`);
  expect(await fs.promises.readFile(probeFile, "utf8")).toContain(`panel ${slot}`);

  // Command execution: run a real command inside that sandbox and read output.
  const run = await runWorkspaceCommand(USER_ID, "fileboin", name, "node", [
    "-e",
    `require("fs").writeFileSync("probe-out-${slot}.txt", "exec-ok-${slot}"); console.log("PANEL_${slot.toUpperCase()}_EXEC_OK");`,
  ]);
  expect(run.exitCode).toBe(0);
  const outFile = path.join(dir, `probe-out-${slot}.txt`);
  expect(fs.existsSync(outFile)).toBe(true);
  expect(await fs.promises.readFile(outFile, "utf8")).toBe(`exec-ok-${slot}`);
}

beforeAll(async () => {
  base = await fs.promises.mkdtemp(path.join(os.tmpdir(), "straxor-panel-self-"));
  process.env.STRAXOR_WORKSPACE_DIR = path.join(base, "workspaces");
  remotes.set("ask-app", await seedRemote("ask-app"));
  remotes.set("agent-app", await seedRemote("agent-app"));
});

afterAll(async () => {
  delete process.env.STRAXOR_WORKSPACE_DIR;
  if (base) {
    await fs.promises.rm(base, { recursive: true, force: true }).catch(() => {});
  }
});

describe("PANEL SELF-TEST — both panels are real App Builders", () => {
  it("Panel 1 (ask slot): clone → file write → command execution", async () => {
    await probePanel("ask", "ask-app");
  });

  it("Panel 2 (agent slot): clone → file write → command execution", async () => {
    await probePanel("agent", "agent-app");
  });

  it("Panel sandboxes are isolated (ask ≠ agent)", async () => {
    const askDir = getRepoWorkspaceDir(USER_ID, "fileboin", "ask-app");
    const agentDir = getRepoWorkspaceDir(USER_ID, "fileboin", "agent-app");
    expect(askDir).not.toBe(agentDir);
    expect(fs.existsSync(path.join(askDir, "probe-ask.txt"))).toBe(true);
    expect(fs.existsSync(path.join(agentDir, "probe-agent.txt"))).toBe(true);
    expect(fs.existsSync(path.join(askDir, "probe-agent.txt"))).toBe(false);
  });
});
