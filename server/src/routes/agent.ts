import { Router } from "express";
import type { Request, Response } from "express";
import { getAdapters } from "../adapters/registry.js";
import { requireAuth } from "../middleware/auth.js";

const CONNECTION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min hard timeout
const router = Router();

router.use(requireAuth);

// POST /api/agent/send — send message to OpenCode via adapter
router.post("/send", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { machineId, sessionId, text, message, mode } = req.body as {
    machineId: string;
    sessionId?: string;
    text?: string;
    message?: string;
    mode?: "sync" | "async";
  };

  // Support both `text` and `message` field names
  const msgText = text || message;

  if (!machineId || !msgText) {
    res.status(400).json({ error: "Missing required fields: machineId, text/message" });
    return;
  }

  // Auto-create session if none provided
  let activeSessionId = sessionId;
  if (!activeSessionId) {
    try {
      const adapter = getAdapters().runtime(userId);
      const result = await adapter.createSession(machineId, "Straxor Session");
      activeSessionId = result.id;
    } catch (err) {
      res.status(500).json({ error: "Failed to create session" });
      return;
    }
  }

  try {
    const adapter = getAdapters().runtime(userId);

    // Emit session ID to client
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.write(`data: ${JSON.stringify({ type: "session", sessionId: activeSessionId })}\n\n`);

    // Try async first (prompt_async)
    const effectiveMode = mode || "async";
    let result;
    try {
      result = await adapter.sendMessage(machineId, activeSessionId, msgText, effectiveMode);
    } catch {
      // prompt_async may not be supported, fall back to sync
      result = await adapter.sendMessage(machineId, activeSessionId, msgText, "sync");
    }

    // If we got parts back from sync, forward them as events
    if (result?.parts) {
      for (const part of result.parts as any[]) {
        if (part.type === "text" && part.text) {
          res.write(`data: ${JSON.stringify({ type: "text", content: part.text })}\n\n`);
        }
      }
    }

    // Now open event stream to capture ongoing events
    const stream = await adapter.openEventStream(machineId);
    let buffer = "";
    let sawDelta = false;
    let finished = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    // Guarded SSE write — never throws, silently no-ops once the response is gone.
    const send = (payload: unknown) => {
      if (finished || res.writableEnded || res.destroyed) return;
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {}
    };

    // Only react to events for OUR session. The shared /event stream emits
    // events for every session on the machine, so an unrelated session going
    // idle must not cut this response short.
    const isOurEvent = (event: unknown): boolean => {
      const sid = (event as any)?.properties?.sessionID;
      return !sid || sid === activeSessionId;
    };

    const finish = (opts: { flush?: boolean; abort?: boolean } = {}) => {
      if (finished) return;
      finished = true;

      const flush = opts.flush !== false;
      const abort = opts.abort === true;

      if (flush && buffer.trim()) {
        send({
          type: "text",
          content: `[partial data flushed: ${buffer.trim().slice(0, 200)}]`,
        });
      }

      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (heartbeat) clearInterval(heartbeat);

      // Abort the remote opencode process so it stops consuming resources —
      // only on interrupted flows (timeout, error, disconnect), never on clean idle.
      // Aborting an already-idle session is harmless (opencode errors are swallowed).
      if (abort) {
        adapter.abortSession(machineId, activeSessionId).catch(() => {});
      }

      try { stream.destroy(); } catch {}
      try {
        res.write("data: [DONE]\n\n");
        res.end();
      } catch {}
    };

    timeoutHandle = setTimeout(() => {
      send({ type: "error", content: "Connection timed out after 30 minutes" });
      finish({ abort: true });
    }, CONNECTION_TIMEOUT_MS);

    // SSE comment heartbeat — keeps the stream alive through proxies/load
    // balancers that close idle connections.
    heartbeat = setInterval(() => {
      if (finished || res.writableEnded || res.destroyed) return;
      try { res.write(": ping\n\n"); } catch {}
    }, 15_000);

    stream.on("data", (chunk: Buffer) => {
      if (finished) return;
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        try {
          const event = JSON.parse(data);
          const eventType = event.type || event.properties?.type;

          if (eventType === "session.error" && isOurEvent(event)) {
            const err =
              event.properties?.properties?.error ||
              event.properties?.error?.message ||
              event.properties?.error ||
              "Agent error";
            send({ type: "error", content: typeof err === "string" ? err : JSON.stringify(err) });
            finish({ abort: true });
            return;
          }

          // Current opencode (>=1.16): streaming text arrives as message.part.delta
          // with properties.{ field: "text", delta }. Send each chunk as-is.
          if (eventType === "message.part.delta") {
            if (!isOurEvent(event)) continue;
            const p = event.properties || {};
            if (p.field === "text" && typeof p.delta === "string" && p.delta.length > 0) {
              sawDelta = true;
              send({ type: "text", content: p.delta });
            }
            continue;
          }

          if (eventType === "message.part.updated" || eventType === "part.updated") {
            if (!isOurEvent(event)) continue;
            const part = event.properties?.part || event.properties?.properties;
            if (!part) continue;

            if (part?.type === "text" && part?.text) {
              // Full snapshot — only use as fallback when this session never
              // emitted a delta (older opencode versions stream via part.updated).
              if (!sawDelta) send({ type: "text", content: part.text });
            } else if (part?.type === "tool-call") {
              send({
                type: "tool_call",
                id: part.callID,
                name: part.state?.tool || part.name,
                args: part.state?.params,
              });
            } else if (part?.type === "tool-result") {
              send({
                type: "tool_result",
                id: part.callID,
                content: part.content,
              });
            } else if (part?.type === "tool") {
              // Current opencode (>=1.16): tool parts are `type: "tool"` with
              // state.status pending|running|completed|error, state.input args,
              // state.output result. Forward state transitions as call/result.
              const status = part.state?.status;
              if (status === "pending" || status === "running") {
                send({
                  type: "tool_call",
                  id: part.callID,
                  name: part.tool,
                  args: part.state?.input || {},
                });
              } else if (status === "completed" || status === "error") {
                send({
                  type: "tool_result",
                  id: part.callID,
                  result:
                    part.state?.output ||
                    part.state?.error ||
                    (status === "error" ? "Alat nije uspio" : ""),
                  status: status === "completed" ? "completed" : "error",
                });
              }
            }
          }

          // The engine emits exactly one session.idle per turn (after the
          // model finishes), so end the response on the first one for our session.
          if (eventType === "session.idle" && isOurEvent(event)) {
            finish({ flush: false });
            return;
          }
        } catch {}
      }
    });

    stream.on("error", () => finish({ abort: true }));
    stream.on("close", () => finish({ abort: true }));

    // Client disconnect → stop streaming and abort remote process
    req.on("close", () => {
      if (!finished) {
        finish({ abort: true });
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write(`data: ${JSON.stringify({ type: "error", content: message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// POST /api/agent/steer — send mid-task instruction to an active session
router.post("/steer", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const { machineId, sessionId, text, message } = req.body as {
    machineId: string;
    sessionId: string;
    text?: string;
    message?: string;
  };

  const msgText = text || message;

  if (!machineId || !sessionId || !msgText) {
    res.status(400).json({ error: "Missing required fields: machineId, sessionId, text/message" });
    return;
  }

  try {
    const adapter = getAdapters().runtime(userId);
    // Send as async — the response arrives on the existing event stream
    await adapter.sendMessage(machineId, sessionId, msgText, "async");
    res.json({ ok: true, sessionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/agent/sessions/:machineId — list OpenCode sessions
router.get("/sessions/:machineId", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const machineId = req.params.machineId as string;

  try {
    const adapter = getAdapters().runtime(userId);
    const sessions = await adapter.listSessions(machineId);
    res.json(sessions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/agent/todos/:machineId/:sessionId — get session todos
router.get("/todos/:machineId/:sessionId", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const machineId = req.params.machineId as string;
  const sessionId = req.params.sessionId as string;

  try {
    const adapter = getAdapters().runtime(userId);
    const todos = await adapter.getTodos(machineId, sessionId);
    res.json(todos);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/agent/diff/:machineId/:sessionId — get session file changes
router.get("/diff/:machineId/:sessionId", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const machineId = req.params.machineId as string;
  const sessionId = req.params.sessionId as string;

  try {
    const adapter = getAdapters().runtime(userId);
    const diff = await adapter.getDiff(machineId, sessionId);
    res.json(diff);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/agent/approve — approve selected file changes
router.post("/approve", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const { machineId, sessionId, paths } = req.body as {
    machineId: string;
    sessionId: string;
    paths: string[];
  };

  if (!machineId || !sessionId || !paths?.length) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const adapter = getAdapters().runtime(userId);
    // Send approval message to agent session
    const message = `Korisnik je odobrio promjene na datotekama: ${paths.join(", ")}. Nastavi.`;
    await adapter.sendMessage(machineId, sessionId, message, "async");
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/agent/reject — reject selected file changes
router.post("/reject", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const { machineId, sessionId, paths } = req.body as {
    machineId: string;
    sessionId: string;
    paths: string[];
  };

  if (!machineId || !sessionId || !paths?.length) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const adapter = getAdapters().runtime(userId);
    // Send rejection message — ask agent to revert
    const message = `Korisnik je ODBIO promjene na datotekama: ${paths.join(", ")}. Vrati te promjene.`;
    await adapter.sendMessage(machineId, sessionId, message, "async");
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/agent/file/:machineId/:sessionId/:path — get file content (before/after)
router.get("/file/:machineId/:sessionId/:encodedPath", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const machineId = req.params.machineId as string;
  const sessionId = req.params.sessionId as string;
  const path = decodeURIComponent(req.params.encodedPath as string);
  const side = (req.query.side as string) || "after";

  try {
    const adapter = getAdapters().runtime(userId);
    // Execute git show or cat to get file content
    let command: string;
    if (side === "before") {
      // Get file content before agent changes — use git show HEAD:path
      command = `cd /tmp && git show HEAD:${path} 2>/dev/null || echo ""`;
    } else {
      // Get current file content
      command = `cat ${path} 2>/dev/null || echo ""`;
    }

    const result = await adapter.executeCommand(machineId, command);
    res.json({ content: result });
  } catch (error) {
    // Fallback — return empty content
    res.json({ content: "" });
  }
});

export default router;
