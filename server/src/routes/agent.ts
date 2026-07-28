import { Router } from "express";
import type { Request, Response } from "express";
import { getAdapters } from "../adapters/registry.js";

const router = Router();

// POST /api/agent/send — send message to OpenCode via adapter
router.post("/send", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
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
    let sessionStarted = false;

    stream.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        try {
          const event = JSON.parse(data);
          const eventType = event.properties?.type || event.type;

          // Mark session as started when we see the session.idle event
          if (eventType === "session.idle") {
            sessionStarted = true;
          }

          if (eventType === "session.error") {
            res.write(`data: ${JSON.stringify({ type: "error", content: event.properties?.properties?.error || "Agent error" })}\n\n`);
            stream.destroy();
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }

          if (eventType === "message.updated" || eventType === "part.updated") {
            const part = event.properties?.properties;
            if (part?.type === "text" && part?.content) {
              res.write(`data: ${JSON.stringify({ type: "text", content: part.content })}\n\n`);
            } else if (part?.type === "tool-call") {
              res.write(`data: ${JSON.stringify({
                type: "tool_call",
                id: part.callID,
                name: part.state?.tool || part.name,
                args: part.state?.params,
              })}\n\n`);
            } else if (part?.type === "tool-result") {
              res.write(`data: ${JSON.stringify({
                type: "tool_result",
                id: part.callID,
                content: part.content,
              })}\n\n`);
            }
          }

          // Session finished (no more tool calls pending)
          if (eventType === "session.idle" && sessionStarted) {
            stream.destroy();
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }
        } catch {}
      }
    });

    stream.on("error", () => {
      stream.destroy();
      res.write("data: [DONE]\n\n");
      res.end();
    });

    stream.on("close", () => {
      res.write("data: [DONE]\n\n");
      res.end();
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
  const userId = (req as any).userId as string;
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
  const userId = (req as any).userId as string;
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
  const userId = (req as any).userId as string;
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
  const userId = (req as any).userId as string;
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
  const userId = (req as any).userId as string;
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
  const userId = (req as any).userId as string;
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
  const userId = (req as any).userId as string;
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
