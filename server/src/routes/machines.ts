import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { machines } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { connectSSH, detectOS, getNodeVersion, installNode, installOpenCode, startOpenCodeServe, checkOpenCodeRunning, getOpenCodePort } from "../runtime/opencode-adapter/index.js";
import type { ProvisionEvent } from "../runtime/opencode-adapter/index.js";
import { encrypt, decrypt, isEncrypted } from "../lib/crypto.js";

function normalizeHost(value: string): string {
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function isBlockedLocalHost(host: string): boolean {
  const normalized = normalizeHost(host).toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

const router = Router();

// GET /api/machines — listaj sve mašine korisnika (maskirane lozinke)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const result = await db
      .select()
      .from(machines)
      .where(eq(machines.userId, userId));

    // Mask sensitive fields
    const masked = result.map((row) => ({
      ...row,
      password: row.password ? "••••••••" : null,
      privateKey: row.privateKey ? "••••••••" : null,
    }));

    res.json(masked);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/machines/:id — dohvati jednu mašinu (maskirana lozinka)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const result = await db
      .select()
      .from(machines)
      .where(and(eq(machines.id, id), eq(machines.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }

    // Mask sensitive fields
    const masked = {
      ...result[0],
      password: result[0].password ? "••••••••" : null,
      privateKey: result[0].privateKey ? "••••••••" : null,
    };

    res.json(masked);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/machines — spremi SSH podatke (enkriptovano)
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { projectId, name, host, port, username, authType, password, privateKey } = req.body;
    const normalizedHost = typeof host === "string" ? normalizeHost(host) : "";
    const normalizedUsername = typeof username === "string" ? username.trim() : "";
    const resolvedAuthType = authType === "key" ? "key" : "password";
    const resolvedPort = Number.isFinite(Number(port)) ? Number(port) : 22;

    if (!projectId || !name || !normalizedHost || !normalizedUsername) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    if (isBlockedLocalHost(normalizedHost)) {
      res.status(400).json({ error: "Use the public VPS IP or DNS hostname, not a local/private address." });
      return;
    }

    if (resolvedPort <= 0 || resolvedPort > 65535) {
      res.status(400).json({ error: "Port must be between 1 and 65535." });
      return;
    }

    if (resolvedAuthType === "password" && (!password || !String(password).trim())) {
      res.status(400).json({ error: "Password authentication requires a password." });
      return;
    }

    if (resolvedAuthType === "key" && (!privateKey || !String(privateKey).trim())) {
      res.status(400).json({ error: "SSH key authentication requires a private key." });
      return;
    }

    const encryptedPassword = resolvedAuthType === "password" && password ? encrypt(password) : null;
    const encryptedPrivateKey = resolvedAuthType === "key" && privateKey ? encrypt(privateKey) : null;

    const result = await db
      .insert(machines)
      .values({
        userId,
        projectId,
        name,
        host: normalizedHost,
        port: resolvedPort,
        username: normalizedUsername,
        authType: resolvedAuthType,
        password: encryptedPassword,
        privateKey: encryptedPrivateKey,
        status: "pending",
      })
      .returning();

    res.json(result[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/machines/:id/provision — auto-provisioning sa SSE status updates
router.post("/:id/provision", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const id = req.params.id as string;

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (event: ProvisionEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    // Get machine from DB
    const result = await db
      .select()
      .from(machines)
      .where(and(eq(machines.id, id), eq(machines.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      sendEvent({ status: "error", message: "Machine not found" });
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const machine = result[0];

    // Decrypt sensitive fields for SSH connection
    const password = machine.password
      ? (isEncrypted(machine.password) ? decrypt(machine.password) : machine.password)
      : undefined;
    const privateKey = machine.privateKey
      ? (isEncrypted(machine.privateKey) ? decrypt(machine.privateKey) : machine.privateKey)
      : undefined;

    // Update status to connecting
    await db
      .update(machines)
      .set({ status: "connecting", lastError: null })
      .where(eq(machines.id, id));

    sendEvent({ status: "connecting", message: "Spajanje na VPS..." });

    // Connect via SSH
    const ssh = await connectSSH({
      host: machine.host,
      port: machine.port,
      username: machine.username,
      password,
      privateKey,
    });

    sendEvent({ status: "checking-os", message: "Detekcija operativnog sustava..." });

    // Detect OS
    const os = await detectOS(ssh);
    sendEvent({ status: "checking-os", message: `OS: ${os}` });

    sendEvent({ status: "checking-node", message: "Provjera Node.js..." });

    // Check Node.js
    const nodeVersion = await getNodeVersion(ssh);

    if (nodeVersion) {
      sendEvent({ status: "checking-node", message: `Node.js pronađen: ${nodeVersion}` });
    } else {
      sendEvent({ status: "installing-node", message: "Node.js nije pronađen. Instalacija..." });

      try {
        await installNode(ssh, os);
        sendEvent({ status: "installing-node", message: "Node.js uspješno instaliran" });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        sendEvent({ status: "error", message: `Greška pri instalaciji Node.js: ${errorMsg}` });

        await db
          .update(machines)
          .set({ status: "error", lastError: errorMsg })
          .where(eq(machines.id, id));

        ssh.close();
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
    }

    // Update DB
    await db
      .update(machines)
      .set({ nodeInstalled: true })
      .where(eq(machines.id, id));

    sendEvent({ status: "starting-opencode", message: "Pokretanje opencode serve..." });

    // Install opencode if not present
    try {
      await installOpenCode(ssh);
    } catch (err) {
      // opencode might already be installed, continue
    }

    // Start opencode serve
    const opencodePort = machine.opencodePort || 4096;

    try {
      await startOpenCodeServe(ssh, opencodePort);
      sendEvent({ status: "ready", message: `Opencode serve pokrenut na portu ${opencodePort}` });

      // Get actual port (might have been different if original was occupied)
      const actualPort = await getOpenCodePort(ssh);

      await db
        .update(machines)
        .set({
          status: "ready",
          opencodeRunning: true,
          opencodePort: actualPort || opencodePort,
        })
        .where(eq(machines.id, id));

      ssh.close();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      sendEvent({ status: "error", message: `Greška pri pokretanju opencode: ${errorMsg}` });

      await db
        .update(machines)
        .set({ status: "error", lastError: errorMsg })
        .where(eq(machines.id, id));

      ssh.close();
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendEvent({ status: "error", message: `Greška: ${message}` });

    await db
      .update(machines)
      .set({ status: "error", lastError: message })
      .where(eq(machines.id, id));

    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// DELETE /api/machines/:id — obriši mašinu
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const result = await db
      .delete(machines)
      .where(and(eq(machines.id, id), eq(machines.userId, userId)))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: "Machine not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
