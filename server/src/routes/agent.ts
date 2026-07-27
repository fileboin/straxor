import { Router } from "express";
import type { Request, Response } from "express";
import { getAdapters } from "../adapters/registry.js";

const router = Router();

// POST /api/agent/send — send message to OpenCode via adapter
router.post("/send", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { machineId, sessionId, text, mode } = req.body as {
    machineId: string;
    sessionId: string;
    text: string;
    mode?: "sync" | "async";
  };

  if (!machineId || !sessionId || !text) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const adapter = getAdapters().runtime(userId);

    // Try async first (prompt_async)
    const effectiveMode = mode || "async";
    let result;
    try {
      result = await adapter.sendMessage(machineId, sessionId, text, effectiveMode);
    } catch {
      // prompt_async may not be supported, fall back to sync
      result = await adapter.sendMessage(machineId, sessionId, text, "sync");
    }

    // Set SSE headers for the response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

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

export default router;
