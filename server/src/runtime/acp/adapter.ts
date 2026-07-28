import type { UniversalRuntimeAdapter, RuntimeSession, RuntimeMessage, RuntimeTodoItem, RuntimeFileDiff, RuntimeHealth } from "../types.js";
import type { ACPAgentId } from "./types.js";
import { ACP_AGENT_META, ACP_LEGACY_RUNTIME } from "./types.js";
import type { RuntimeId } from "../types.js";
import type { ACPDriver } from "./drivers/driver.js";
import { OpenCodeDriver } from "./drivers/opencode-driver.js";
import { ClaudeCodeDriver, CodexDriver, GeminiCLIDriver, ClineDriver, GooseDriver, QwenCodeDriver } from "./drivers/agent-drivers.js";
import { ACPRuntimeDriver } from "./drivers/acp-driver.js";

const DRIVER_MAP: Record<string, ACPDriver> = {
  acp: new ACPRuntimeDriver(),
  opencode: new OpenCodeDriver(),
  "claude-code": new ClaudeCodeDriver(),
  codex: new CodexDriver(),
  "gemini-cli": new GeminiCLIDriver(),
  cline: new ClineDriver(),
  goose: new GooseDriver(),
  "qwen-code": new QwenCodeDriver(),
};

export function createACPAdapter(agentId: ACPAgentId): UniversalRuntimeAdapter {
  const meta = ACP_AGENT_META[agentId];
  const driver = DRIVER_MAP[agentId];
  const sessions = new Map<string, { title: string; messages: RuntimeMessage[] }>();

  const adapter: UniversalRuntimeAdapter = {
    id: agentId as unknown as RuntimeId,
    name: meta.name,

    async install(machineId: string) {
      await driver.install(machineId, (mid, cmd) => adapter.executeCommand(mid, cmd));
    },

    async isInstalled(machineId: string): Promise<boolean> {
      return driver.isInstalled(machineId, (mid, cmd) => adapter.executeCommand(mid, cmd));
    },

    async createSession(_machineId: string, title: string): Promise<RuntimeSession> {
      const sid = `acp-${agentId}-${Date.now()}`;
      sessions.set(sid, { title, messages: [] });
      return { id: sid, title, createdAt: new Date().toISOString(), runtimeId: agentId as unknown as RuntimeId };
    },

    async resumeSession(_machineId: string, sessionId: string): Promise<RuntimeSession> {
      const s = sessions.get(sessionId);
      if (!s) throw new Error(`ACP session not found: ${sessionId}`);
      return { id: sessionId, title: s.title, createdAt: new Date().toISOString(), runtimeId: agentId as unknown as RuntimeId };
    },

    async listSessions(_machineId: string): Promise<RuntimeSession[]> {
      return Array.from(sessions.entries()).map(([sid, s]) => ({
        id: sid, title: s.title, createdAt: new Date().toISOString(), runtimeId: agentId as unknown as RuntimeId,
      }));
    },

    async deleteSession(_machineId: string, sessionId: string): Promise<void> {
      sessions.delete(sessionId);
    },

    async sendMessage(
      machineId: string,
      sessionId: string,
      text: string,
      opts?: { mode?: "sync" | "async"; systemPrompt?: string }
    ): Promise<{ parts?: unknown[] }> {
      const legacy = ACP_LEGACY_RUNTIME[agentId];
      if (legacy) {
        const { getRuntimeManager } = await import("../manager.js");
        const mgr = getRuntimeManager();
        const runtime = mgr.getAdapter(legacy);
        if (runtime) {
          return runtime.sendMessage(machineId, sessionId, text, opts);
        }
      }

      const session = sessions.get(sessionId);
      if (!session) throw new Error(`ACP session not found: ${sessionId}`);

      const userMsg: RuntimeMessage = { id: `msg-${Date.now()}`, role: "user", content: text, timestamp: new Date().toISOString() };
      session.messages.push(userMsg);

      let resultText = "";
      try {
        const output = await driver.executeTask(
          machineId, text, { sessionId, model: opts?.systemPrompt },
          (mid, cmd) => adapter.executeCommand(mid, cmd)
        );
        resultText = driver.parseOutput(output).result;
      } catch (err: any) {
        resultText = `Error: ${err.message}`;
      }

      const assistantMsg: RuntimeMessage = { id: `msg-${Date.now()}-resp`, role: "assistant", content: resultText, timestamp: new Date().toISOString() };
      session.messages.push(assistantMsg);
      return { parts: [{ type: "text", text: resultText }] };
    },

    openEventStream(_machineId: string): Promise<any> {
      throw new Error("SSE not supported for ACP agent");
    },

    async getTodos(_machineId: string, _sessionId: string): Promise<RuntimeTodoItem[]> { return []; },
    async getDiff(_machineId: string, _sessionId: string): Promise<RuntimeFileDiff[]> { return []; },
    async abortSession(_machineId: string, _sessionId: string): Promise<boolean> { return true; },

    async healthCheck(machineId: string): Promise<RuntimeHealth> {
      try {
        const status = await driver.getStatus(machineId, (mid, cmd) => adapter.executeCommand(mid, cmd));
        return {
          status: status.installed ? "healthy" : "degraded",
          running: status.running,
          sshConnected: true,
          port: status.port ?? null,
          version: status.version,
        };
      } catch {
        return { status: "down", running: false, sshConnected: false, port: null };
      }
    },

    async restart(machineId: string): Promise<RuntimeHealth> {
      try {
        await adapter.install(machineId);
        return { status: "healthy", running: true, sshConnected: true, port: null };
      } catch {
        return { status: "down", running: false, sshConnected: false, port: null };
      }
    },

    async reconnect(machineId: string): Promise<RuntimeHealth> {
      return adapter.healthCheck(machineId);
    },

    async updateRuntime(machineId: string, _channel: string, _version?: string): Promise<RuntimeHealth> {
      try {
        const npmCmd = agentId === "qwen-code" ? "pip install --upgrade qwen-code" : `npm update -g ${meta.installCmd.replace("npm install -g ", "")}`;
        await adapter.executeCommand(machineId, npmCmd);
        return await adapter.restart(machineId);
      } catch {
        return { status: "down", running: false, sshConnected: false, port: null };
      }
    },

    async executeCommand(machineId: string, command: string): Promise<string> {
      const { getRuntimeManager } = await import("../manager.js");
      const mgr = getRuntimeManager();
      const codeRuntime = mgr.getAdapter("opencode" as RuntimeId);
      if (!codeRuntime) throw new Error("SSH not available — OpenCode runtime required");
      return codeRuntime.executeCommand(machineId, command);
    },
  };

  return adapter;
}
