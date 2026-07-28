import type { ACPAgentId, ACPToolCall, ACPAgentStatus } from "../types.js";

export interface ACPDriver {
  readonly agentId: ACPAgentId;

  install(machineId: string, execCmd: (machineId: string, cmd: string) => Promise<string>): Promise<void>;
  isInstalled(machineId: string, execCmd: (machineId: string, cmd: string) => Promise<string>): Promise<boolean>;
  executeTask(machineId: string, task: string, opts?: { sessionId?: string; model?: string; dir?: string }, execCmd?: (machineId: string, cmd: string) => Promise<string>): Promise<string>;
  getStatus(machineId: string, execCmd: (machineId: string, cmd: string) => Promise<string>): Promise<ACPAgentStatus>;
  parseOutput(output: string): { result: string; toolCalls?: ACPToolCall[] };
}
