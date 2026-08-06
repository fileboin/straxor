import type { Duplex } from "stream";
import { Readable } from "stream";
import { execFile } from "child_process";
import { promisify } from "util";
import { db } from "../../db/index.js";
import { machines, repoConnections } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { connectSSH } from "../../runtime/opencode-adapter/ssh.js";
import { decrypt, isEncrypted } from "../../lib/crypto.js";
import type { SSHClient } from "../../runtime/opencode-adapter/ssh.js";
import {
  checkOpenCodeRunning,
  getOpenCodePort,
  getOpenCodeVersion,
  getOpenCodePid,
  getOpenCodeUptime,
  startOpenCodeServe,
  updateOpenCode,
} from "../../runtime/opencode-adapter/provisioner.js";
import {
  ensureLocalEngine,
  engineFromMachineId,
  slotFromMachineId,
  isLocalMachineId,
  getLocalEngineLog,
  resolveBin,
  stopLocalEngine,
} from "../../runtime/local/engine.js";
import { getRepoWorkspaceDir } from "../../runtime/local/workspace.js";
import { normalizeSlot } from "../../runtime/local/shared-workspace.js";
import type { RuntimeAdapter, TodoItem, FileDiff, RuntimeHealth, RuntimeChannel, EngineAttachment } from "./adapter.js";

const execFileP = promisify(execFile);

interface MachineRow {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string | null;
  privateKey: string | null;
  status: string;
  opencodeRunning: boolean | null;
  opencodePort: number | null;
}

async function getMachine(machineId: string, userId: string): Promise<MachineRow> {
  const result = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, machineId), eq(machines.userId, userId)))
    .limit(1);

  if (result.length === 0) throw new Error("Machine not found");
  const m = result[0];
  if (m.status !== "ready" || !m.opencodeRunning) throw new Error("Opencode not running");
  return m as unknown as MachineRow;
}

async function getMachineRaw(machineId: string, userId: string): Promise<MachineRow> {
  const result = await db
    .select()
    .from(machines)
    .where(and(eq(machines.id, machineId), eq(machines.userId, userId)))
    .limit(1);

  if (result.length === 0) throw new Error("Machine not found");
  return result[0] as unknown as MachineRow;
}

function decryptCreds(machine: MachineRow) {
  return {
    password: machine.password
      ? isEncrypted(machine.password) ? decrypt(machine.password) : machine.password
      : undefined,
    privateKey: machine.privateKey
      ? isEncrypted(machine.privateKey) ? decrypt(machine.privateKey) : machine.privateKey
      : undefined,
  };
}

async function withSSH<T>(
  machineId: string,
  userId: string,
  fn: (ssh: SSHClient, port: number) => Promise<T>
): Promise<T> {
  const machine = await getMachine(machineId, userId);
  const creds = decryptCreds(machine);
  const ssh = await connectSSH({
    host: machine.host,
    port: machine.port,
    username: machine.username,
    ...creds,
  });
  try {
    return await fn(ssh, machine.opencodePort || 4096);
  } finally {
    try { ssh.close(); } catch {}
  }
}

async function withSSHRaw<T>(
  machineId: string,
  userId: string,
  fn: (ssh: SSHClient) => Promise<T>
): Promise<T> {
  const machine = await getMachineRaw(machineId, userId);
  const creds = decryptCreds(machine);
  const ssh = await connectSSH({
    host: machine.host,
    port: machine.port,
    username: machine.username,
    ...creds,
  });
  try {
    return await fn(ssh);
  } finally {
    try { ssh.close(); } catch {}
  }
}

async function curlExec(
  ssh: SSHClient,
  port: number,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: string }> {
  const bodyFlag = body ? ` -d '${JSON.stringify(body).replace(/'/g, "'\\''")}'` : "";
  const { stdout } = await ssh.exec(
    `curl -s -w '\\n%{http_code}' -X ${method}` +
    ` -H 'Content-Type: application/json'${bodyFlag}` +
    ` http://127.0.0.1:${port}${path}`
  );
  const lines = stdout.trim().split("\n");
  const httpCode = parseInt(lines.pop() || "0", 10);
  const data = lines.join("\n");
  return { status: httpCode, data };
}

// ── Local (Localhost) transport ──
// Reaches an engine spawned inside the user's local workspace sandbox.
// machineId format: "local:<engine>".

async function localHttp(
  port: number,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: string }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.text() };
}

async function httpCall(
  port: number,
  ssh: SSHClient | null,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: string }> {
  if (ssh) return curlExec(ssh, port, method, path, body);
  return localHttp(port, method, path, body);
}

async function withTransport<T>(
  machineId: string,
  userId: string,
  fn: (port: number, ssh: SSHClient | null) => Promise<T>
): Promise<T> {
  if (isLocalMachineId(machineId)) {
    const handle = await ensureLocalEngine(userId, engineFromMachineId(machineId), slotFromMachineId(machineId));
    return fn(handle.port, null);
  }
  return withSSH(machineId, userId, async (ssh, port) => fn(port, ssh));
}

function localEventStream(port: number): Readable {
  const stream = new Readable({ read() {} });
  (async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/event`);
      if (!res.body) {
        stream.destroy(new Error("No event stream body"));
        return;
      }
      const reader = (res.body as any).getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (stream.destroyed) {
          reader.cancel().catch(() => {});
          return;
        }
        stream.push(text);
      }
      stream.push(null);
    } catch (err) {
      if (!stream.destroyed) stream.destroy(err as Error);
    }
  })();
  return stream;
}

// Build the opencode message parts array: a text part plus optional file parts.
// opencode (>=1.18.11) represents attached images as `type: "file"` parts whose
// `url` is an inline data URL (`data:<mime>;base64,<data>`).
function buildMessageParts(text: string, attachments?: EngineAttachment[]): Record<string, unknown>[] {
  const parts: Record<string, unknown>[] = [{ type: "text", text }];
  for (const a of attachments || []) {
    if (!a?.data) continue;
    parts.push({
      type: "file",
      mime: a.mime || "image/jpeg",
      filename: a.filename || "attachment",
      url: `data:${a.mime || "image/jpeg"};base64,${a.data}`,
    });
  }
  return parts;
}

export function createOpenCodeAdapter(): RuntimeAdapter {
  return {
    async createSession(machineId, title) {
      // createSession and sendMessage need the userId from context.
      // We'll pass it via a closure in the route handler.
      throw new Error("createSession requires userId — use bound adapter");
    },

    async sendMessage(machineId, sessionId, text, mode, attachments) {
      throw new Error("sendMessage requires userId — use bound adapter");
    },

    async listSessions(machineId) {
      throw new Error("listSessions requires userId — use bound adapter");
    },

    async getTodos(machineId, sessionId) {
      throw new Error("getTodos requires userId — use bound adapter");
    },

    async getDiff(machineId, sessionId) {
      throw new Error("getDiff requires userId — use bound adapter");
    },

    async openEventStream(machineId) {
      throw new Error("openEventStream requires userId — use bound adapter");
    },

    async abortSession(machineId, sessionId) {
      throw new Error("abortSession requires userId — use bound adapter");
    },

    async healthCheck(machineId) {
      throw new Error("healthCheck requires userId — use bound adapter");
    },

    async restart(machineId) {
      throw new Error("restart requires userId — use bound adapter");
    },

    async reconnect(machineId) {
      throw new Error("reconnect requires userId — use bound adapter");
    },

    async updateRuntime(machineId, channel, version) {
      throw new Error("updateRuntime requires userId — use bound adapter");
    },

    async executeCommand(machineId, command) {
      throw new Error("executeCommand requires userId — use bound adapter");
    },
  };
}

export function createBoundAdapter(userId: string) {
  async function localHealth(engine: string, slot?: string | null) {
    const handle = await ensureLocalEngine(userId, engine, slot);
    const version = await execFileP(resolveBin("opencode"), ["--version"], { shell: true, timeout: 10000, windowsHide: true })
      .then((r) => r.stdout.trim().replace(/^v/, ""))
      .catch(() => "");
    const uptime = Math.round((Date.now() - handle.startedAt) / 1000);
    return {
      running: true,
      sshConnected: false,
      local: true,
      opencodePort: handle.port,
      version: version || undefined,
      pid: handle.process.pid,
      uptime: `${uptime}s`,
      cwd: handle.cwd,
      log: getLocalEngineLog(handle.key).slice(-2000),
    };
  }

  async function localExecCommand(command: string, slot?: string | null): Promise<string> {
    const normalizedSlot = normalizeSlot(slot);
    const repo = await db
      .select()
      .from(repoConnections)
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true), eq(repoConnections.slot, normalizedSlot)))
      .limit(1);
    if (repo.length === 0) throw new Error("No active repo");
    const cwd = getRepoWorkspaceDir(userId, repo[0].owner, repo[0].name);
    const { stdout } = await execFileP(command, {
      cwd,
      shell: true,
      timeout: 30000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  }

  return {
    async createSession(machineId: string, title: string) {
      return withTransport(machineId, userId, async (port, ssh) => {
        const res = await httpCall(port, ssh, "POST", "/session", { title });
        if (res.status !== 200) throw new Error(`Failed to create session: ${res.data}`);
        return JSON.parse(res.data) as { id: string };
      });
    },

    async sendMessage(
      machineId: string,
      sessionId: string,
      text: string,
      mode: "sync" | "async" = "async",
      attachments?: EngineAttachment[]
    ) {
      return withTransport(machineId, userId, async (port, ssh) => {
        const endpoint = mode === "async"
          ? `/session/${sessionId}/prompt_async`
          : `/session/${sessionId}/message`;
        const parts = buildMessageParts(text, attachments);
        if (attachments?.length) {
          console.log(`[agent:debug] machineId=${machineId} sessionId=${sessionId} parts=${parts.length} attachments=${attachments.length}`);
        }
        const res = await httpCall(port, ssh, "POST", endpoint, { parts });
        if (res.status !== 200 && res.status !== 204) {
          throw new Error(`Failed to send message: ${res.data}`);
        }
        if (res.status === 200 && res.data) {
          try {
            return JSON.parse(res.data) as { parts?: unknown[] };
          } catch {
            return {};
          }
        }
        return {};
      });
    },

    async listSessions(machineId: string) {
      return withTransport(machineId, userId, async (port, ssh) => {
        const res = await httpCall(port, ssh, "GET", "/session");
        if (res.status !== 200) throw new Error("Failed to fetch sessions");
        return JSON.parse(res.data) as unknown[];
      });
    },

    async getTodos(machineId: string, sessionId: string) {
      return withTransport(machineId, userId, async (port, ssh) => {
        const res = await httpCall(port, ssh, "GET", `/session/${sessionId}/todo`);
        if (res.status !== 200) throw new Error("Failed to fetch todos");
        return JSON.parse(res.data) as TodoItem[];
      });
    },

    async getDiff(machineId: string, sessionId: string) {
      return withTransport(machineId, userId, async (port, ssh) => {
        const res = await httpCall(port, ssh, "GET", `/session/${sessionId}/diff`);
        if (res.status !== 200) throw new Error("Failed to fetch diff");
        return JSON.parse(res.data) as FileDiff[];
      });
    },

    async openEventStream(machineId: string) {
      if (isLocalMachineId(machineId)) {
        const handle = await ensureLocalEngine(userId, engineFromMachineId(machineId), slotFromMachineId(machineId));
        return localEventStream(handle.port);
      }

      const machine = await getMachine(machineId, userId);
      const creds = decryptCreds(machine);
      const ssh = await connectSSH({
        host: machine.host,
        port: machine.port,
        username: machine.username,
        ...creds,
      });

      const port = machine.opencodePort || 4096;
      const stream = await ssh.execStream(`curl -sN http://127.0.0.1:${port}/event`);

      let closed = false;
      const cleanup = () => {
        if (closed) return;
        closed = true;
        try { stream.destroy(); } catch {}
        try { ssh.close(); } catch {}
      };

      // SSH transport errors (half-open TCP, network timeout, DNS failure)
      ssh.client.on("error", cleanup);
      ssh.client.on("close", cleanup);

      // Stream-level close triggers SSH cleanup
      stream.on("close", cleanup);
      stream.on("error", cleanup);

      return stream;
    },

    async abortSession(machineId: string, sessionId: string) {
      return withTransport(machineId, userId, async (port, ssh) => {
        const res = await httpCall(port, ssh, "POST", `/session/${sessionId}/abort`);
        return res.status === 200;
      });
    },

    async healthCheck(machineId: string) {
      if (isLocalMachineId(machineId)) {
        return localHealth(engineFromMachineId(machineId), slotFromMachineId(machineId)) as unknown as RuntimeHealth;
      }
      return withSSHRaw(machineId, userId, async (ssh) => {
        const running = await checkOpenCodeRunning(ssh);
        const port = running ? await getOpenCodePort(ssh) : null;
        const version = running ? await getOpenCodeVersion(ssh) : null;
        const pid = running ? await getOpenCodePid(ssh) : null;
        const uptime = running ? await getOpenCodeUptime(ssh) : undefined;

        return {
          running,
          sshConnected: true,
          opencodePort: port,
          version: version || undefined,
          pid: pid || undefined,
          uptime: uptime || undefined,
        };
      });
    },

    async restart(machineId: string) {
      if (isLocalMachineId(machineId)) {
        await stopLocalEngine(userId, engineFromMachineId(machineId), slotFromMachineId(machineId));
        return localHealth(engineFromMachineId(machineId), slotFromMachineId(machineId)) as unknown as RuntimeHealth;
      }
      return withSSHRaw(machineId, userId, async (ssh) => {
        // Stop existing
        await ssh.exec("pkill -f 'opencode serve' 2>/dev/null || true");
        await new Promise((r) => setTimeout(r, 1000));

        // Find port and restart
        const port = (await getOpenCodePort(ssh)) || 4096;
        await startOpenCodeServe(ssh, port);

        const running = await checkOpenCodeRunning(ssh);
        const version = running ? await getOpenCodeVersion(ssh) : null;
        const pid = running ? await getOpenCodePid(ssh) : null;
        const uptime = running ? await getOpenCodeUptime(ssh) : undefined;

        // Update DB status
        const machine = await getMachineRaw(machineId, userId);
        await db
          .update(machines)
          .set({ opencodeRunning: running, opencodePort: port })
          .where(eq(machines.id, machineId));

        return {
          running,
          sshConnected: true,
          opencodePort: port,
          version: version || undefined,
          pid: pid || undefined,
          uptime: uptime || undefined,
        };
      });
    },

    async reconnect(machineId: string) {
      if (isLocalMachineId(machineId)) {
        return localHealth(engineFromMachineId(machineId), slotFromMachineId(machineId)) as unknown as RuntimeHealth;
      }
      return withSSHRaw(machineId, userId, async (ssh) => {
        const running = await checkOpenCodeRunning(ssh);
        let port: number | null = null;

        if (running) {
          port = await getOpenCodePort(ssh);
        }

        // Update DB
        await db
          .update(machines)
          .set({
            status: running ? "ready" : "error",
            opencodeRunning: running,
            opencodePort: port,
            lastError: running ? null : "Reconnect: opencode not running",
          })
          .where(eq(machines.id, machineId));

        const version = running ? await getOpenCodeVersion(ssh) : null;
        const pid = running ? await getOpenCodePid(ssh) : null;
        const uptime = running ? await getOpenCodeUptime(ssh) : undefined;

        return {
          running,
          sshConnected: true,
          opencodePort: port,
          version: version || undefined,
          pid: pid || undefined,
          uptime: uptime || undefined,
        };
      });
    },

    async updateRuntime(machineId: string, channel: RuntimeChannel, version?: string) {
      if (isLocalMachineId(machineId)) {
        // Local engine: no remote install — report current health only.
        return localHealth(engineFromMachineId(machineId), slotFromMachineId(machineId)) as unknown as RuntimeHealth;
      }
      return withSSHRaw(machineId, userId, async (ssh) => {
        // Update the package
        await updateOpenCode(ssh, channel, version);

        // Restart the serve process
        await ssh.exec("pkill -f 'opencode serve' 2>/dev/null || true");
        await new Promise((r) => setTimeout(r, 1000));

        const port = (await getOpenCodePort(ssh)) || 4096;
        await startOpenCodeServe(ssh, port);

        const running = await checkOpenCodeRunning(ssh);
        const newVersion = running ? await getOpenCodeVersion(ssh) : null;
        const pid = running ? await getOpenCodePid(ssh) : null;
        const uptime = running ? await getOpenCodeUptime(ssh) : undefined;

        // Update DB
        await db
          .update(machines)
          .set({ opencodeRunning: running, opencodePort: port })
          .where(eq(machines.id, machineId));

        return {
          running,
          sshConnected: true,
          opencodePort: port,
          version: newVersion || undefined,
          channel,
          pid: pid || undefined,
          uptime: uptime || undefined,
        };
      });
    },

    async getSshConnection(machineId: string) {
      const machine = await getMachine(machineId, userId);
      const creds = decryptCreds(machine);
      const ssh = await connectSSH({
        host: machine.host,
        port: machine.port,
        username: machine.username,
        ...creds,
      });
      return { ssh, port: machine.opencodePort || 4096 };
    },

    async executeCommand(machineId: string, command: string) {
      if (isLocalMachineId(machineId)) {
        return localExecCommand(command, slotFromMachineId(machineId));
      }
      return withSSHRaw(machineId, userId, async (ssh) => {
        const { stdout } = await ssh.exec(command);
        return stdout;
      });
    },
  };
}

export type BoundAdapter = ReturnType<typeof createBoundAdapter>;
