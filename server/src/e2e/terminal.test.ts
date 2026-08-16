// ── ITERATION 2 — TERMINAL + PROCESS MANAGEMENT (automated E2E) ──
// Exercises the TerminalManager against real child processes: finish, failure,
// live stdout/stderr streaming, cancellation, timeout, concurrency protection
// and npm install/build/test in a sandbox directory.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  TerminalBusyError,
  cancelTerminalProcess,
  clearTerminalEntries,
  getTerminalOutput,
  getTerminalProcess,
  listTerminalProcesses,
  startTerminalProcess,
  subscribeToTerminal,
  waitForTerminalExit,
} from "../lib/terminal.js";
import { clearProcessRegistry } from "../lib/process-registry.js";

const USER = "terminal-user";
let cwd = "";

function npmBin(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

beforeAll(async () => {
  cwd = await fs.promises.mkdtemp(path.join(os.tmpdir(), "straxor-term-"));
});

afterAll(async () => {
  clearTerminalEntries();
  clearProcessRegistry();
  await fs.promises.rm(cwd, { recursive: true, force: true }).catch(() => {});
});

describe("Iteration 2 — Terminal + Process Management (E2E)", () => {
  it("1. runs a command, captures stdout/stderr and records exit code + timestamps", async () => {
    const { processId } = startTerminalProcess({
      userId: USER,
      cwd,
      command: "node",
      args: ["-e", "process.stdout.write('OUT'); process.stderr.write('ERR');"],
    });
    const exit = await waitForTerminalExit(processId);
    expect(exit.status).toBe("finished");
    expect(exit.exitCode).toBe(0);

    const rec = getTerminalProcess(processId)!;
    expect(rec.command).toBe("node");
    expect(rec.stdout).toContain("OUT");
    expect(rec.stderr).toContain("ERR");
    expect(rec.startedAt).toBeGreaterThan(0);
    expect(rec.endedAt).toBeGreaterThanOrEqual(rec.startedAt);
  });

  it("2. reports a failed process with its non-zero exit code", async () => {
    const { processId } = startTerminalProcess({
      userId: USER,
      cwd,
      command: "node",
      args: ["-e", "process.exit(3)"],
    });
    const exit = await waitForTerminalExit(processId);
    expect(exit.status).toBe("failed");
    expect(exit.exitCode).toBe(3);
    expect(getTerminalProcess(processId)!.status).toBe("failed");
  });

  it("3. streams stdout and stderr live over the event bus", async () => {
    const { processId } = startTerminalProcess({
      userId: USER,
      cwd,
      command: "node",
      args: ["-e", "setTimeout(() => { process.stdout.write('LIVE1'); process.stderr.write('LIVE2'); }, 30);"],
    });
    const seen: string[] = [];
    const off = subscribeToTerminal(processId, (e) => {
      if (e.data) seen.push(e.data);
    });
    const exit = await waitForTerminalExit(processId);
    off();
    expect(exit.status).toBe("finished");
    expect(seen.join("")).toContain("LIVE1");
    expect(seen.join("")).toContain("LIVE2");
  });

  it("4. cancels a long-running process", async () => {
    const { processId } = startTerminalProcess({
      userId: USER,
      cwd,
      command: "node",
      args: ["-e", "setInterval(() => {}, 1000)"],
    });
    const exitPromise = waitForTerminalExit(processId);
    await new Promise((r) => setTimeout(r, 100));
    expect(cancelTerminalProcess(processId)).toBe(true);

    const exit = await exitPromise;
    expect(exit.status).toBe("cancelled");
    expect(getTerminalProcess(processId)!.status).toBe("cancelled");
  });

  it("5. enforces the process timeout", async () => {
    const { processId } = startTerminalProcess({
      userId: USER,
      cwd,
      command: "node",
      args: ["-e", "setInterval(() => {}, 1000)"],
      timeoutMs: 200,
    });
    const exit = await waitForTerminalExit(processId, 5000);
    expect(exit.status).toBe("timeout");
    expect(exit.signal).toBe("SIGKILL");
    expect(getTerminalProcess(processId)!.status).toBe("timeout");
  });

  it("6. blocks a second concurrent process in the same scope", async () => {
    const { processId } = startTerminalProcess({
      userId: USER,
      cwd,
      command: "node",
      args: ["-e", "setInterval(() => {}, 1000)"],
    });
    try {
      expect(() =>
        startTerminalProcess({ userId: USER, cwd, command: "node", args: ["-e", ""] }),
      ).toThrow(TerminalBusyError);
    } finally {
      cancelTerminalProcess(processId);
      await waitForTerminalExit(processId);
    }
  });

  it("7. lists and retrieves processes per user", async () => {
    const { processId } = startTerminalProcess({ userId: USER, cwd, command: "node", args: ["-e", ""] });
    await waitForTerminalExit(processId);

    const list = listTerminalProcesses(USER);
    expect(list.map((p) => p.id)).toContain(processId);
    expect(getTerminalProcess(processId)?.command).toBe("node");
    expect(listTerminalProcesses("someone-else").map((p) => p.id)).not.toContain(processId);
  });

  it("8. runs npm install, npm run build and npm test through the manager", async () => {
    await fs.promises.writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify({
        name: "term-fixture",
        version: "1.0.0",
        private: true,
        scripts: { build: "node build.js", test: "node test.js" },
      }),
    );
    await fs.promises.writeFile(path.join(cwd, "build.js"), 'console.log("built-ok");');
    await fs.promises.writeFile(path.join(cwd, "test.js"), 'console.log("test-ok");');

    const install = startTerminalProcess({ userId: USER, cwd, command: npmBin(), args: ["install", "--no-audit", "--no-fund"] });
    expect((await waitForTerminalExit(install.processId, 30000)).status).toBe("finished");

    const build = startTerminalProcess({ userId: USER, cwd, command: npmBin(), args: ["run", "build"] });
    const buildExit = await waitForTerminalExit(build.processId, 30000);
    expect(buildExit.status).toBe("finished");
    expect(getTerminalOutput(build.processId).stdout).toContain("built-ok");

    const test = startTerminalProcess({ userId: USER, cwd, command: npmBin(), args: ["test"] });
    const testExit = await waitForTerminalExit(test.processId, 30000);
    expect(testExit.status).toBe("finished");
    expect(getTerminalOutput(test.processId).stdout).toContain("test-ok");
  });
});
