import type { Duplex } from "stream";
import { db } from "../../db/index.js";
import { machines } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { connectSSH } from "../../runtime/opencode-adapter/ssh.js";
import { decrypt, isEncrypted } from "../../lib/crypto.js";
import type { SSHClient } from "../../runtime/opencode-adapter/ssh.js";
import type { RuntimeAdapter, TodoItem, FileDiff } from "./adapter.js";

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

export function createOpenCodeAdapter(): RuntimeAdapter {
  return {
    async createSession(machineId, title) {
      // createSession and sendMessage need the userId from context.
      // We'll pass it via a closure in the route handler.
      throw new Error("createSession requires userId — use bound adapter");
    },

    async sendMessage(machineId, sessionId, text, mode) {
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
  };
}

export function createBoundAdapter(userId: string) {
  return {
    async createSession(machineId: string, title: string) {
      return withSSH(machineId, userId, async (ssh, port) => {
        const res = await curlExec(ssh, port, "POST", "/session", { title });
        if (res.status !== 200) throw new Error(`Failed to create session: ${res.data}`);
        return JSON.parse(res.data) as { id: string };
      });
    },

    async sendMessage(machineId: string, sessionId: string, text: string, mode: "sync" | "async" = "async") {
      return withSSH(machineId, userId, async (ssh, port) => {
        const endpoint = mode === "async"
          ? `/session/${sessionId}/prompt_async`
          : `/session/${sessionId}/message`;
        const res = await curlExec(ssh, port, "POST", endpoint, {
          parts: [{ type: "text", text }],
        });
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
      return withSSH(machineId, userId, async (ssh, port) => {
        const res = await curlExec(ssh, port, "GET", "/session");
        if (res.status !== 200) throw new Error("Failed to fetch sessions");
        return JSON.parse(res.data) as unknown[];
      });
    },

    async getTodos(machineId: string, sessionId: string) {
      return withSSH(machineId, userId, async (ssh, port) => {
        const res = await curlExec(ssh, port, "GET", `/session/${sessionId}/todo`);
        if (res.status !== 200) throw new Error("Failed to fetch todos");
        return JSON.parse(res.data) as TodoItem[];
      });
    },

    async getDiff(machineId: string, sessionId: string) {
      return withSSH(machineId, userId, async (ssh, port) => {
        const res = await curlExec(ssh, port, "GET", `/session/${sessionId}/diff`);
        if (res.status !== 200) throw new Error("Failed to fetch diff");
        return JSON.parse(res.data) as FileDiff[];
      });
    },

    async openEventStream(machineId: string) {
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

      // Attach cleanup to stream close
      stream.on("close", () => {
        try { ssh.close(); } catch {}
      });

      return stream;
    },

    async abortSession(machineId: string, sessionId: string) {
      return withSSH(machineId, userId, async (ssh, port) => {
        const res = await curlExec(ssh, port, "POST", `/session/${sessionId}/abort`);
        return res.status === 200;
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
  };
}

export type BoundAdapter = ReturnType<typeof createBoundAdapter>;
