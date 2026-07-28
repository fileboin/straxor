// ── OpenCode Runtime Adapter ──
// Wraps the existing OpenCode implementation behind the Universal RuntimeAdapter interface.

import type { Duplex } from "stream";
import {
  createBoundAdapter,
  type BoundAdapter,
} from "../adapters/runtime/opencode.js";
import type {
  UniversalRuntimeAdapter,
  RuntimeSession,
  RuntimeTodoItem,
  RuntimeFileDiff,
  RuntimeHealth,
  RuntimeChannel,
  ProviderConfig,
} from "./types.js";

/**
 * Creates a Universal RuntimeAdapter that wraps OpenCode.
 * The userId is bound at creation time.
 */
export function createOpenCodeUniversalAdapter(userId: string): UniversalRuntimeAdapter {
  const bound: BoundAdapter = createBoundAdapter(userId);

  return {
    id: "opencode" as const,
    name: "OpenCode",

    async install(_machineId: string) {
      // OpenCode is installed during provisioning — no-op here
    },

    async isInstalled(_machineId: string) {
      return true; // Assume installed if we can reach it
    },

    async createSession(machineId: string, title: string) {
      const result = await bound.createSession(machineId, title);
      return {
        id: result.id,
        title,
        createdAt: new Date().toISOString(),
        runtimeId: "opencode" as const,
      };
    },

    async resumeSession(machineId: string, sessionId: string) {
      const sessions = await bound.listSessions(machineId);
      const found = (sessions as any[]).find((s: any) => s.id === sessionId);
      return {
        id: sessionId,
        title: found?.title || "Resumed session",
        createdAt: found?.createdAt || new Date().toISOString(),
        runtimeId: "opencode" as const,
        model: found?.model,
        provider: found?.provider,
      };
    },

    async listSessions(machineId: string) {
      const sessions = await bound.listSessions(machineId);
      return (sessions as any[]).map((s: any) => ({
        id: s.id,
        title: s.title || "Untitled",
        createdAt: s.createdAt || new Date().toISOString(),
        runtimeId: "opencode" as const,
        model: s.model,
        provider: s.provider,
      }));
    },

    async sendMessage(
      machineId: string,
      sessionId: string,
      text: string,
      opts?: { mode?: "sync" | "async"; systemPrompt?: string }
    ) {
      return bound.sendMessage(machineId, sessionId, text, opts?.mode) as Promise<{ parts?: unknown[] }>;
    },

    async openEventStream(machineId: string) {
      return bound.openEventStream(machineId) as Promise<Duplex>;
    },

    async getTodos(machineId: string, sessionId: string) {
      return bound.getTodos(machineId, sessionId) as Promise<RuntimeTodoItem[]>;
    },

    async getDiff(machineId: string, sessionId: string) {
      return bound.getDiff(machineId, sessionId) as Promise<RuntimeFileDiff[]>;
    },

    async abortSession(machineId: string, sessionId: string) {
      return bound.abortSession(machineId, sessionId);
    },

    async healthCheck(machineId: string) {
      const h = await bound.healthCheck(machineId);
      return {
        status: (h.running ? "healthy" : "down") as "healthy" | "down",
        running: h.running,
        sshConnected: h.sshConnected,
        port: h.opencodePort,
        version: h.version,
        pid: h.pid,
        uptime: h.uptime,
        lastCheck: new Date().toISOString(),
      };
    },

    async restart(machineId: string) {
      const h = await bound.restart(machineId);
      return {
        status: (h.running ? "healthy" : "down") as "healthy" | "down",
        running: h.running,
        sshConnected: h.sshConnected,
        port: h.opencodePort,
        version: h.version,
        pid: h.pid,
        uptime: h.uptime,
        lastCheck: new Date().toISOString(),
      };
    },

    async reconnect(machineId: string) {
      const h = await bound.reconnect(machineId);
      return {
        status: (h.running ? "healthy" : "down") as "healthy" | "down",
        running: h.running,
        sshConnected: h.sshConnected,
        port: h.opencodePort,
        version: h.version,
        pid: h.pid,
        uptime: h.uptime,
        lastCheck: new Date().toISOString(),
      };
    },

    async updateRuntime(machineId: string, channel: RuntimeChannel, version?: string) {
      const h = await bound.updateRuntime(machineId, channel, version);
      return {
        status: (h.running ? "healthy" : "down") as "healthy" | "down",
        running: h.running,
        sshConnected: h.sshConnected,
        port: h.opencodePort,
        version: h.version,
        channel: h.channel,
        pid: h.pid,
        uptime: h.uptime,
        lastCheck: new Date().toISOString(),
      };
    },

    async executeCommand(machineId: string, command: string) {
      return bound.executeCommand(machineId, command);
    },
  };
}
