// ── Terminal / Process API (Iteration 2) ──
// REST + SSE surface for the TerminalManager: start, list, inspect, cancel and
// stream stdout/stderr of commands running in a repo sandbox.

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  TerminalBusyError,
  cancelTerminalProcess,
  getTerminalProcess,
  getTerminalOutput,
  listTerminalProcesses,
  startTerminalProcess,
  subscribeToTerminal,
  type TerminalEvent,
} from "../lib/terminal.js";
import { getRepoWorkspaceDir } from "../runtime/local/workspace.js";

const router = Router();

router.use(requireAuth);

// POST /api/terminal/start — start a command in a repo sandbox (owner/name).
router.post("/start", (req, res) => {
  const userId = req.user!.userId;
  const { owner, name, command, args, taskId, timeoutMs, env } = req.body as {
    owner?: string;
    name?: string;
    command?: string;
    args?: string[];
    taskId?: string | null;
    timeoutMs?: number;
    env?: Record<string, string>;
  };

  if (!command || typeof command !== "string") {
    res.status(400).json({ error: "command is required" });
    return;
  }
  if (!owner || !name) {
    res.status(400).json({ error: "owner and name are required to target a repo sandbox" });
    return;
  }

  const cwd = getRepoWorkspaceDir(userId, owner, name);
  try {
    const result = startTerminalProcess({
      userId,
      cwd,
      command,
      args: Array.isArray(args) ? args : [],
      taskId: taskId ?? null,
      timeoutMs: typeof timeoutMs === "number" && timeoutMs > 0 ? timeoutMs : undefined,
      env: env ?? {},
    });
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof TerminalBusyError) {
      res.status(409).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

// GET /api/terminal — list this user's processes (newest handled client-side).
router.get("/", (req, res) => {
  res.json(listTerminalProcesses(req.user!.userId));
});

// GET /api/terminal/:id — status + metadata + buffered output.
router.get("/:id", (req, res) => {
  const rec = getTerminalProcess(req.params.id);
  if (!rec) {
    res.status(404).json({ error: "Process not found" });
    return;
  }
  if (rec.userId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(rec);
});

// GET /api/terminal/:id/output — buffered stdout/stderr only.
router.get("/:id/output", (req, res) => {
  const rec = getTerminalProcess(req.params.id);
  if (!rec) {
    res.status(404).json({ error: "Process not found" });
    return;
  }
  if (rec.userId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(getTerminalOutput(req.params.id));
});

// POST /api/terminal/:id/cancel — kill a running process.
router.post("/:id/cancel", (req, res) => {
  const rec = getTerminalProcess(req.params.id);
  if (!rec) {
    res.status(404).json({ error: "Process not found" });
    return;
  }
  if (rec.userId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const signal = (req.body?.signal as NodeJS.Signals) || "SIGTERM";
  const ok = cancelTerminalProcess(req.params.id, signal);
  res.json({ success: ok, status: ok ? "cancelled" : rec.status });
});

// GET /api/terminal/:id/stream — SSE: replay buffer, then live stdout/stderr.
router.get("/:id/stream", (req, res) => {
  const id = req.params.id;
  const rec = getTerminalProcess(id);
  if (!rec) {
    res.status(404).json({ error: "Process not found" });
    return;
  }
  if (rec.userId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: TerminalEvent) => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  let heartbeat: NodeJS.Timeout | null = null;
  const finish = () => {
    if (heartbeat) clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  };

  // Replay what was already buffered before this client connected.
  const { stdout, stderr } = getTerminalOutput(id);
  if (stdout) send({ processId: id, type: "stdout", data: stdout });
  if (stderr) send({ processId: id, type: "stderr", data: stderr });

  if (rec.status !== "running") {
    send({ processId: id, type: "exit", exitCode: rec.exitCode, signal: rec.signal, status: rec.status });
    finish();
    return;
  }

  heartbeat = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(": ping\n\n");
  }, 15000);

  const off = subscribeToTerminal(id, (event) => {
    send(event);
    if (event.type === "exit") {
      off();
      finish();
    }
  });

  req.on("close", () => {
    off();
    finish();
  });
});

export default router;
