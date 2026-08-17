// ── ITERATION 3 — Live Preview over HTTP (E2E, offline) ──
// Exercises the REAL Express routes the production client calls:
//   POST /api/preview/start      (local target)
//   POST /api/preview/restart
//   POST /api/preview/stop
//   GET  /api/preview/status
//   GET  /api/preview/logs
//   GET  /api/preview/framework
//
// No database and no network are needed: the Postgres-backed db module and the
// adapter registry are mocked (they are only used by the VPS path), while the
// local preview manager spawns a REAL dev server in a sandbox, detects its
// port and health-checks it exactly as it does in production on Render.
//
// Covered contracts:
//   1. start issues the preview cookie + returns a same-origin proxy URL
//   2. status reports running + port + health once the dev server binds
//   3. unique preview instance per task (same task reuses, new task spawns)
//   4. restart bumps the restart counter
//   5. stop clears the running state
//   6. crash detection via status polling
//   7. logs expose captured stdout
//   8. framework detection from the workspace package.json
//   9. 400 / 404 error mapping

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import previewRouter from "./preview.js";
import { clearPreviews, stopAllPreviews } from "../runtime/local/preview.js";
import { clearTerminalEntries } from "../lib/terminal.js";
import { clearProcessRegistry } from "../lib/process-registry.js";
import { getRepoWorkspaceDir } from "../runtime/local/workspace.js";

// requireAuth imports the Postgres-backed db layer; the preview route also
// imports the full adapter registry (only used by the VPS target). Mock both so
// the test never opens a socket to Neon or pulls in the engine/opencode stack.
vi.mock("../db/index.js", () => ({ db: {} }));
vi.mock("../adapters/registry.js", () => ({
  getAdapters: () => ({ runtime: () => ({ executeCommand: async () => ({}) }) }),
}));

const USER = "preview-route-user";
const OWNER = "acme";
const NAME = "preview-route-app";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const bearer = jwt.sign({ userId: USER, email: "preview@straxor.test", role: "user" }, JWT_SECRET);

let base = "";
let repoDir = "";
let server: Server;
let baseUrl = "";

interface HttpResponse {
  status: number;
  body: Record<string, unknown>;
}

beforeAll(async () => {
  base = await fs.promises.mkdtemp(path.join(os.tmpdir(), "straxor-preview-route-"));
  process.env.STRAXOR_WORKSPACE_DIR = path.join(base, "workspaces");
  repoDir = getRepoWorkspaceDir(USER, OWNER, NAME);
  await fs.promises.mkdir(repoDir, { recursive: true });

  await fs.promises.writeFile(
    path.join(repoDir, "package.json"),
    JSON.stringify({
      name: "preview-route-fixture",
      version: "1.0.0",
      private: true,
      scripts: { dev: "node server.js" },
      dependencies: { vite: "^5.4.0" },
    }),
  );
  await fs.promises.writeFile(
    path.join(repoDir, "server.js"),
    [
      'const http = require("http");',
      'const port = process.env.PORT ? Number(process.env.PORT) : 4173;',
      'http.createServer((req, res) => { res.end("hello-preview-route"); }).listen(port, "0.0.0.0", () => console.log("listening on port " + port));',
      "",
    ].join("\n"),
  );
  await fs.promises.writeFile(
    path.join(repoDir, "crash.js"),
    'setTimeout(() => { console.log("listening on port " + (process.env.PORT || 4173)); process.exit(1); }, 300);',
  );

  const app = express();
  app.use(express.json());
  app.use("/api/preview", previewRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await stopAllPreviews();
  clearPreviews();
  clearTerminalEntries();
  clearProcessRegistry();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.STRAXOR_WORKSPACE_DIR;
  await fs.promises.rm(base, { recursive: true, force: true }).catch(() => {});
});

afterEach(async () => {
  await stopAllPreviews();
  clearPreviews();
  clearTerminalEntries();
  clearProcessRegistry();
});

async function postLocal(route: string, body: Record<string, unknown>): Promise<HttpResponse> {
  const res = await fetch(baseUrl + route, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

async function getLocal(route: string): Promise<HttpResponse> {
  const res = await fetch(baseUrl + route, { headers: { Authorization: `Bearer ${bearer}` } });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

function localQuery(taskId: string): string {
  return `target=local&owner=${OWNER}&name=${NAME}&taskId=${taskId}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForState(taskId: string, state: string, timeoutMs = 20000): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  let last: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    const r = await getLocal(`/api/preview/status?${localQuery(taskId)}`);
    if (r.status === 200) {
      last = r.body;
      if (last.state === state) return last;
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for preview state ${state}; last=${JSON.stringify(last)}`);
}

describe("Iteration 3 — Live Preview over HTTP (E2E, offline)", () => {
  it("1. start issues the preview cookie and returns a same-origin proxy URL once healthy", async () => {
    const res = await fetch(baseUrl + "/api/preview/start", {
      method: "POST",
      headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
      body: JSON.stringify({ target: "local", owner: OWNER, name: NAME, taskId: "task-a" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.state).toBe("starting");
    expect(String(body.previewId)).toContain("task-a");
    expect(res.headers.get("set-cookie")).toContain("straxor_preview=");

    const running = await waitForState("task-a", "running");
    expect(Number(running.port)).toBeGreaterThan(0);
    expect(running.health).toBe("ok");
    expect(String(running.url)).toContain("/api/preview/proxy/");
    expect(String(running.internalUrl)).toContain(String(running.port));
  });

  it("2. keeps a unique preview instance per task", async () => {
    const first = await postLocal("/api/preview/start", { target: "local", owner: OWNER, name: NAME, taskId: "task-b1" });
    expect(first.status).toBe(200);
    const running = await waitForState("task-b1", "running");

    // Same task again → same instance + same process (no duplicate spawn).
    const again = await postLocal("/api/preview/start", { target: "local", owner: OWNER, name: NAME, taskId: "task-b1" });
    expect(again.body.previewId).toBe(first.body.previewId);
    expect(again.body.processId).toBe(running.processId);

    // Different task → separate instance.
    const other = await postLocal("/api/preview/start", { target: "local", owner: OWNER, name: NAME, taskId: "task-b2" });
    expect(other.status).toBe(200);
    expect(other.body.previewId).not.toBe(first.body.previewId);
    await waitForState("task-b2", "running");
  });

  it("3. restart bumps the restart counter", async () => {
    await postLocal("/api/preview/start", { target: "local", owner: OWNER, name: NAME, taskId: "task-c" });
    await waitForState("task-c", "running");

    const restarted = await postLocal("/api/preview/restart", { owner: OWNER, name: NAME, taskId: "task-c" });
    expect(restarted.status).toBe(200);
    expect(restarted.body.restarts).toBe(1);
    await waitForState("task-c", "running");
  });

  it("4. stop clears the running state", async () => {
    await postLocal("/api/preview/start", { target: "local", owner: OWNER, name: NAME, taskId: "task-d" });
    await waitForState("task-d", "running");

    const stopped = await postLocal("/api/preview/stop", { target: "local", owner: OWNER, name: NAME, taskId: "task-d" });
    expect(stopped.status).toBe(200);
    expect(stopped.body.success).toBe(true);
    expect(stopped.body.state).toBe("stopped");

    const status = await getLocal(`/api/preview/status?${localQuery("task-d")}`);
    expect(status.status).toBe(200);
    expect(status.body.state).toBe("stopped");
  });

  it("5. detects a crashed dev server via status polling", async () => {
    const start = await postLocal("/api/preview/start", {
      target: "local",
      owner: OWNER,
      name: NAME,
      taskId: "task-crash",
      devCommand: "node",
      args: ["crash.js"],
    });
    expect(start.status).toBe(200);

    const crashed = await waitForState("task-crash", "crashed");
    expect(String(crashed.lastError)).toContain("exited");
  });

  it("6. logs expose captured stdout", async () => {
    await postLocal("/api/preview/start", { target: "local", owner: OWNER, name: NAME, taskId: "task-log" });
    await waitForState("task-log", "running");

    const logs = await getLocal(`/api/preview/logs?${localQuery("task-log")}`);
    expect(logs.status).toBe(200);
    expect(Array.isArray(logs.body)).toBe(true);
    expect(JSON.stringify(logs.body)).toContain("listening on port");
  });

  it("7. detects the framework from the workspace package.json", async () => {
    const fw = await getLocal(`/api/preview/framework?target=local&owner=${OWNER}&name=${NAME}`);
    expect(fw.status).toBe(200);
    expect(fw.body.framework).toBe("vite");
  });

  it("8. maps missing fields to 400 and an unknown preview to 404", async () => {
    const noTarget = await postLocal("/api/preview/start", { target: "local" });
    expect(noTarget.status).toBe(400);

    const vpsNoMachine = await postLocal("/api/preview/start", { target: "vps" });
    expect(vpsNoMachine.status).toBe(400);

    const unknown = await getLocal(`/api/preview/status?${localQuery("no-such-task")}`);
    expect(unknown.status).toBe(404);
  });
});
