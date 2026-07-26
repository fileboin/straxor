import { Router } from "express";
import type { Duplex } from "stream";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { machines } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { connectSSH } from "../runtime/opencode-adapter/ssh.js";
import { encrypt, decrypt, isEncrypted } from "../lib/crypto.js";
import type { SSHClient } from "../runtime/opencode-adapter/ssh.js";

const router = Router();

async function curlExec(
  ssh: SSHClient,
  opencodePort: number,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: string }> {
  const bodyFlag = body
    ? ` -d '${JSON.stringify(body).replace(/'/g, "'\\''")}'`
    : "";
  const { stdout } = await ssh.exec(
    `curl -s -w '\\n%{http_code}' -X ${method}` +
    ` -H 'Content-Type: application/json'${bodyFlag}` +
    ` http://127.0.0.1:${opencodePort}${path}`
  );

  const lines = stdout.trim().split("\n");
  const httpCode = parseInt(lines.pop() || "0", 10);
  const data = lines.join("\n");

  return { status: httpCode, data };
}

function parseSSEBuffer(
  buffer: string
): { events: Array<{ type: string; data: string }>; remainder: string } {
  const events: Array<{ type: string; data: string }> = [];
  const chunks = buffer.split("\n\n");

  const remainder = chunks.pop() || "";

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;

    let eventType = "";
    let eventData = "";

    for (const line of chunk.split("\n")) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        eventData = line.slice(6);
      }
    }

    if (eventType || eventData) {
      events.push({ type: eventType, data: eventData });
    }
  }

  return { events, remainder };
}

// POST /api/agent/send — live SSE proxy to opencode serve
router.post("/send", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { machineId, message, sessionId: existingSessionId } = req.body;

  if (!machineId || !message) {
    res.status(400).json({ error: "machineId and message are required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (event: Record<string, unknown>) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  let ssh: SSHClient | null = null;
  let sseStream: Duplex | null = null;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    if (sseStream) {
      try { sseStream.destroy(); } catch {}
    }
    if (ssh) {
      try { ssh.close(); } catch {}
    }
    if (!res.writableEnded) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  };

  try {
    const result = await db
      .select()
      .from(machines)
      .where(and(eq(machines.id, machineId), eq(machines.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      sendEvent({ type: "error", message: "Machine not found" });
      finish();
      return;
    }

    const machine = result[0];

    if (machine.status !== "ready" || !machine.opencodeRunning) {
      sendEvent({ type: "error", message: "Opencode not running on this machine" });
      finish();
      return;
    }

    const password = machine.password
      ? (isEncrypted(machine.password) ? decrypt(machine.password) : machine.password)
      : undefined;
    const privateKey = machine.privateKey
      ? (isEncrypted(machine.privateKey) ? decrypt(machine.privateKey) : machine.privateKey)
      : undefined;

    ssh = await connectSSH({
      host: machine.host,
      port: machine.port,
      username: machine.username,
      password,
      privateKey,
    });

    // Handle SSH connection drops
    ssh.client.on("error", () => {
      finish();
    });

    ssh.client.on("close", () => {
      finish();
    });

    const opencodePort = machine.opencodePort || 4096;

    // Create or reuse session
    let sessionId = existingSessionId;

    if (!sessionId) {
      const createRes = await curlExec(ssh, opencodePort, "POST", "/session", {
        title: message.slice(0, 60),
      });

      if (createRes.status !== 200) {
        sendEvent({ type: "error", message: `Failed to create session: ${createRes.data}` });
        finish();
        return;
      }

      try {
        const session = JSON.parse(createRes.data) as { id: string };
        sessionId = session.id;
      } catch {
        sendEvent({ type: "error", message: "Invalid session response" });
        finish();
        return;
      }
    }

    sendEvent({ type: "session", sessionId });

    // Start SSE listener BEFORE sending the message
    const sseCmd = `curl -sN http://127.0.0.1:${opencodePort}/event`;
    sseStream = await ssh.execStream(sseCmd);

    let sseBuffer = "";

    sseStream.on("data", (chunk: Buffer) => {
      sseBuffer += chunk.toString();

      const { events, remainder } = parseSSEBuffer(sseBuffer);
      sseBuffer = remainder;

      for (const event of events) {
        // Skip non-session events early
        if (!event.data) continue;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(event.data);
        } catch {
          continue;
        }

        // Session events
        if (event.type === "session.created" || event.type === "session.updated") {
          const sid = (parsed.id || parsed.sessionID || parsed.sessionId) as string;
          if (sid === sessionId) {
            sendEvent({ type: "session", sessionId, event: event.type });
          }
        }

        // Message updated — contains text and tool call parts
        if (event.type === "message.updated") {
          const info = (parsed.info || parsed) as Record<string, unknown>;
          const msgSessionId = (info.sessionID || info.sessionId) as string;
          if (msgSessionId === sessionId) {
            const parts = (parsed.parts || []) as Record<string, unknown>[];
            for (const part of parts) {
              forwardPart(sendEvent, part);
            }
          }
        }

        // Part updated — individual part change
        if (event.type === "part.updated") {
          const part = (parsed.part || parsed) as Record<string, unknown>;
          forwardPart(sendEvent, part);
        }

        // Session idle — agent finished
        if (event.type === "session.idle") {
          const sid = (parsed.sessionID || parsed.sessionId || parsed.id) as string;
          if (sid === sessionId) {
            sendEvent({ type: "done", sessionId });
            finish();
            return;
          }
        }

        // Session error
        if (event.type === "session.error") {
          const sid = (parsed.sessionID || parsed.sessionId || parsed.id) as string;
          if (sid === sessionId) {
            sendEvent({
              type: "error",
              message: (parsed.error || parsed.message || "Agent error") as string,
            });
            finish();
            return;
          }
        }
      }
    });

    sseStream.on("error", () => {
      finish();
    });

    sseStream.on("close", () => {
      // Flush any remaining partial SSE data
      if (sseBuffer.trim()) {
        const { events } = parseSSEBuffer(sseBuffer + "\n\n");
        for (const event of events) {
          if (!event.data) continue;
          try {
            const parsed = JSON.parse(event.data) as Record<string, unknown>;
            if (event.type === "message.updated") {
              const info = (parsed.info || parsed) as Record<string, unknown>;
              const msgSessionId = (info.sessionID || info.sessionId) as string;
              if (msgSessionId === sessionId) {
                const parts = (parsed.parts || []) as Record<string, unknown>[];
                for (const part of parts) {
                  forwardPart(sendEvent, part);
                }
              }
            }
            if (event.type === "part.updated") {
              const part = (parsed.part || parsed) as Record<string, unknown>;
              forwardPart(sendEvent, part);
            }
          } catch {}
        }
      }
      finish();
    });

    // Send message via prompt_async (returns 204 immediately)
    const sendRes = await curlExec(
      ssh,
      opencodePort,
      "POST",
      `/session/${sessionId}/prompt_async`,
      { parts: [{ type: "text", text: message }] }
    );

    // prompt_async should return 204; if it returns 200, parse and forward parts
    if (sendRes.status === 200 && sendRes.data) {
      try {
        const parsed = JSON.parse(sendRes.data) as {
          info?: { id?: string };
          parts?: Array<Record<string, unknown>>;
        };
        const parts = parsed.parts || [];
        for (const part of parts) {
          forwardPart(sendEvent, part);
        }
      } catch {
        // ignore parse errors
      }
    } else if (sendRes.status !== 204 && sendRes.status !== 200) {
      // prompt_async failed — fall back to sync message
      const syncRes = await curlExec(
        ssh,
        opencodePort,
        "POST",
        `/session/${sessionId}/message`,
        { parts: [{ type: "text", text: message }] }
      );

      if (syncRes.status === 200 && syncRes.data) {
        try {
          const parsed = JSON.parse(syncRes.data) as {
            parts?: Array<Record<string, unknown>>;
          };
          for (const part of parsed.parts || []) {
            forwardPart(sendEvent, part);
          }
        } catch {}
      }

      sendEvent({ type: "done", sessionId });
      finish();
      return;
    }

    // Client disconnect cleanup
    req.on("close", () => {
      finish();
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    sendEvent({ type: "error", message: msg });
    finish();
  }
});

// GET /api/agent/sessions — listaj sesije na opencode instanci
router.get("/sessions/:machineId", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const machineId = req.params.machineId as string;

  let ssh: SSHClient | null = null;

  try {
    const result = await db
      .select()
      .from(machines)
      .where(and(eq(machines.id, machineId), eq(machines.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }

    const machine = result[0];
    const password = machine.password
      ? (isEncrypted(machine.password) ? decrypt(machine.password) : machine.password)
      : undefined;
    const privateKey = machine.privateKey
      ? (isEncrypted(machine.privateKey) ? decrypt(machine.privateKey) : machine.privateKey)
      : undefined;

    ssh = await connectSSH({
      host: machine.host,
      port: machine.port,
      username: machine.username,
      password,
      privateKey,
    });

    const opencodePort = machine.opencodePort || 4096;
    const response = await curlExec(ssh, opencodePort, "GET", "/session");

    if (response.status !== 200) {
      res.status(502).json({ error: "Failed to fetch sessions" });
      return;
    }

    res.json(JSON.parse(response.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  } finally {
    if (ssh) {
      try { ssh.close(); } catch {}
    }
  }
});

// GET /api/agent/todos/:machineId/:sessionId — dohvati todo listu iz opencode sesije
router.get("/todos/:machineId/:sessionId", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const machineId = req.params.machineId as string;
  const sessionId = req.params.sessionId as string;

  let ssh: SSHClient | null = null;

  try {
    const result = await db
      .select()
      .from(machines)
      .where(and(eq(machines.id, machineId), eq(machines.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }

    const machine = result[0];
    const password = machine.password
      ? (isEncrypted(machine.password) ? decrypt(machine.password) : machine.password)
      : undefined;
    const privateKey = machine.privateKey
      ? (isEncrypted(machine.privateKey) ? decrypt(machine.privateKey) : machine.privateKey)
      : undefined;

    ssh = await connectSSH({
      host: machine.host,
      port: machine.port,
      username: machine.username,
      password,
      privateKey,
    });

    const opencodePort = machine.opencodePort || 4096;
    const response = await curlExec(ssh, opencodePort, "GET", `/session/${sessionId}/todo`);

    if (response.status !== 200) {
      res.status(502).json({ error: "Failed to fetch todos" });
      return;
    }

    res.json(JSON.parse(response.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  } finally {
    if (ssh) {
      try { ssh.close(); } catch {}
    }
  }
});

// GET /api/agent/diff/:machineId/:sessionId — dohvati diff iz opencode sesije
router.get("/diff/:machineId/:sessionId", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const machineId = req.params.machineId as string;
  const sessionId = req.params.sessionId as string;

  let ssh: SSHClient | null = null;

  try {
    const result = await db
      .select()
      .from(machines)
      .where(and(eq(machines.id, machineId), eq(machines.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }

    const machine = result[0];
    const password = machine.password
      ? (isEncrypted(machine.password) ? decrypt(machine.password) : machine.password)
      : undefined;
    const privateKey = machine.privateKey
      ? (isEncrypted(machine.privateKey) ? decrypt(machine.privateKey) : machine.privateKey)
      : undefined;

    ssh = await connectSSH({
      host: machine.host,
      port: machine.port,
      username: machine.username,
      password,
      privateKey,
    });

    const opencodePort = machine.opencodePort || 4096;
    const response = await curlExec(ssh, opencodePort, "GET", `/session/${sessionId}/diff`);

    if (response.status !== 200) {
      res.status(502).json({ error: "Failed to fetch diff" });
      return;
    }

    res.json(JSON.parse(response.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  } finally {
    if (ssh) {
      try { ssh.close(); } catch {}
    }
  }
});

function forwardPart(
  sendEvent: (event: Record<string, unknown>) => void,
  part: Record<string, unknown>
) {
  const type = part.type as string;

  if (type === "text") {
    sendEvent({
      type: "text",
      content: part.text || "",
      partID: part.id,
    });
  } else if (type === "tool-call" || type === "tool-call-start") {
    sendEvent({
      type: "tool_call",
      id: part.toolCallID || part.id,
      name: part.toolName || part.name,
      args: part.args || {},
      status: "running",
    });
  } else if (type === "tool-result" || type === "tool-call-finish") {
    sendEvent({
      type: "tool_result",
      id: part.toolCallID || part.id,
      name: part.toolName || part.name,
      result: part.content || part.result || "",
      status: part.isError ? "error" : "completed",
    });
  }
}

export default router;
