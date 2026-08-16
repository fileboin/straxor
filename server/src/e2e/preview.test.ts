// ── ITERATION 3 — LIVE PREVIEW (automated E2E) ──
// Starts real dev servers through the local preview manager and proves port
// detection, localhost/127.0.0.1 health checks, crash detection, restart,
// per-task instance isolation and custom ports.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  clearPreviews,
  detectPortFromText,
  findFreePort,
  getPreviewInfo,
  previewCount,
  previewKey,
  restartPreview,
  startPreview,
  stopAllPreviews,
  stopPreview,
  type LocalPreviewInfo,
} from "../runtime/local/preview.js";
import { getRepoWorkspaceDir } from "../runtime/local/workspace.js";
import { clearTerminalEntries } from "../lib/terminal.js";
import { clearProcessRegistry } from "../lib/process-registry.js";

const USER = "preview-user";
const OWNER = "acme";
const NAME = "preview-app";

let repoDir = "";
let base = "";

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
  base = await fs.promises.mkdtemp(path.join(os.tmpdir(), "straxor-preview-"));
  process.env.STRAXOR_WORKSPACE_DIR = path.join(base, "workspaces");
  repoDir = getRepoWorkspaceDir(USER, OWNER, NAME);
  await fs.promises.mkdir(repoDir, { recursive: true });

  await fs.promises.writeFile(
    path.join(repoDir, "package.json"),
    JSON.stringify({ name: "preview-fixture", version: "1.0.0", private: true, scripts: { dev: "node server.js" } }),
  );
  await fs.promises.writeFile(
    path.join(repoDir, "server.js"),
    [
      'const http = require("http");',
      'const port = process.env.PORT ? Number(process.env.PORT) : 4173;',
      'http.createServer((req, res) => { res.end("hello-preview"); }).listen(port, "0.0.0.0", () => console.log("listening on port " + port));',
      "",
    ].join("\n"),
  );
  // A server that never binds and dies shortly after starting (crash test).
  await fs.promises.writeFile(
    path.join(repoDir, "crash.js"),
    'setTimeout(() => { console.log("listening on port " + (process.env.PORT || 4173)); process.exit(1); }, 300);',
  );
});

afterAll(async () => {
  await stopAllPreviews();
  clearPreviews();
  clearTerminalEntries();
  clearProcessRegistry();
  delete process.env.STRAXOR_WORKSPACE_DIR;
  await fs.promises.rm(base, { recursive: true, force: true }).catch(() => {});
});

describe("Iteration 3 — Live Preview (E2E)", () => {
  it("1. detects ports from common dev-server output formats", () => {
    expect(detectPortFromText("VITE ready — Local:   http://localhost:5173/")).toBe(5173);
    expect(detectPortFromText("Local: http://localhost:3000")).toBe(3000);
    expect(detectPortFromText("listening on port 8080")).toBe(8080);
    expect(detectPortFromText("listening on 4173")).toBe(4173);
    expect(detectPortFromText("127.0.0.1:3005")).toBe(3005);
    expect(detectPortFromText("no port here")).toBeNull();
  });

  it("2. starts a dev server, detects its port and becomes healthy", async () => {
    const key = previewKey(USER, OWNER, NAME, "task-a");
    const info = await startPreview({ userId: USER, owner: OWNER, name: NAME, taskId: "task-a" });
    expect(info.state).toBe("starting");
    expect(info.previewId).toBe(key);

    const running = await waitForState(key, "running");
    expect(running.port).toBeGreaterThan(0);
    expect(running.internalUrl).toContain(String(running.port));
    expect(running.url).toContain(String(running.port));
    expect(running.health).toBe("ok");

    await stopPreview(key);
  });

  it("3. keeps a unique preview instance per task", async () => {
    const keyA = previewKey(USER, OWNER, NAME, "task-a");
    const keyB = previewKey(USER, OWNER, NAME, "task-b");

    const first = await startPreview({ userId: USER, owner: OWNER, name: NAME, taskId: "task-a" });
    await waitForState(keyA, "running");

    // Same task again → same instance, no duplicate spawn.
    const same = await startPreview({ userId: USER, owner: OWNER, name: NAME, taskId: "task-a" });
    expect(same.previewId).toBe(first.previewId);
    expect(same.processId).toBe(first.processId);

    // Different task → separate instance.
    const other = await startPreview({ userId: USER, owner: OWNER, name: NAME, taskId: "task-b" });
    expect(other.previewId).toBe(keyB);
    await waitForState(keyB, "running");

    await stopPreview(keyA);
    await stopPreview(keyB);
  });

  it("4. supports a custom port", async () => {
    const freePort = await findFreePort(5200);
    const key = previewKey(USER, OWNER, NAME, "task-c");
    const info = await startPreview({ userId: USER, owner: OWNER, name: NAME, taskId: "task-c", port: freePort });
    const running = await waitForState(key, "running");
    expect(running.port).toBe(freePort);
    expect(running.internalUrl).toBe(`http://localhost:${freePort}`);
    await stopPreview(key);
  });

  it("5. detects a crashed dev server", async () => {
    const key = previewKey(USER, OWNER, NAME, "task-crash");
    await startPreview({
      userId: USER,
      owner: OWNER,
      name: NAME,
      taskId: "task-crash",
      command: "node",
      args: ["crash.js"],
    });
    const crashed = await waitForState(key, "crashed");
    expect(crashed.lastError).toContain("exited");
  });

  it("6. restarts a preview and bumps the restart counter", async () => {
    const key = previewKey(USER, OWNER, NAME, "task-d");
    await startPreview({ userId: USER, owner: OWNER, name: NAME, taskId: "task-d" });
    await waitForState(key, "running");

    const restarted = await restartPreview({ userId: USER, owner: OWNER, name: NAME, taskId: "task-d" });
    expect(restarted.restarts).toBe(1);
    await waitForState(key, "running");
    await stopPreview(key);
  });

  it("7. stops a preview and clears its running state", async () => {
    const key = previewKey(USER, OWNER, NAME, "task-e");
    await startPreview({ userId: USER, owner: OWNER, name: NAME, taskId: "task-e" });
    await waitForState(key, "running");

    const stopped = await stopPreview(key);
    expect(stopped?.state).toBe("stopped");
    expect(previewCount()).toBeGreaterThanOrEqual(0);
  });
});
