// ── FAZA 7b/7c — Team fan-out over HTTP (E2E, offline) ──
// Exercises the REAL Express routes the production client calls, end to end:
//   POST /api/agent/team                (one prompt → N role-specific turns)
//   GET  /api/agent/team/:taskId        (task + per-role job progress)
//   POST /api/agent/team/:taskId/approve (approve → VERIFIED)
//
// No database and no network are needed: the Postgres-backed db module is
// mocked, the runtime adapter is a controllable fake (so no engine is spawned),
// and the task/job persistence layers are in-memory while the REAL route
// orchestration runs: role normalization, per-slot FIFO queue, role SYSTEM
// prompt injection, and the QUEUED → RUNNING → VERIFYING → WAITING_APPROVAL →
// VERIFIED lifecycle (validated with the real task-state transition table).
//
// Covered contracts:
//   1. fan-out → 3 default roles, exactly one job running at a time (FIFO),
//      each turn receives its own [STRAXOR TEAM ROLE] system prompt, and the
//      task advances to WAITING_APPROVAL once all roles drain
//   2. missing prompt → 400
//   3. unknown task → 404 (GET and approve)
//   4. invalid roles fall back to the default team
//   5. a failing role marks the whole team run FAILED
//   6. cross-user access → 404

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import { PassThrough } from "node:stream";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import agentRouter from "./agent.js";

// ── Mutable mock state (hoisted above vi.mock) ──
const adapterState = vi.hoisted(() => ({
  sessions: 0,
  messages: [] as { machineId: string; sessionId: string; text: string; mode?: string; system?: string }[],
  inFlight: 0,
  maxInFlight: 0,
  finishDelayMs: 20,
  failSend: false,
}));

const taskStore = vi.hoisted(() => new Map<string, Record<string, any>>());
const jobStore = vi.hoisted(() => new Map<string, Record<string, any>>());

// requireAuth imports the Postgres-backed db layer at module load; swap it out
// so the test never opens a socket to Neon (and never needs DATABASE_URL).
vi.mock("../db/index.js", () => ({ db: {} }));

// Keep the turn off the local-engine/workspace path (no clone, no spawn).
vi.mock("../runtime/local/engine.js", () => ({
  isLocalMachineId: () => false,
  slotFromMachineId: () => "agent",
}));

vi.mock("../runtime/local/shared-workspace.js", () => ({
  withSharedWorkspace: async (_userId: string, work: (ctx: unknown) => Promise<unknown>) => work({}),
  getSharedWorkspaceStatus: async () => ({ connected: false }),
}));

// Controllable runtime adapter: records every send (including its SYSTEM
// prompt), tracks how many turns are in flight at once, and finishes each turn
// with a session.idle event after a short delay.
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
      mode?: string,
      _attachments?: unknown[],
      system?: string,
    ) {
      adapterState.messages.push({ machineId, sessionId, text, mode, system });
      if (adapterState.failSend) throw new Error("forced send failure");
      adapterState.inFlight += 1;
      adapterState.maxInFlight = Math.max(adapterState.maxInFlight, adapterState.inFlight);
      return { parts: [{ type: "text", text: "ok" }] };
    },
    async openEventStream(_machineId: string) {
      const stream = new PassThrough();
      const last = adapterState.messages[adapterState.messages.length - 1];
      setTimeout(() => {
        // Release the turn BEFORE the idle event so the next queued job's
        // sendMessage can only start after this turn is counted as finished —
        // proving the per-slot queue never overlaps two turns.
        adapterState.inFlight = Math.max(0, adapterState.inFlight - 1);
        stream.write(
          `data: ${JSON.stringify({ type: "session.idle", properties: { sessionID: last?.sessionId } })}\n\n`,
        );
        stream.end();
      }, adapterState.finishDelayMs);
      return stream;
    },
    async abortSession() {
      return true;
    },
    async listSessions() {
      return [];
    },
    async getTodos() {
      return [];
    },
    async getDiff() {
      return [];
    },
    async healthCheck() {
      return { running: true, sshConnected: false, opencodePort: null };
    },
    async restart() {
      return {};
    },
    async reconnect() {
      return {};
    },
    async updateRuntime() {
      return {};
    },
    async executeCommand() {
      return "";
    },
  };
  return {
    getAdapters: () => ({ runtime: () => fakeRuntime }),
    initAdapters: () => ({}),
  };
});

// In-memory task store that keeps the REAL transition validation (task-state).
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
  };
});

// In-memory job store that keeps the REAL finalStatusForTimeline helper.
vi.mock("../lib/agent-jobs.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/agent-jobs.js")>();
  return {
    ...actual,
    createAgentJob: async (input: {
      id: string;
      userId: string;
      machineId: string;
      sessionId: string;
      taskId?: string | null;
      label?: string | null;
      status?: string;
    }) => {
      jobStore.set(input.id, {
        id: input.id,
        userId: input.userId,
        machineId: input.machineId,
        sessionId: input.sessionId,
        taskId: input.taskId ?? null,
        label: input.label ?? null,
        status: input.status ?? "running",
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
      if (j && j.userId === userId) {
        Object.assign(j, { status, error, finished: true, timeline, updatedAt: new Date() });
      }
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

const USER_A = "team-user-a";
const USER_B = "team-user-b";
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const bearerA = jwt.sign({ userId: USER_A, email: "a@straxor.test", role: "user" }, JWT_SECRET);
const bearerB = jwt.sign({ userId: USER_B, email: "b@straxor.test", role: "user" }, JWT_SECRET);

let server: Server;
let baseUrl = "";

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

beforeEach(() => {
  adapterState.sessions = 0;
  adapterState.messages = [];
  adapterState.inFlight = 0;
  adapterState.maxInFlight = 0;
  adapterState.finishDelayMs = 20;
  adapterState.failSend = false;
  taskStore.clear();
  jobStore.clear();
});

async function post(route: string, body?: unknown, token = bearerA): Promise<{ status: number; body: any }> {
  const res = await fetch(baseUrl + route, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? "{}" : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function get(route: string, token = bearerA): Promise<{ status: number; body: any }> {
  const res = await fetch(baseUrl + route, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll GET /team/:taskId until the task reaches `status`. */
async function waitForTaskStatus(taskId: string, status: string, timeoutMs = 9000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await get(`/api/agent/team/${taskId}`);
    if (r.status === 200 && r.body.task?.status === status) return r.body;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for task status ${status}`);
}

describe("FAZA 7b/7c — Team fan-out over HTTP (E2E, offline)", () => {
  it("1. fans out one prompt to default roles and drains them SEQUENTIALLY to WAITING_APPROVAL", async () => {
    const start = await post("/api/agent/team", { prompt: "Add a health endpoint" });
    expect(start.status).toBe(200);
    const taskId = start.body.taskId as string;
    expect(taskId).toBeTruthy();
    expect(start.body.status).toBe("RUNNING");

    // Three default roles, first job runs immediately, the rest queue.
    expect(start.body.roles).toHaveLength(3);
    expect(start.body.jobs).toHaveLength(3);
    expect(start.body.jobs.filter((j: { status: string }) => j.status === "running")).toHaveLength(1);
    expect(start.body.jobs.filter((j: { status: string }) => j.status === "queued")).toHaveLength(2);

    // Wait for the whole team to drain (VERIFYING → WAITING_APPROVAL).
    const detail = await waitForTaskStatus(taskId, "WAITING_APPROVAL");
    expect(detail.jobs).toHaveLength(3);
    expect(detail.jobs.every((j: { status: string }) => j.status === "done")).toBe(true);

    // Per-slot FIFO: never more than one turn in flight at a time.
    expect(adapterState.maxInFlight).toBe(1);
    expect(adapterState.messages).toHaveLength(3);

    // Each role turn received its own SYSTEM prompt (kept out of the text).
    const systems = adapterState.messages.map((m) => m.system || "");
    expect(systems.every((s) => s.includes("[STRAXOR TEAM ROLE]"))).toBe(true);
    expect(systems.join("\n")).toContain("Role: Coding Agent");
    expect(systems.join("\n")).toContain("Role: Testing Agent");
    expect(systems.join("\n")).toContain("Role: Security Agent");
    // The visible message stays the bare prompt (no role/context spam).
    expect(adapterState.messages.every((m) => m.text === "Add a health endpoint")).toBe(true);

    // Approval closes the loop.
    const approve = await post(`/api/agent/team/${taskId}/approve`);
    expect(approve.status).toBe(200);
    expect(approve.body.ok).toBe(true);
    expect(approve.body.status).toBe("VERIFIED");

    const after = await get(`/api/agent/team/${taskId}`);
    expect(after.body.task.status).toBe("VERIFIED");
  });

  it("2. rejects a missing prompt with 400", async () => {
    const res = await post("/api/agent/team", {});
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toContain("prompt");
  });

  it("3. returns 404 for an unknown task (GET and approve)", async () => {
    expect((await get("/api/agent/team/nope")).status).toBe(404);
    expect((await post("/api/agent/team/nope/approve", {})).status).toBe(404);
  });

  it("4. normalizes invalid roles down to the default team", async () => {
    const start = await post("/api/agent/team", { prompt: "fallback", roles: ["not-a-role"] });
    expect(start.status).toBe(200);
    expect(start.body.jobs).toHaveLength(3);
    expect(start.body.roles.map((r: { id: string }) => r.id).sort()).toEqual(["coding", "security", "testing"]);

    // Drain the run so the shared slot is free for the next test.
    await waitForTaskStatus(start.body.taskId, "WAITING_APPROVAL");
  });

  it("5. a failing role marks the whole team run FAILED", async () => {
    adapterState.failSend = true;
    const start = await post("/api/agent/team", { prompt: "boom" });
    expect(start.status).toBe(200);

    const detail = await waitForTaskStatus(start.body.taskId, "FAILED");
    expect(detail.jobs).toHaveLength(3);
    expect(detail.jobs.every((j: { status: string }) => j.status === "error")).toBe(true);
    expect(String(detail.jobs[0].error)).toContain("forced send failure");
  });

  it("6. another user cannot read or approve the task (404)", async () => {
    const start = await post("/api/agent/team", { prompt: "private" });
    expect(start.status).toBe(200);
    const taskId = start.body.taskId as string;

    expect((await get(`/api/agent/team/${taskId}`, bearerB)).status).toBe(404);
    expect((await post(`/api/agent/team/${taskId}/approve`, {}, bearerB)).status).toBe(404);

    // Drain the run so the shared slot is free for any later test.
    await waitForTaskStatus(taskId, "WAITING_APPROVAL");
  });
});
