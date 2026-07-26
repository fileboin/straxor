import { Router } from "express";
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

// POST /api/agent/send — pošalji poruku opencode agentu (SSE response)
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
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  let ssh: SSHClient | null = null;

  try {
    const result = await db
      .select()
      .from(machines)
      .where(and(eq(machines.id, machineId), eq(machines.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      sendEvent({ type: "error", message: "Machine not found" });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const machine = result[0];

    if (machine.status !== "ready" || !machine.opencodeRunning) {
      sendEvent({ type: "error", message: "Opencode not running on this machine" });
      res.write("data: [DONE]\n\n");
      res.end();
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

    const opencodePort = machine.opencodePort || 4096;

    // Create or reuse session
    let sessionId = existingSessionId;

    if (!sessionId) {
      const createRes = await curlExec(ssh, opencodePort, "POST", "/session", {
        title: message.slice(0, 60),
      });

      if (createRes.status !== 200) {
        sendEvent({ type: "error", message: `Failed to create session: ${createRes.data}` });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      try {
        const session = JSON.parse(createRes.data) as { id: string };
        sessionId = session.id;
      } catch {
        sendEvent({ type: "error", message: "Invalid session response" });
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
    }

    sendEvent({ type: "session", sessionId });

    // Send message — sync endpoint waits for full response with all parts
    const sendRes = await curlExec(
      ssh,
      opencodePort,
      "POST",
      `/session/${sessionId}/message`,
      { parts: [{ type: "text", text: message }] }
    );

    if (sendRes.status !== 200 && sendRes.status !== 204) {
      sendEvent({ type: "error", message: `Failed to send message: ${sendRes.data}` });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Parse response and stream parts back as individual events
    if (sendRes.status === 200 && sendRes.data) {
      try {
        const parsed = JSON.parse(sendRes.data) as {
          info?: { id?: string };
          parts?: Array<Record<string, unknown>>;
        };
        const parts = parsed.parts || [];

        for (const part of parts) {
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
      } catch {
        // If response isn't JSON, send raw text
        sendEvent({ type: "text", content: sendRes.data });
      }
    }

    sendEvent({ type: "done", sessionId });
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    sendEvent({ type: "error", message: msg });
    res.write("data: [DONE]\n\n");
    res.end();
  } finally {
    if (ssh) {
      try { ssh.close(); } catch {}
    }
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

export default router;
