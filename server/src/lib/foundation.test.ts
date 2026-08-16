import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DEFAULTS, parseDurationMs, parseSizeBytes, getConfig } from "./config";
import {
  TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  canTransition,
  isTerminalTaskStatus,
} from "./task-state";
import {
  registerProcess,
  getProcess,
  listProcesses,
  updateProcess,
  finishProcess,
  killProcess,
  killProcessesForTask,
  killAllProcesses,
  isProcessOrphan,
  clearProcessRegistry,
  registrySize,
} from "./process-registry";

// ── Runtime configuration (Iteration 0, task 1) ──

describe("config — parseDurationMs", () => {
  it("parses human durations", () => {
    expect(parseDurationMs("30m", 0)).toBe(30 * 60 * 1000);
    expect(parseDurationMs("3 min", 0)).toBe(3 * 60 * 1000);
    expect(parseDurationMs("1800s", 0)).toBe(1800 * 1000);
    expect(parseDurationMs("1h", 0)).toBe(3600 * 1000);
    expect(parseDurationMs("2d", 0)).toBe(2 * 24 * 3600 * 1000);
    expect(parseDurationMs("500", 0)).toBe(500);
  });

  it("returns fallback for missing/empty/malformed input", () => {
    expect(parseDurationMs(undefined, 123)).toBe(123);
    expect(parseDurationMs("", 123)).toBe(123);
    expect(parseDurationMs("  ", 123)).toBe(123);
    expect(parseDurationMs("soon", 123)).toBe(123);
  });
});

describe("config — parseSizeBytes", () => {
  it("parses human sizes", () => {
    expect(parseSizeBytes("512mb", 0)).toBe(512 * 1024 * 1024);
    expect(parseSizeBytes("1gb", 0)).toBe(1024 * 1024 * 1024);
    expect(parseSizeBytes("10kb", 0)).toBe(10 * 1024);
    expect(parseSizeBytes("2048", 0)).toBe(2048);
  });

  it("returns fallback for missing/empty/malformed input", () => {
    expect(parseSizeBytes(undefined, 5)).toBe(5);
    expect(parseSizeBytes("", 5)).toBe(5);
    expect(parseSizeBytes("huge", 5)).toBe(5);
  });
});

describe("config — getConfig", () => {
  it("returns defaults when env is empty", () => {
    const cfg = getConfig({});
    expect(cfg.workspaceRoot).toBe(DEFAULTS.workspaceRoot);
    expect(cfg.maxProcessTimeMs).toBe(DEFAULTS.maxProcessTimeMs);
    expect(cfg.maxPreviewStartupMs).toBe(DEFAULTS.maxPreviewStartupMs);
    expect(cfg.maxPreviewTimeMs).toBe(DEFAULTS.maxPreviewTimeMs);
    expect(cfg.cleanupIntervalMs).toBe(DEFAULTS.cleanupIntervalMs);
    expect(cfg.taskWorkspaceTtlMs).toBe(DEFAULTS.taskWorkspaceTtlMs);
  });

  it("reads env overrides (MAX_PROCESS_TIME etc.)", () => {
    const cfg = getConfig({
      MAX_PROCESS_TIME: "45m",
      MAX_WORKSPACE_SIZE: "1gb",
      WORKSPACE_ROOT: "/tmp/ws",
      MAX_PREVIEW_STARTUP: "90s",
    });
    expect(cfg.maxProcessTimeMs).toBe(45 * 60 * 1000);
    expect(cfg.maxWorkspaceSizeBytes).toBe(1024 ** 3);
    expect(cfg.workspaceRoot).toBe("/tmp/ws");
    expect(cfg.maxPreviewStartupMs).toBe(90 * 1000);
  });
});

// ── Persistent task state lifecycle (Iteration 0, task 3) ──

describe("task-state", () => {
  it("has the seven required statuses in order", () => {
    expect(TASK_STATUSES).toEqual([
      "QUEUED",
      "RUNNING",
      "VERIFYING",
      "WAITING_APPROVAL",
      "VERIFIED",
      "FAILED",
      "CANCELLED",
    ]);
  });

  it("terminal statuses are VERIFIED/FAILED/CANCELLED", () => {
    expect(TERMINAL_TASK_STATUSES).toEqual(["VERIFIED", "FAILED", "CANCELLED"]);
  });

  it("allows the happy path QUEUED→RUNNING→VERIFYING→WAITING_APPROVAL→VERIFIED", () => {
    expect(canTransition("QUEUED", "RUNNING")).toBe(true);
    expect(canTransition("RUNNING", "VERIFYING")).toBe(true);
    expect(canTransition("VERIFYING", "WAITING_APPROVAL")).toBe(true);
    expect(canTransition("WAITING_APPROVAL", "VERIFIED")).toBe(true);
  });

  it("forbids an agent jumping straight to VERIFIED", () => {
    expect(canTransition("QUEUED", "VERIFIED")).toBe(false);
    expect(canTransition("RUNNING", "VERIFIED")).toBe(false);
    expect(canTransition("VERIFYING", "VERIFIED")).toBe(false);
  });

  it("forbids leaving terminal states except the FAILED→QUEUED retry", () => {
    expect(canTransition("VERIFIED", "RUNNING")).toBe(false);
    expect(canTransition("CANCELLED", "RUNNING")).toBe(false);
    expect(canTransition("FAILED", "QUEUED")).toBe(true);
  });

  it("isTerminalTaskStatus recognizes terminal statuses", () => {
    expect(isTerminalTaskStatus("VERIFIED")).toBe(true);
    expect(isTerminalTaskStatus("FAILED")).toBe(true);
    expect(isTerminalTaskStatus("CANCELLED")).toBe(true);
    expect(isTerminalTaskStatus("RUNNING")).toBe(false);
    expect(isTerminalTaskStatus("QUEUED")).toBe(false);
  });
});

// ── In-memory process registry (Iteration 0, task 4) ──

describe("process-registry", () => {
  beforeEach(() => clearProcessRegistry());
  afterEach(() => clearProcessRegistry());

  it("registers a process as running with full metadata", () => {
    const rec = registerProcess({
      command: "npm",
      args: ["run", "build"],
      cwd: "/repo",
      pid: 42,
      userId: "u1",
      taskId: "t1",
    });
    expect(rec.status).toBe("running");
    expect(rec.pid).toBe(42);
    expect(rec.command).toBe("npm");
    expect(rec.args).toEqual(["run", "build"]);
    expect(rec.userId).toBe("u1");
    expect(rec.taskId).toBe("t1");
    expect(rec.exitCode).toBeNull();
    expect(getProcess(rec.id)?.id).toBe(rec.id);
  });

  it("updates fields and finishes with status + exit code", () => {
    const rec = registerProcess({ command: "ls" });
    updateProcess(rec.id, { stdoutBytes: 12 });
    expect(getProcess(rec.id)?.stdoutBytes).toBe(12);

    const done = finishProcess(rec.id, { status: "finished", exitCode: 0 });
    expect(done?.status).toBe("finished");
    expect(done?.exitCode).toBe(0);
    expect(done?.endedAt).not.toBeNull();
  });

  it("kills a running process via its handle", () => {
    let killed = false;
    const rec = registerProcess({
      command: "sleep",
      handle: { pid: 7, kill: () => ((killed = true), true) },
    });
    expect(killProcess(rec.id)).toBe(true);
    expect(killed).toBe(true);
    expect(getProcess(rec.id)?.status).toBe("cancelled");
  });

  it("killProcess is a no-op for already-finished processes", () => {
    const rec = registerProcess({ command: "ls", handle: { kill: () => true } });
    finishProcess(rec.id, { status: "finished", exitCode: 0 });
    expect(killProcess(rec.id)).toBe(false);
  });

  it("killProcessesForTask only kills processes of that task", () => {
    const a = registerProcess({ command: "x", taskId: "t1", handle: { kill: () => true } });
    registerProcess({ command: "y", taskId: "t2", handle: { kill: () => true } });
    expect(killProcessesForTask("t1")).toBe(1);
    expect(getProcess(a.id)?.status).toBe("cancelled");
  });

  it("killAllProcesses kills every running process", () => {
    registerProcess({ command: "x", handle: { kill: () => true } });
    registerProcess({ command: "y", handle: { kill: () => true } });
    expect(killAllProcesses()).toBe(2);
    expect(listProcesses((r) => r.status === "running")).toHaveLength(0);
  });

  it("detects orphaned processes past max age", () => {
    const rec = registerProcess({ command: "x" });
    expect(isProcessOrphan(rec, Date.now(), 1000)).toBe(false);
    expect(isProcessOrphan(rec, Date.now() + 60_000, 1000)).toBe(true);
  });

  it("listProcesses filters and registrySize counts", () => {
    registerProcess({ command: "a", taskId: "t1" });
    registerProcess({ command: "b" });
    expect(registrySize()).toBe(2);
    expect(listProcesses((r) => r.taskId === "t1")).toHaveLength(1);
    expect(listProcesses()).toHaveLength(2);
  });
});
