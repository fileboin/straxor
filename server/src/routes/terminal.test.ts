// ── ITERATION 2 — Terminal/Process streaming SSE over HTTP (E2E, offline) ──
// Exercises the REAL Express routes the production client calls, end to end:
//   POST /api/terminal/start
//   GET  /api/terminal/:id          (status + metadata)
//   POST /api/terminal/:id/cancel
//   GET  /api/terminal/:id/stream   (SSE: stdout/stderr/exit)
//
// No database and no network are needed: the Postgres-backed db module is
// mocked (requireAuth never touches it) while the TerminalManager runs real
// child processes whose stdout/stderr are streamed over a live SSE connection.
//
// Covered contracts:
//   1. SSE streams stdout + stderr live, then a final exit event (exitCode 0)
//   2. connecting after exit replays the buffered output + exit event
//   3. cancel over HTTP → cancelled status + SSE exit (SIGTERM)
//   4. timeout over HTTP → status=timeout + signal=SIGKILL
//   5. concurrent process in the same scope → 409
//   6. unknown process → 404 (inspect / stream / output)
//   7. cross-user access → 403

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import jwt from "jsonwebtoken";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import terminalRouter from "./terminal.js";
import { clearTerminalEntries, type TerminalEvent } from "../lib/terminal.js";
import { clearProcessRegistry } from "../lib/process-registry.js";
import { getRepoWorkspaceDir } from "../runtime/local/workspace.js";

// requireAuth imports the Postgres-backed db layer at module load; swap it out
// so the test never opens a socket to Neon (and never needs DATABASE_URL).
vi.mock("../db/index.js", () => ({ db: {} }));

const USER_A = "terminal-route-a";
const USER_B = "terminal-route-b";
const OWNER = "fileboin";
const NAME = "terminal-route-repo";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const bearerA = jwt.sign({ userId: USER_A, email: "a@straxor.test", role: "user" }, JWT_SECRET);
const bearerB = jwt.sign({ userId: USER_B, email: "b@straxor.test", role: "user" }, JWT_SECRET);

let tmpRoot = "";
let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/terminal", terminalRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "straxor-term-route-"));
  process.env.STRAXOR_WORKSPACE_DIR = tmpRoot;
  // spawn() fails with ENOENT if the target cwd does not exist.
  fs.mkdirSync(getRepoWorkspaceDir(USER_A, OWNER, NAME), { recursive: true });
});

afterEach(() => {
  clearTerminalEntries();
  clearProcessRegistry();
  delete process.env.STRAXOR_WORKSPACE_DIR;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

interface HttpResponse {
  status: number;
  body: Record<string, unknown>;
}

async function post(route: string, body?: unknown, token = bearerA): Promise<HttpResponse> {
  const res = await fetch(baseUrl + route, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? "{}" : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

async function get(route: string, token = bearerA): Promise<HttpResponse> {
  const res = await fetch(baseUrl + route, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/** Consume a `GET /:id/stream` response and parse every `data:` SSE frame. */
async function collectSSE(route: string, token = bearerA): Promise<TerminalEvent[]> {
  const res = await fetch(baseUrl + route, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status).toBe(200);
  if (!res.body) throw new Error("expected a response body");

  const events: TerminalEvent[] = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  const ingest = (text: string) => {
    buf += text;
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            events.push(JSON.parse(line.slice("data: ".length)) as TerminalEvent);
          } catch {
            // ignore malformed frame
          }
        }
      }
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    ingest(decoder.decode(value, { stream: true }));
  }
  ingest(decoder.decode());
  return events;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("Iteration 2 — terminal/process SSE streaming over HTTP (E2E, offline)", () => {
  it("1. SSE streams stdout + stderr live and ends with an exit event (exitCode 0)", async () => {
    const start = await post("/api/terminal/start", {
      owner: OWNER,
      name: NAME,
      command: "node",
      args: [
        "-e",
        "setTimeout(()=>process.stdout.write('SSE-OUT'),30); setTimeout(()=>process.stderr.write('SSE-ERR'),60);",
      ],
    });
    expect(start.status).toBe(201);
    const id = start.body.processId as string;

    const events = await collectSSE(`/api/terminal/${id}/stream`);
    const out = events.filter((e) => e.type === "stdout").map((e) => e.data || "").join("");
    const err = events.filter((e) => e.type === "stderr").map((e) => e.data || "").join("");
    expect(out).toContain("SSE-OUT");
    expect(err).toContain("SSE-ERR");

    const last = events[events.length - 1];
    expect(last.type).toBe("exit");
    expect(last.status).toBe("finished");
    expect(last.exitCode).toBe(0);

    const rec = await get(`/api/terminal/${id}`);
    expect(rec.status).toBe(200);
    expect(rec.body.status).toBe("finished");
    expect((rec.body.endedAt as number) >= (rec.body.startedAt as number)).toBe(true);
  });

  it("2. connecting after exit replays the buffered output + exit event", async () => {
    const start = await post("/api/terminal/start", {
      owner: OWNER,
      name: NAME,
      command: "node",
      args: ["-e", "process.stdout.write('BUF-OUT'); process.stderr.write('BUF-ERR');"],
    });
    const id = start.body.processId as string;

    // Wait until the process is fully settled before subscribing.
    let status = "";
    for (let i = 0; i < 100 && status === ""; i++) {
      const r = await get(`/api/terminal/${id}`);
      status = r.body.status as string;
      if (status === "running") {
        status = "";
        await sleep(25);
      }
    }
    expect(status).toBe("finished");

    const events = await collectSSE(`/api/terminal/${id}/stream`);
    const out = events.filter((e) => e.type === "stdout").map((e) => e.data || "").join("");
    const err = events.filter((e) => e.type === "stderr").map((e) => e.data || "").join("");
    expect(out).toContain("BUF-OUT");
    expect(err).toContain("BUF-ERR");

    const last = events[events.length - 1];
    expect(last.type).toBe("exit");
    expect(last.status).toBe("finished");
    expect(last.exitCode).toBe(0);
  });

  it("3. cancels a running process over HTTP and reflects it via SSE", async () => {
    const start = await post("/api/terminal/start", {
      owner: OWNER,
      name: NAME,
      command: "node",
      args: ["-e", "setInterval(()=>{},1000)"],
    });
    const id = start.body.processId as string;

    const cancel = await post(`/api/terminal/${id}/cancel`, {});
    expect(cancel.status).toBe(200);
    expect(cancel.body.success).toBe(true);
    expect(cancel.body.status).toBe("cancelled");

    const rec = await get(`/api/terminal/${id}`);
    expect(rec.body.status).toBe("cancelled");
    expect(rec.body.signal).toBe("SIGTERM");
    expect(rec.body.exitCode).toBeNull();

    const events = await collectSSE(`/api/terminal/${id}/stream`);
    const last = events[events.length - 1];
    expect(last.type).toBe("exit");
    expect(last.status).toBe("cancelled");
    expect(last.signal).toBe("SIGTERM");
  });

  it("4. enforces the timeout over HTTP (status=timeout, signal=SIGKILL)", async () => {
    const start = await post("/api/terminal/start", {
      owner: OWNER,
      name: NAME,
      command: "node",
      args: ["-e", "setInterval(()=>{},1000)"],
      timeoutMs: 200,
    });
    const id = start.body.processId as string;

    let status = "";
    for (let i = 0; i < 80 && status === ""; i++) {
      const r = await get(`/api/terminal/${id}`);
      status = r.body.status as string;
      if (status === "running") {
        status = "";
        await sleep(50);
      }
    }
    expect(status).toBe("timeout");

    const rec = await get(`/api/terminal/${id}`);
    expect(rec.body.status).toBe("timeout");
    expect(rec.body.signal).toBe("SIGKILL");
    expect(rec.body.exitCode).toBeNull();
  });

  it("5. rejects a concurrent process in the same scope with 409", async () => {
    const first = await post("/api/terminal/start", {
      owner: OWNER,
      name: NAME,
      command: "node",
      args: ["-e", "setInterval(()=>{},1000)"],
    });
    expect(first.status).toBe(201);

    const second = await post("/api/terminal/start", {
      owner: OWNER,
      name: NAME,
      command: "node",
      args: ["-e", ""],
    });
    expect(second.status).toBe(409);
    expect(String(second.body.error)).toContain("already running");

    await post(`/api/terminal/${first.body.processId as string}/cancel`);
  });

  it("6. returns 404 for an unknown process (inspect / stream / output)", async () => {
    expect((await get("/api/terminal/nope")).status).toBe(404);
    expect((await post("/api/terminal/nope/cancel", {})).status).toBe(404);

    const stream = await fetch(baseUrl + "/api/terminal/nope/stream", {
      headers: { Authorization: `Bearer ${bearerA}` },
    });
    expect(stream.status).toBe(404);
    await stream.body?.cancel();

    const output = await fetch(baseUrl + "/api/terminal/nope/output", {
      headers: { Authorization: `Bearer ${bearerA}` },
    });
    expect(output.status).toBe(404);
    await output.body?.cancel();
  });

  it("7. forbids another user from reading the process (403)", async () => {
    const start = await post("/api/terminal/start", {
      owner: OWNER,
      name: NAME,
      command: "node",
      args: ["-e", "setInterval(()=>{},1000)"],
    });
    expect(start.status).toBe(201);
    const id = start.body.processId as string;

    expect((await get(`/api/terminal/${id}`, bearerB)).status).toBe(403);

    const stream = await fetch(baseUrl + `/api/terminal/${id}/stream`, {
      headers: { Authorization: `Bearer ${bearerB}` },
    });
    expect(stream.status).toBe(403);
    await stream.body?.cancel();

    await post(`/api/terminal/${id}/cancel`);
  });
});
