import { BaseDriver } from "./base.js";
import type { ACPAgentId, ACPAgentMeta } from "../types.js";
import { ACP_AGENT_META } from "../types.js";

export class ACPRuntimeDriver extends BaseDriver {
  agentId: ACPAgentId = "acp";
  meta: ACPAgentMeta = ACP_AGENT_META.acp;

  protected buildCommand(task: string, model: string, dir: string): string {
    return `acp execute --port 8342 '${task}' 2>&1`;
  }

  async executeTask(machineId: string, task: string, opts?: { sessionId?: string; model?: string; dir?: string }, exec?: (machineId: string, cmd: string) => Promise<string>): Promise<string> {
    // ACP delegates to the configured agent — acts as a meta-router
    const agent = opts?.model || "claude-code";
    const escaped = task.replace(/'/g, "'\\''");
    const cmd = `acp route --agent ${agent} '${escaped}' 2>&1`;
    if (exec) return exec(machineId, cmd);
    return `[acp] Routed to ${agent}: ${task}`;
  }
}
