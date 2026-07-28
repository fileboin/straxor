// ── Free Claude Code Runtime Adapter ──
// Implements the Universal RuntimeAdapter interface for Free Claude Code.
// FCC is a Python-based proxy that routes Claude Code, Codex, or Pi
// through user-provided AI providers.
// Communicates via SSH to the remote VPS.

import type { Duplex } from "stream";
import { db } from "../../db/index.js";
import { machines } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { connectSSH, type SSHClient } from "../opencode-adapter/ssh.js";
import { decrypt, isEncrypted } from "../../lib/crypto.js";
import type {
  UniversalRuntimeAdapter, RuntimeId, RuntimeSession,
  RuntimeTodoItem, RuntimeFileDiff, RuntimeHealth, RuntimeChannel,
  ProviderConfig, MCPServerConfig,
} from "../types.js";
import { FCC_DEFAULT_PORT, FCC_DEFAULT_DIR, type FCCConfig } from "./config.js";
import { installFCC, checkFCCInstalled, uninstallFCC, type InstallOptions } from "./installer.js";
import { captureFCCLogs } from "./logs.js";
import {
  startServer, stopServer, getServerStatus, executeTask,
} from "./runner.js";

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

function buildSSHConfig(machine: MachineRow) {
  const creds = decryptCreds(machine);
  return {
    host: machine.host,
    port: machine.port,
    username: machine.username,
    ...creds,
  };
}

async function withSSH<T>(
  machineId: string,
  fn: (ssh: SSHClient) => Promise<T>
): Promise<T> {
  const machine = await getMachine(machineId);
  const config = buildSSHConfig(machine);
  const ssh = await connectSSH(config);
  try {
    return await fn(ssh);
  } finally {
    try { ssh.close(); } catch {}
  }
}

// ── Curl helper for FCC HTTP API ──

async function fccCurl(
  ssh: SSHClient,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: string }> {
  const bodyFlag = body ? ` -d '${JSON.stringify(body).replace(/'/g, "'\\''")}'` : "";
  const { stdout } = await ssh.exec(
    `curl -s -w '\\n%{http_code}' -X ${method}` +
    ` -H 'Content-Type: application/json'${bodyFlag}` +
    ` http://127.0.0.1:${FCC_DEFAULT_PORT}${path}`
  );
  const lines = stdout.trim().split("\n");
  const httpCode = parseInt(lines.pop() || "0", 10);
  const data = lines.join("\n");
  return { status: httpCode, data };
}

// ── Adapter Factory ──

export function createFreeClaudeCodeAdapter(): UniversalRuntimeAdapter {
  // FCC doesn't have a native session API like OpenCode.
  // We manage sessions locally by tracking project dirs.
  const sessionMap = new Map<string, { projectDir: string; title: string }>();

  return {
    id: "free-claude-code" as RuntimeId,
    name: "Free Claude Code",

    // ── Lifecycle ──

    async install(machineId: string) {
      const machine = await getMachine(machineId);
      const config = buildSSHConfig(machine);
      const result = await installFCC({ sshConfig: config });
      if (!result.success) throw new Error(result.error || "FCC installation failed");
    },

    async isInstalled(machineId: string): Promise<boolean> {
      const machine = await getMachine(machineId);
      const config = buildSSHConfig(machine);
      return checkFCCInstalled(config);
    },

    // ── Session Management ──

    async createSession(machineId: string, title: string): Promise<RuntimeSession> {
      const id = `fcc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const sanitized = title.replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
      const projectDir = `/root/fcc-projects/${sanitized}-${Date.now()}`;

      await withSSH(machineId, async (ssh) => {
        await ssh.exec(`mkdir -p "${projectDir}"`);
        await ssh.exec(`cd "${projectDir}" && git init`);
      });

      sessionMap.set(id, { projectDir, title });
      return { id, title, createdAt: new Date().toISOString(), runtimeId: "free-claude-code" };
    },

    async resumeSession(machineId: string, sessionId: string): Promise<RuntimeSession> {
      const session = sessionMap.get(sessionId);
      if (!session) throw new Error(`FCC session not found: ${sessionId}`);
      return {
        id: sessionId,
        title: session.title,
        createdAt: new Date().toISOString(),
        runtimeId: "free-claude-code",
      };
    },

    async listSessions(machineId: string): Promise<RuntimeSession[]> {
      return Array.from(sessionMap.entries()).map(([id, s]) => ({
        id,
        title: s.title,
        createdAt: new Date().toISOString(),
        runtimeId: "free-claude-code",
      }));
    },

    async deleteSession(machineId: string, sessionId: string): Promise<void> {
      const session = sessionMap.get(sessionId);
      if (session) {
        await withSSH(machineId, async (ssh) => {
          await ssh.exec(`rm -rf "${session.projectDir}" 2>/dev/null; true`);
        });
        sessionMap.delete(sessionId);
      }
    },

    // ── Messaging ──

    async sendMessage(
      machineId: string,
      sessionId: string,
      text: string,
      opts?: { mode?: "sync" | "async"; systemPrompt?: string }
    ): Promise<{ parts?: unknown[] }> {
      const session = sessionMap.get(sessionId);
      if (!session) throw new Error(`FCC session not found: ${sessionId}`);

      return withSSH(machineId, async (ssh) => {
        // Ensure FCC server is running
        const status = await getServerStatus(ssh, FCC_DEFAULT_DIR);
        if (!status.running) {
          await startServer(ssh, FCC_DEFAULT_DIR);
        }

        // Execute the task via fcc-codex exec
        const result = await executeTask(ssh, session.projectDir, text);

        return {
          parts: [
            {
              type: "text",
              text: result.output || result.error || "Task completed",
            },
          ],
          taskResult: result,
        };
      });
    },

    // ── Streaming (SSE) ──
    // FCC doesn't natively support SSE streaming for task execution.
    // Returns a no-op stream for now.

    async openEventStream(machineId: string): Promise<Duplex> {
      const { PassThrough } = await import("stream");
      const stream = new PassThrough();
      stream.end();
      return stream;
    },

    // ── Context / Inspection ──

    async getTodos(machineId: string, sessionId: string): Promise<RuntimeTodoItem[]> {
      const session = sessionMap.get(sessionId);
      if (!session) return [];

      return withSSH(machineId, async (ssh) => {
        // Read the last agent output and parse todo items
        const { stdout } = await ssh.exec(
          `cat /tmp/fcc-agent.log 2>/dev/null | grep -E "^- \\[|^\\d+\\. |TODO:|Step:" | tail -20 || echo ""`
        );
        return stdout
          .split("\n")
          .filter((l) => l.trim())
          .map((line, i) => ({
            id: `fcc-todo-${i}`,
            content: line.replace(/^- \[.?\]\s*/, "").replace(/^\d+\.\s*/, "").replace(/^(TODO:|Step:)\s*/i, "").trim(),
            status: "pending" as const,
          }));
      });
    },

    async getDiff(machineId: string, sessionId: string): Promise<RuntimeFileDiff[]> {
      const session = sessionMap.get(sessionId);
      if (!session) return [];

      return withSSH(machineId, async (ssh) => {
        const { stdout } = await ssh.exec(
          `cd "${session.projectDir}" && git diff HEAD --unified=0 2>/dev/null || echo ""`
        );
        if (!stdout.trim()) return [];

        const files: RuntimeFileDiff[] = [];
        let currentFile: RuntimeFileDiff | null = null;

        for (const line of stdout.split("\n")) {
          const fileMatch = line.match(/^diff --git a\/(.+?) b\//);
          if (fileMatch) {
            if (currentFile) files.push(currentFile);
            currentFile = { path: fileMatch[1], additions: [], deletions: [] };
            continue;
          }
          if (line.startsWith("+") && !line.startsWith("+++") && currentFile) {
            currentFile.additions.push(line.slice(1));
          }
          if (line.startsWith("-") && !line.startsWith("---") && currentFile) {
            currentFile.deletions.push(line.slice(1));
          }
        }
        if (currentFile) files.push(currentFile);

        return files;
      });
    },

    // ── Execution Control ──

    async abortSession(machineId: string, sessionId: string): Promise<boolean> {
      await withSSH(machineId, async (ssh) => {
        await ssh.exec(`pkill -f "fcc-codex" 2>/dev/null; pkill -f "fcc-claude" 2>/dev/null; true`);
      });
      return true;
    },

    // ── Provider Management ──
    // FCC providers are configured via its Admin UI / .env file.

    async setProvider(machineId: string, config: ProviderConfig): Promise<void> {
      await withSSH(machineId, async (ssh) => {
        // Write provider config to FCC's .env
        const envContent = `${config.id.toUpperCase()}_API_KEY=${config.apiKey || ""}
MODEL=${config.defaultModel || ""}
`;
        await ssh.exec(`cat > "${FCC_DEFAULT_DIR}/.env" << 'ENVEOF'\n${envContent}\nENVEOF`);

        // Restart FCC server to pick up changes
        await stopServer(ssh, FCC_DEFAULT_DIR);
        await startServer(ssh, FCC_DEFAULT_DIR);
      });
    },

    // ── MCP ──
    // FCC doesn't natively support MCP server configuration.

    async listMCPServers(machineId: string): Promise<MCPServerConfig[]> {
      return [];
    },

    async addMCPServer(machineId: string, config: MCPServerConfig): Promise<void> {
      throw new Error("FCC does not support MCP server configuration");
    },

    async removeMCPServer(machineId: string, serverId: string): Promise<void> {
      throw new Error("FCC does not support MCP server configuration");
    },

    // ── Health & Operations ──

    async healthCheck(machineId: string): Promise<RuntimeHealth> {
      return withSSH(machineId, async (ssh) => {
        const status = await getServerStatus(ssh, FCC_DEFAULT_DIR);

        if (status.running) {
          return {
            status: "healthy",
            running: true,
            sshConnected: true,
            port: FCC_DEFAULT_PORT,
            pid: status.pid,
            version: await getFCCVersion(ssh),
            lastCheck: new Date().toISOString(),
          };
        }

        // Check if FCC is installed but not running
        const installed = await checkFCCInstalled({
          host: (await getMachine(machineId)).host,
          port: (await getMachine(machineId)).port,
          username: "root",
        });
        if (installed) {
          return {
            status: "degraded",
            running: false,
            sshConnected: true,
            port: FCC_DEFAULT_PORT,
            lastCheck: new Date().toISOString(),
          };
        }

        return {
          status: "down",
          running: false,
          sshConnected: false,
          port: null,
          lastCheck: new Date().toISOString(),
        };
      });
    },

    async restart(machineId: string): Promise<RuntimeHealth> {
      await withSSH(machineId, async (ssh) => {
        await stopServer(ssh, FCC_DEFAULT_DIR);
        await startServer(ssh, FCC_DEFAULT_DIR);
      });
      return this.healthCheck(machineId);
    },

    async reconnect(machineId: string): Promise<RuntimeHealth> {
      return this.restart(machineId);
    },

    async updateRuntime(machineId: string, channel: RuntimeChannel, version?: string): Promise<RuntimeHealth> {
      const machine = await getMachine(machineId);
      const config = buildSSHConfig(machine);
      const result = await installFCC({ sshConfig: config });
      if (!result.success) throw new Error(result.error || "FCC update failed");
      return this.healthCheck(machineId);
    },

    // ── Shell ──

    async executeCommand(machineId: string, command: string): Promise<string> {
      return withSSH(machineId, async (ssh) => {
        const { stdout } = await ssh.exec(command);
        return stdout;
      });
    },
  };
}

// ── Helpers ──

async function getFCCVersion(ssh: SSHClient): Promise<string | undefined> {
  try {
    const { stdout } = await ssh.exec(
      `cat "${FCC_DEFAULT_DIR}/pyproject.toml" 2>/dev/null | grep "^version" | head -1 | cut -d'"' -f2 || fcc-server --version 2>/dev/null || echo ""`
    );
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}
