import { BaseDriver } from "./base.js";
import type { ACPAgentId, ACPAgentMeta } from "../types.js";
import { ACP_AGENT_META } from "../types.js";

export class OpenCodeDriver extends BaseDriver {
  agentId: ACPAgentId = "opencode";
  meta: ACPAgentMeta = ACP_AGENT_META.opencode;

  async executeTask(machineId: string, task: string, opts?: { sessionId?: string; model?: string; dir?: string }, exec?: (machineId: string, cmd: string) => Promise<string>): Promise<string> {
    const model = opts?.model || "claude-sonnet-4";
    const escaped = task.replace(/'/g, "'\\''").replace(/"/g, '\\"');
    const cmd = `cd ${opts?.dir || "/tmp"} && opencode execute '${escaped}' --model ${model} 2>&1`;
    if (exec) return exec(machineId, cmd);
    return `[opencode] Task queued: ${task}`;
  }

  protected buildCommand(task: string, model: string, dir: string): string {
    return `cd ${dir} && opencode execute '${task}' --model ${model} 2>&1`;
  }
}
