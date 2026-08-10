import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { machines, infraConfigs, projects } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import {
  connectSSH,
  detectOS,
  getNodeVersion,
  installNode,
  installOpenCode,
  startOpenCodeServe,
  checkOpenCodeRunning,
  getOpenCodePort,
  hasDocker,
  installDocker,
  isCoolifyInstalled,
  getCoolifyUrlHint,
  installCoolify,
} from "../runtime/opencode-adapter/index.js";
import type { ProvisionEvent, CoolifyInstallEvent } from "../runtime/opencode-adapter/index.js";
import { encrypt, decrypt, isEncrypted } from "../lib/crypto.js";

function stripMarkdown(value: string): string {
  return value
    .replace(/\*+/g, "")     // ** bold, * italic
    .replace(/`+/g, "")      // `` backticks
    .replace(/_+/g, "")      // __ underline
    .replace(/~+/g, "")      // ~~ strikethrough
    .replace(/\[|\]/g, "")   // [ ] brackets
    .replace(/\(|\)/g, "")   // ( ) parens used in markdown links
    .replace(/#+/g, "")      // # headings
    .replace(/>/g, "")       // > blockquote
    .trim();
}

function parseSshTarget(value: string): { host: string; username?: string; port?: number } {
  let raw = stripMarkdown(value).trim();
  if (!raw) return { host: "" };

  raw = raw.replace(/^ssh:\/\//i, "");
  raw = raw.replace(/^ssh\s+/i, "").trim();

  const portFlagMatch = raw.match(/(?:^|\s)-p\s+(\d+)(?:\s|$)/i);
  const portFromFlag = portFlagMatch ? parseInt(portFlagMatch[1], 10) : undefined;
  if (portFlagMatch) {
    raw = raw.replace(portFlagMatch[0], " ").trim();
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  let target = tokens[tokens.length - 1] || raw;
  target = target.replace(/^[`'"]+|[`'"]+$/g, "");
  target = target.replace(/^https?:\/\//i, "").replace(/\/+$/, "");

  let username: string | undefined;
  let hostPort = target;

  const atIndex = target.lastIndexOf("@");
  if (atIndex > 0) {
    username = target.slice(0, atIndex).trim() || undefined;
    hostPort = target.slice(atIndex + 1).trim();
  }

  let host = hostPort;
  let port = portFromFlag;

  const bracketMatch = hostPort.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (bracketMatch) {
    host = bracketMatch[1];
    if (!port && bracketMatch[2]) port = parseInt(bracketMatch[2], 10);
    return { host, username, port };
  }

  const colonCount = (hostPort.match(/:/g) || []).length;
  if (colonCount === 1) {
    const [maybeHost, maybePort] = hostPort.split(":");
    if (/^\d+$/.test(maybePort || "")) {
      host = maybeHost;
      if (!port) port = parseInt(maybePort, 10);
    }
  }

  return { host, username, port };
}

function normalizeHost(value: string): string {
  return parseSshTarget(value).host;
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

function normalizeProjectRef(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function resolveProjectId(userId: string, projectRef: string): Promise<string | null> {
  const trimmed = String(projectRef || "").trim();
  if (!trimmed) return null;

  const rows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.userId, userId));

  const direct = rows.find((row) => row.id === trimmed);
  if (direct) return direct.id;

  const normalizedRef = normalizeProjectRef(trimmed);
  const byName = rows.find((row) => normalizeProjectRef(row.name) === normalizedRef);
  return byName?.id || null;
}

const router = Router();

// POST /api/machines/test-ssh — dijagnostički test SSH konekcije, bez DB inserta
router.post("/test-ssh", requireAuth, async (req, res) => {
  const body: any = req.body || {};

  // --- 1. Loguj šta je primljeno (raw, pre bilo kakvog parsiranja) ---
  const hostRaw: string = String(body.host ?? "");
  const portRaw: string = String(body.port ?? "22");
  const usernameRaw: string = String(body.username ?? "");
  const authTypeRaw: string = String(body.authType ?? "password");
  const hasPassword: boolean = !!(body.password && String(body.password).trim());
  const hasKey: boolean = !!(body.privateKey && String(body.privateKey).trim());

  // --- 2. Parsiraj i sanitizuj ---
  const parsed = parseSshTarget(hostRaw);
  const host = parsed.host;
  const username = (usernameRaw.trim() || parsed.username || "").trim();
  const port = Number.isFinite(Number(portRaw)) ? Number(portRaw) : (parsed.port ?? 22);
  const authType = authTypeRaw === "key" ? "key" : "password";

  const diagnostic = {
    received: {
      hostRaw,
      portRaw,
      usernameRaw,
      authType: authTypeRaw,
      hasPassword,
      hasKey,
    },
    parsed: {
      host,
      port,
      username,
      authType,
    },
    sshResult: "not_attempted" as string,
    sshDetail: "" as string,
    sshError: "" as string,
  };

  // --- 3. Pokušaj SSH konekciju ---
  if (!host || !username) {
    diagnostic.sshResult = "skipped";
    diagnostic.sshDetail = `Nedostaje ${!host ? "host" : "username"}`;
    res.json(diagnostic);
    return;
  }

  let ssh: Awaited<ReturnType<typeof connectSSH>> | null = null;
  try {
    const password = authType === "password" && body.password
      ? String(body.password)
      : undefined;
    const privateKey = authType === "key" && body.privateKey
      ? String(body.privateKey)
      : undefined;

    ssh = await connectSSH({ host, port, username, password, privateKey });

    // Uspješno spojen — provjeri OS
    const { stdout: osOut } = await ssh.exec("uname -a 2>/dev/null || echo unknown");
    diagnostic.sshResult = "success";
    diagnostic.sshDetail = osOut.trim().slice(0, 200);
  } catch (err) {
    diagnostic.sshResult = "failed";
    diagnostic.sshError = err instanceof Error ? err.message : String(err);
  } finally {
    try { ssh?.close(); } catch {}
  }

  res.json(diagnostic);
});

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
    const body: any = req.body || {};
    const projectIdRaw = body.projectId ?? body.project_id;
    // Direktan trim po polju — bez parsiranja SSH stringa
    const name = stripMarkdown(String(body.name ?? ""));
    const normalizedHost = stripMarkdown(String(body.host ?? ""));
    const normalizedUsername = stripMarkdown(String(body.username ?? ""));
    const authTypeRaw = (body.authType ?? body.auth_type ?? "password");
    const resolvedAuthType = (authTypeRaw === "key" ? "key" : "password");
    const resolvedPort = Number.isFinite(Number(body.port)) ? Number(body.port) : 22;
    const passwordRaw = body.password ? String(body.password).trim() : null;
    const privateKeyRaw = (body.privateKey ?? body.private_key)
      ? String(body.privateKey ?? body.private_key).trim()
      : null;

    if (!projectIdRaw || !name || !normalizedHost || !normalizedUsername) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const projectId = await resolveProjectId(userId, String(projectIdRaw));

    if (!projectId) {
      res.status(400).json({ error: `Unknown project: ${String(projectIdRaw)}` });
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

    if (resolvedAuthType === "password" && (!passwordRaw || !String(passwordRaw).trim())) {
      res.status(400).json({ error: "Password authentication requires a password." });
      return;
    }

    if (resolvedAuthType === "key" && (!privateKeyRaw || !String(privateKeyRaw).trim())) {
      res.status(400).json({ error: "SSH key authentication requires a private key." });
      return;
    }

    // Encrypt passwords/keys if needed; if already encrypted (3-part format), keep as-is
    const encryptedPassword = resolvedAuthType === "password" && passwordRaw
      ? (isEncrypted(passwordRaw) ? passwordRaw : encrypt(passwordRaw))
      : null;
    const encryptedPrivateKey = resolvedAuthType === "key" && privateKeyRaw
      ? (isEncrypted(privateKeyRaw) ? privateKeyRaw : encrypt(privateKeyRaw))
      : null;

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
        opencodePort: 4096,
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

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (event: ProvisionEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  let ssh: Awaited<ReturnType<typeof connectSSH>> | null = null;

  const finish = () => {
    res.write("data: [DONE]\n\n");
    res.end();
  };

  const failProvision = async (message: string) => {
    sendEvent({ status: "error", message });
    try {
      await db
        .update(machines)
        .set({
          status: "error",
          opencodeRunning: false,
          lastError: message,
        })
        .where(eq(machines.id, id));
    } catch {}
    finish();
  };

  try {
    const result = await db
      .select()
      .from(machines)
      .where(and(eq(machines.id, id), eq(machines.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      await failProvision("Machine not found");
      return;
    }

    const machine = result[0];
    const password = machine.password
      ? (isEncrypted(machine.password) ? decrypt(machine.password) : machine.password)
      : undefined;
    const privateKey = machine.privateKey
      ? (isEncrypted(machine.privateKey) ? decrypt(machine.privateKey) : machine.privateKey)
      : undefined;

    await db
      .update(machines)
      .set({ status: "connecting", opencodeRunning: false, lastError: null })
      .where(eq(machines.id, id));

    sendEvent({ status: "connecting", message: "Spajanje na VPS..." });

    ssh = await connectSSH({
      host: machine.host,
      port: machine.port,
      username: machine.username,
      password,
      privateKey,
    });

    await db
      .update(machines)
      .set({ status: "provisioning", lastError: null })
      .where(eq(machines.id, id));

    sendEvent({ status: "checking-os", message: "Detekcija operativnog sustava..." });
    const os = await detectOS(ssh);
    sendEvent({ status: "checking-os", message: `Detektovan OS: ${os}` });

    sendEvent({ status: "checking-node", message: "Provjera Node.js..." });
    let nodeVersion = await getNodeVersion(ssh);

    if (nodeVersion) {
      sendEvent({ status: "checking-node", message: `Node.js pronađen: ${nodeVersion}` });
    } else {
      sendEvent({ status: "checking-node", message: "Node.js nije pronađen. Instalacija..." });
      await installNode(ssh, os);
      nodeVersion = await getNodeVersion(ssh);
      if (!nodeVersion) {
        throw new Error("Node.js je instaliran, ali shell ga i dalje ne vidi");
      }
      sendEvent({ status: "checking-node", message: `Node.js uspješno instaliran: ${nodeVersion}` });
    }

    await db
      .update(machines)
      .set({ nodeInstalled: true, lastError: null })
      .where(eq(machines.id, id));

    sendEvent({ status: "starting-opencode", message: "Pokretanje opencode servera..." });
    await installOpenCode(ssh);

    const requestedPort = machine.opencodePort && machine.opencodePort > 0 ? machine.opencodePort : 4096;
    await startOpenCodeServe(ssh, requestedPort);

    const actualPort = await getOpenCodePort(ssh);
    const resolvedPort = actualPort || requestedPort;

    await db
      .update(machines)
      .set({
        status: "ready",
        nodeInstalled: true,
        opencodeRunning: true,
        opencodePort: resolvedPort,
        lastError: null,
      })
      .where(eq(machines.id, id));

    sendEvent({ status: "ready", message: `Spremno! OpenCode server radi na portu ${resolvedPort}.` });
    finish();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await failProvision(message.startsWith("Greška") ? message : `Greška: ${message}`);
  } finally {
    try {
      ssh?.close();
    } catch {}
  }
});

// POST /api/machines/:id/install-coolify — install Coolify on the VPS via SSH
router.post("/:id/install-coolify", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const id = req.params.id as string;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (event: CoolifyInstallEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
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
    const password = machine.password
      ? (isEncrypted(machine.password) ? decrypt(machine.password) : machine.password)
      : undefined;
    const privateKey = machine.privateKey
      ? (isEncrypted(machine.privateKey) ? decrypt(machine.privateKey) : machine.privateKey)
      : undefined;

    sendEvent({ status: "connecting", message: "Spajanje na VPS za Coolify instalaciju..." });
    const ssh = await connectSSH({
      host: machine.host,
      port: machine.port,
      username: machine.username,
      password,
      privateKey,
    });

    try {
      sendEvent({ status: "checking-os", message: "Detekcija operativnog sistema..." });
      const os = await detectOS(ssh);
      sendEvent({ status: "checking-os", message: `OS: ${os}` });

      sendEvent({ status: "checking-docker", message: "Provjera Docker-a..." });
      const dockerPresent = await hasDocker(ssh);
      if (!dockerPresent) {
        sendEvent({ status: "installing-docker", message: "Docker nije pronađen. Instalacija..." });
        await installDocker(ssh, os);
        sendEvent({ status: "installing-docker", message: "Docker uspješno instaliran" });
      } else {
        sendEvent({ status: "checking-docker", message: "Docker je već dostupan" });
      }

      sendEvent({ status: "checking-coolify", message: "Provjera Coolify-a..." });
      const coolifyPresent = await isCoolifyInstalled(ssh);
      if (!coolifyPresent) {
        sendEvent({ status: "installing-coolify", message: "Coolify nije pronađen. Instalacija..." });
        await installCoolify(ssh);
        sendEvent({ status: "installing-coolify", message: "Coolify instalacija završena" });
      } else {
        sendEvent({ status: "checking-coolify", message: "Coolify je već instaliran" });
      }

      const urlHint = await getCoolifyUrlHint(ssh);

      const configPayload = {
        base_url: urlHint || "",
        server_host: machine.host,
        project_name: "straxor",
        default_domain: "",
      };

      const existingCoolify = await db
        .select()
        .from(infraConfigs)
        .where(and(eq(infraConfigs.userId, userId), eq(infraConfigs.adapter, "coolify"), eq(infraConfigs.machineId, machine.id)))
        .orderBy(desc(infraConfigs.updatedAt))
        .limit(1);

      if (existingCoolify[0]) {
        await db
          .update(infraConfigs)
          .set({
            projectId: machine.projectId,
            name: `${machine.name} Coolify`,
            type: "proxy",
            status: "pending",
            config: JSON.stringify(configPayload),
            updatedAt: new Date(),
            lastError: null,
          })
          .where(eq(infraConfigs.id, existingCoolify[0].id));
      } else {
        await db.insert(infraConfigs).values({
          userId,
          projectId: machine.projectId,
          machineId: machine.id,
          type: "proxy",
          adapter: "coolify",
          name: `${machine.name} Coolify`,
          status: "pending",
          config: JSON.stringify(configPayload),
          credentials: JSON.stringify({ api_token: "" }),
        });
      }

      sendEvent({
        status: "ready",
        message: urlHint
          ? `Coolify je spreman. Otvori ${urlHint}, dovrši inicijalni setup i dodaj API token u sačuvani Coolify config.`
          : "Coolify je spreman. Dovrši inicijalni setup kroz web interfejs na VPS-u i dodaj API token u sačuvani Coolify config.",
      });
    } finally {
      ssh.close();
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    sendEvent({ status: "error", message: `Greška: ${message}` });
    await db
      .update(machines)
      .set({ lastError: message, updatedAt: new Date() })
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
