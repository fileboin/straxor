// ── Crush Runtime Adapter ──
// Implements the Universal RuntimeAdapter interface for Crush.
// Crush is a modern AI coding runtime with built-in MCP support.
// Communicates via HTTP API over SSH tunnel.

import type { Duplex } from "stream";
import { db } from "../../db/index.js";
import { machines } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { connectSSH, type SSHClient } from "../../runtime/opencode-adapter/ssh.js";
import { decrypt, isEncrypted } from "../../lib/crypto.js";
import type {
  UniversalRuntimeAdapter, RuntimeId, RuntimeSession,
  RuntimeTodoItem, RuntimeFileDiff, RuntimeHealth, RuntimeChannel,
  ProviderConfig, MCPServerConfig,
} from "../types.js";

// ── Machine Helpers ──

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

async function getMachine(machineId: string): Promise<MachineRow> {
  const result = await db
    .select()
    .from(machines)
    .where(eq(machines.id, machineId))
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
  fn: (ssh: SSHClient, port: number) => Promise<T>
): Promise<T> {
  const machine = await getMachine(machineId);
  const creds = decryptCreds(machine);
  const ssh = await connectSSH({
    host: machine.host,
    port: machine.port,
    username: machine.username,
    ...creds,
  });
  try {
    return await fn(ssh, machine.opencodePort || 4097);
  } finally {
    try { ssh.close(); } catch {}
  }
}

async function withSSHRaw<T>(
  machineId: string,
  fn: (ssh: SSHClient) => Promise<T>
): Promise<T> {
  const machine = await getMachine(machineId);
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

// Crush default port is 4097 (distinct from OpenCode's 4096)
const CRUSH_DEFAULT_PORT = 4097;

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

// ── Crush Adapter ──

export function createCrushAdapter(): UniversalRuntimeAdapter {
  return {
    id: "crush",
    name: "Crush",

    // ── Lifecycle ──

    async install(machineId: string) {
      await withSSHRaw(machineId, async (ssh) => {
        // Check if Crush is already installed
        const { stdout: which } = await ssh.exec("which crush 2>/dev/null || echo ''");
        if (which.trim()) return;

        // Install Crush via npm
        await ssh.exec("npm install -g @anthropic-ai/crush@latest 2>&1 || npx @anthropic-ai/crush@latest --version 2>&1");
      });
    },

    async isInstalled(machineId: string): Promise<boolean> {
      return withSSHRaw(machineId, async (ssh) => {
        const { stdout } = await ssh.exec("which crush 2>/dev/null && crush --version 2>/dev/null || echo ''");
        return stdout.trim().length > 0;
      });
    },

    // ── Session Management ──

    async createSession(machineId, title) {
      return withSSH(machineId, async (ssh, port) => {
        // Crush uses /session endpoint similar to OpenCode
        const res = await curlExec(ssh, port, "POST", "/session", { title });
        if (res.status !== 200) throw new Error(`Crush: Failed to create session: ${res.data}`);
        const data = JSON.parse(res.data);
        return {
          id: data.id || data.sessionId,
          title,
          createdAt: new Date().toISOString(),
          runtimeId: "crush",
        };
      });
    },

    async resumeSession(machineId, sessionId) {
      return withSSH(machineId, async (ssh, port) => {
        const res = await curlExec(ssh, port, "GET", `/session/${sessionId}`);
        if (res.status !== 200) throw new Error(`Crush: Session not found: ${sessionId}`);
        const data = JSON.parse(res.data);
        return {
          id: data.id || sessionId,
          title: data.title || "Resumed session",
          createdAt: data.createdAt || new Date().toISOString(),
          runtimeId: "crush",
          model: data.model,
          provider: data.provider,
        };
      });
    },

    async listSessions(machineId) {
      return withSSH(machineId, async (ssh, port) => {
        const res = await curlExec(ssh, port, "GET", "/session");
        if (res.status !== 200) throw new Error("Crush: Failed to list sessions");
        const data = JSON.parse(res.data);
        const sessions = Array.isArray(data) ? data : data.sessions || [];
        return sessions.map((s: any) => ({
          id: s.id,
          title: s.title || "Untitled",
          createdAt: s.createdAt || s.created_at || new Date().toISOString(),
          runtimeId: "crush" as RuntimeId,
          model: s.model,
          provider: s.provider,
          messageCount: s.messageCount,
        }));
      });
    },

    async deleteSession(machineId, sessionId) {
      await withSSH(machineId, async (ssh, port) => {
        await curlExec(ssh, port, "DELETE", `/session/${sessionId}`);
      });
    },

    // ── Messaging ──

    async sendMessage(machineId, sessionId, text, opts) {
      return withSSH(machineId, async (ssh, port) => {
        const endpoint = opts?.mode === "sync"
          ? `/session/${sessionId}/message`
          : `/session/${sessionId}/prompt_async`;

        const body: Record<string, unknown> = {
          parts: [{ type: "text", text }],
        };
        if (opts?.systemPrompt) {
          body.system = opts.systemPrompt;
        }

        const res = await curlExec(ssh, port, "POST", endpoint, body);
        if (res.status !== 200 && res.status !== 204) {
          throw new Error(`Crush: Failed to send message: ${res.data}`);
        }
        if (res.status === 200 && res.data) {
          try { return JSON.parse(res.data); } catch { return {}; }
        }
        return {};
      });
    },

    // ── Streaming ──

    async openEventStream(machineId) {
      const machine = await getMachine(machineId);
      const creds = decryptCreds(machine);
      const ssh = await connectSSH({
        host: machine.host,
        port: machine.port,
        username: machine.username,
        ...creds,
      });

      const port = machine.opencodePort || CRUSH_DEFAULT_PORT;
      // Crush SSE endpoint
      const stream = await ssh.execStream(`curl -sN http://127.0.0.1:${port}/event`);

      stream.on("close", () => {
        try { ssh.close(); } catch {}
      });

      return stream;
    },

    // ── Context / Inspection ──

    async getTodos(machineId, sessionId) {
      return withSSH(machineId, async (ssh, port) => {
        const res = await curlExec(ssh, port, "GET", `/session/${sessionId}/todo`);
        if (res.status !== 200) return [];
        const data = JSON.parse(res.data);
        const items = Array.isArray(data) ? data : data.todos || [];
        return items.map((t: any) => ({
          id: String(t.id),
          content: t.content || t.text || "",
          status: t.status || "pending",
        }));
      });
    },

    async getDiff(machineId, sessionId) {
      return withSSH(machineId, async (ssh, port) => {
        const res = await curlExec(ssh, port, "GET", `/session/${sessionId}/diff`);
        if (res.status !== 200) return [];
        const data = JSON.parse(res.data);
        const diffs = Array.isArray(data) ? data : data.diffs || [];
        return diffs.map((d: any) => ({
          path: d.path || d.file || "",
          additions: d.additions || d.added || [],
          deletions: d.deletions || d.removed || [],
        }));
      });
    },

    // ── Execution Control ──

    async abortSession(machineId, sessionId) {
      return withSSH(machineId, async (ssh, port) => {
        const res = await curlExec(ssh, port, "POST", `/session/${sessionId}/abort`);
        return res.status === 200;
      });
    },

    async cancelExecution(machineId, sessionId) {
      await this.abortSession(machineId, sessionId);
    },

    // ── Provider Management ──

    async setProvider(machineId, config) {
      await withSSH(machineId, async (ssh, port) => {
        await curlExec(ssh, port, "POST", "/config/provider", {
          provider: config.id,
          model: config.defaultModel,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
        });
      });
    },

    async getActiveProvider(machineId) {
      return withSSH(machineId, async (ssh, port) => {
        const res = await curlExec(ssh, port, "GET", "/config/provider");
        if (res.status !== 200) return null;
        const data = JSON.parse(res.data);
        return {
          id: data.provider || "openai",
          name: data.provider || "OpenAI",
          icon: "◉",
          color: "text-green-400",
          apiKey: data.apiKey,
          baseUrl: data.baseUrl,
          models: data.models || [],
          defaultModel: data.model,
          isEnabled: true,
        };
      });
    },

    // ── MCP ──

    async listMCPServers(machineId) {
      return withSSH(machineId, async (ssh, port) => {
        const res = await curlExec(ssh, port, "GET", "/mcp/servers");
        if (res.status !== 200) return [];
        const data = JSON.parse(res.data);
        const servers = Array.isArray(data) ? data : data.servers || [];
        return servers.map((s: any) => ({
          id: s.id || s.name,
          name: s.name || s.id,
          command: s.command || "",
          args: s.args || [],
          env: s.env || {},
          isEnabled: s.isEnabled !== false,
        }));
      });
    },

    async addMCPServer(machineId, config) {
      await withSSH(machineId, async (ssh, port) => {
        await curlExec(ssh, port, "POST", "/mcp/servers", config);
      });
    },

    async removeMCPServer(machineId, serverId) {
      await withSSH(machineId, async (ssh, port) => {
        await curlExec(ssh, port, "DELETE", `/mcp/servers/${serverId}`);
      });
    },

    // ── Health & Operations ──

    async healthCheck(machineId) {
      return withSSHRaw(machineId, async (ssh) => {
        // Check if Crush process is running
        const { stdout: psOut } = await ssh.exec("pgrep -f 'crush serve\\|crush --serve' 2>/dev/null || echo ''");
        const pid = psOut.trim() ? parseInt(psOut.trim().split("\n")[0], 10) : null;
        const running = !!pid;

        let port: number | null = null;
        let version: string | undefined;
        let uptime: string | undefined;

        if (running) {
          // Find port
          const { stdout: portOut } = await ssh.exec(
            "ss -tlnp 2>/dev/null | grep -oP ':\\K409[0-9]' | head -1 || echo '4097'"
          );
          port = parseInt(portOut.trim() || "4097", 10);

          // Version
          const { stdout: verOut } = await ssh.exec("crush --version 2>/dev/null || echo ''");
          version = verOut.trim() || undefined;

          // Uptime
          if (pid) {
            const { stdout: upOut } = await ssh.exec(`ps -o etime= -p ${pid} 2>/dev/null || echo ''`);
            uptime = upOut.trim() || undefined;
          }
        }

        return {
          status: running ? "healthy" as const : "down" as const,
          running,
          sshConnected: true,
          port,
          version,
          pid: pid || undefined,
          uptime,
          lastCheck: new Date().toISOString(),
        };
      });
    },

    async restart(machineId) {
      return withSSHRaw(machineId, async (ssh) => {
        // Kill existing
        await ssh.exec("pkill -f 'crush serve\\|crush --serve' 2>/dev/null || true");
        await new Promise((r) => setTimeout(r, 1500));

        // Find port or use default
        const { stdout: portOut } = await ssh.exec(
          "ss -tlnp 2>/dev/null | grep -oP ':\\K409[0-9]' | head -1 || echo '4097'"
        );
        const port = parseInt(portOut.trim() || "4097", 10);

        // Start Crush
        await ssh.exec(`nohup crush serve --port ${port} > /tmp/crush.log 2>&1 &`);
        await new Promise((r) => setTimeout(r, 2000));

        // Check
        const { stdout: psOut } = await ssh.exec("pgrep -f 'crush serve\\|crush --serve' 2>/dev/null || echo ''");
        const pid = psOut.trim() ? parseInt(psOut.trim().split("\n")[0], 10) : null;
        const running = !!pid;

        const { stdout: verOut } = await ssh.exec("crush --version 2>/dev/null || echo ''");

        // Update DB
        await db
          .update(machines)
          .set({ opencodeRunning: running, opencodePort: port })
          .where(eq(machines.id, machineId));

        return {
          status: running ? "healthy" as const : "down" as const,
          running,
          sshConnected: true,
          port,
          version: verOut.trim() || undefined,
          pid: pid || undefined,
          lastCheck: new Date().toISOString(),
        };
      });
    },

    async reconnect(machineId) {
      return withSSHRaw(machineId, async (ssh) => {
        const { stdout: psOut } = await ssh.exec("pgrep -f 'crush serve\\|crush --serve' 2>/dev/null || echo ''");
        const pid = psOut.trim() ? parseInt(psOut.trim().split("\n")[0], 10) : null;
        const running = !!pid;

        let port: number | null = null;
        if (running) {
          const { stdout: portOut } = await ssh.exec(
            "ss -tlnp 2>/dev/null | grep -oP ':\\K409[0-9]' | head -1 || echo '4097'"
          );
          port = parseInt(portOut.trim() || "4097", 10);
        }

        await db
          .update(machines)
          .set({
            status: running ? "ready" : "error",
            opencodeRunning: running,
            opencodePort: port,
            lastError: running ? null : "Reconnect: Crush not running",
          })
          .where(eq(machines.id, machineId));

        const { stdout: verOut } = await ssh.exec("crush --version 2>/dev/null || echo ''");

        return {
          status: running ? "healthy" as const : "down" as const,
          running,
          sshConnected: true,
          port,
          version: verOut.trim() || undefined,
          pid: pid || undefined,
          lastCheck: new Date().toISOString(),
        };
      });
    },

    async updateRuntime(machineId, channel, version) {
      return withSSHRaw(machineId, async (ssh) => {
        const tag = channel === "beta" ? "@next" : "@latest";
        const versionSpec = version ? `@${version}` : tag;

        // Update Crush
        await ssh.exec(`npm install -g @anthropic-ai/crush${versionSpec} 2>&1`);

        // Restart
        await ssh.exec("pkill -f 'crush serve\\|crush --serve' 2>/dev/null || true");
        await new Promise((r) => setTimeout(r, 1500));

        const { stdout: portOut } = await ssh.exec(
          "ss -tlnp 2>/dev/null | grep -oP ':\\K409[0-9]' | head -1 || echo '4097'"
        );
        const port = parseInt(portOut.trim() || "4097", 10);
        await ssh.exec(`nohup crush serve --port ${port} > /tmp/crush.log 2>&1 &`);
        await new Promise((r) => setTimeout(r, 2000));

        const { stdout: psOut } = await ssh.exec("pgrep -f 'crush serve\\|crush --serve' 2>/dev/null || echo ''");
        const pid = psOut.trim() ? parseInt(psOut.trim().split("\n")[0], 10) : null;
        const running = !!pid;

        const { stdout: verOut } = await ssh.exec("crush --version 2>/dev/null || echo ''");

        await db
          .update(machines)
          .set({ opencodeRunning: running, opencodePort: port })
          .where(eq(machines.id, machineId));

        return {
          status: running ? "healthy" as const : "down" as const,
          running,
          sshConnected: true,
          port,
          version: verOut.trim() || undefined,
          channel,
          pid: pid || undefined,
          lastCheck: new Date().toISOString(),
        };
      });
    },

    // ── Shell ──

    async executeCommand(machineId, command) {
      return withSSHRaw(machineId, async (ssh) => {
        const { stdout } = await ssh.exec(command);
        return stdout;
      });
    },
  };
}
