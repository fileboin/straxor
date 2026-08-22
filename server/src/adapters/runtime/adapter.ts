import type { Duplex } from "stream";
import type { EngineAttachment } from "../../lib/attachments.js";

export type { EngineAttachment };

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface FileDiff {
  path: string;
  additions: string[];
  deletions: string[];
}

export interface AgentEvent {
  type: "session" | "text" | "tool_call" | "tool_result" | "done" | "error";
  [key: string]: unknown;
}

export type RuntimeChannel = "stable" | "beta" | "custom";

export interface RuntimeHealth {
  running: boolean;
  sshConnected: boolean;
  opencodePort: number | null;
  version?: string;
  channel?: RuntimeChannel;
  uptime?: string;
  pid?: number;
}

export interface RuntimeAdapter {
  createSession(machineId: string, title: string): Promise<{ id: string }>;
  sendMessage(
    machineId: string,
    sessionId: string,
    text: string,
    mode?: "sync" | "async",
    attachments?: EngineAttachment[],
    system?: string,
    model?: string
  ): Promise<{ parts?: unknown[] }>;
  listSessions(machineId: string): Promise<unknown[]>;
  getTodos(machineId: string, sessionId: string): Promise<TodoItem[]>;
  getDiff(machineId: string, sessionId: string): Promise<FileDiff[]>;
  openEventStream(machineId: string, model?: string): Promise<Duplex>;
  abortSession(machineId: string, sessionId: string): Promise<boolean>;
  healthCheck(machineId: string): Promise<RuntimeHealth>;
  restart(machineId: string): Promise<RuntimeHealth>;
  reconnect(machineId: string): Promise<RuntimeHealth>;
  updateRuntime(
    machineId: string,
    channel: RuntimeChannel,
    version?: string
  ): Promise<RuntimeHealth>;
  executeCommand(machineId: string, command: string): Promise<string>;
}
