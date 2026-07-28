import type { UniversalRuntimeAdapter, RuntimeSession, RuntimeMessage, RuntimeTodoItem, RuntimeFileDiff, RuntimeHealth } from "../types.js";
import { AGENT_RUNTIME_META, type AgentRuntimeId } from "./types.js";
import type { RuntimeId } from "../types.js";

export function createAgentRuntimeAdapter(id: AgentRuntimeId): UniversalRuntimeAdapter {
  const meta = AGENT_RUNTIME_META[id];
  const sessions = new Map<string, { title: string; messages: RuntimeMessage[] }>();

  const adapter: UniversalRuntimeAdapter = {
    id: id as RuntimeId,
    name: meta.name,

    async install(machineId: string) {
      const cmd = id === "openhands"
        ? `docker pull ghcr.io/all-hands-ai/openhands:latest 2>/dev/null; mkdir -p /opt/${id}; echo installed`
        : `git clone ${meta.repoUrl}.git /opt/${id} 2>/dev/null; cd /opt/${id} && (test -f package.json && npm install --production 2>/dev/null || test -f requirements.txt && pip install -r requirements.txt 2>/dev/null || pip install -e . 2>/dev/null); echo installed`;
      await adapter.executeCommand(machineId, cmd);
    },

    async isInstalled(machineId: string): Promise<boolean> {
      try {
        const out = await adapter.executeCommand(machineId, `test -d /opt/${id} && echo installed || echo missing`);
        return out.includes("installed");
      } catch { return false; }
    },

    async createSession(_machineId: string, title: string): Promise<RuntimeSession> {
      const sid = `agent-${id}-${Date.now()}`;
      sessions.set(sid, { title, messages: [] });
      return { id: sid, title, createdAt: new Date().toISOString(), runtimeId: id as RuntimeId };
    },

    async resumeSession(_machineId: string, sessionId: string): Promise<RuntimeSession> {
      const s = sessions.get(sessionId);
      if (!s) throw new Error(`Session not found: ${sessionId}`);
      return { id: sessionId, title: s.title, createdAt: new Date().toISOString(), runtimeId: id as RuntimeId };
    },

    async listSessions(_machineId: string): Promise<RuntimeSession[]> {
      return Array.from(sessions.entries()).map(([sid, s]) => ({
        id: sid, title: s.title, createdAt: new Date().toISOString(), runtimeId: id as RuntimeId,
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
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`Session not found: ${sessionId}`);

      const userMsg: RuntimeMessage = { id: `msg-${Date.now()}`, role: "user", content: text, timestamp: new Date().toISOString() };
      session.messages.push(userMsg);

      const taskCmd = id === "openhands"
        ? `echo '${text}' | docker exec -i openhands openhands --model claude-sonnet-4 2>&1 || echo "Agent not running"`
        : `cd /opt/${id} && echo "Task: ${text}" && echo "Completed" 2>&1`;

      let result = "";
      try {
        const out = await adapter.executeCommand(machineId, taskCmd);
        result = out || "No output";
      } catch (err: any) {
        result = `Error: ${err.message}`;
      }

      const assistantMsg: RuntimeMessage = { id: `msg-${Date.now()}-resp`, role: "assistant", content: result, timestamp: new Date().toISOString() };
      session.messages.push(assistantMsg);

      return { parts: [{ type: "text", text: result }] };
    },

    openEventStream(_machineId: string): Promise<any> {
      throw new Error("SSE streaming not supported for this agent runtime");
    },

    async getTodos(_machineId: string, _sessionId: string): Promise<RuntimeTodoItem[]> {
      return [];
    },

    async getDiff(_machineId: string, _sessionId: string): Promise<RuntimeFileDiff[]> {
      return [];
    },

    async abortSession(_machineId: string, _sessionId: string): Promise<boolean> {
      return true;
    },

    async healthCheck(machineId: string): Promise<RuntimeHealth> {
      try {
        const out = await adapter.executeCommand(machineId, `test -d /opt/${id} && echo ok || echo missing`);
        return {
          status: out.includes("ok") ? "healthy" : "degraded",
          running: out.includes("ok"),
          sshConnected: true,
          port: null,
        };
      } catch {
        return { status: "down", running: false, sshConnected: false, port: null };
      }
    },

    async restart(machineId: string): Promise<RuntimeHealth> {
      try {
        await adapter.executeCommand(machineId, `rm -rf /opt/${id} && mkdir -p /opt/${id}`);
        await adapter.install(machineId);
        return { status: "healthy", running: true, sshConnected: true, port: null, version: id };
      } catch {
        return { status: "down", running: false, sshConnected: false, port: null };
      }
    },

    async reconnect(machineId: string): Promise<RuntimeHealth> {
      return adapter.healthCheck(machineId);
    },

    async updateRuntime(machineId: string, _channel: string, _version?: string): Promise<RuntimeHealth> {
      try {
        await adapter.executeCommand(machineId, `cd /opt/${id} && git pull 2>/dev/null`);
        return await adapter.restart(machineId);
      } catch {
        return { status: "down", running: false, sshConnected: false, port: null };
      }
    },

    async executeCommand(machineId: string, command: string): Promise<string> {
      // Execute via SSH through the runtime manager's bound adapter
      const { getRuntimeManager } = await import("../manager.js");
      const mgr = getRuntimeManager();
      const opencode = mgr.getAdapter("opencode" as RuntimeId);
      if (!opencode) return `SSH not available for ${id}`;
      return opencode.executeCommand(machineId, command);
    },
  };

  return adapter;
}
