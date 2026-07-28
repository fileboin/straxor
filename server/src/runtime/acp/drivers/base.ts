import type { ACPDriver } from "./driver.js";
import type { ACPAgentId, ACPToolCall, ACPAgentStatus } from "../types.js";
import type { ACPAgentMeta } from "../types.js";

export abstract class BaseDriver implements ACPDriver {
  abstract agentId: ACPAgentId;
  abstract meta: ACPAgentMeta;

  async install(machineId: string, exec: (machineId: string, cmd: string) => Promise<string>): Promise<void> {
    await exec(machineId, this.meta.installCmd + " 2>&1; echo INSTALLED");
  }

  async isInstalled(machineId: string, exec: (machineId: string, cmd: string) => Promise<string>): Promise<boolean> {
    try {
      const out = await exec(machineId, `which ${this.meta.runCmd} 2>/dev/null && echo FOUND || echo NOT_FOUND`);
      return out.includes("FOUND");
    } catch { return false; }
  }

  async getStatus(machineId: string, exec: (machineId: string, cmd: string) => Promise<string>): Promise<ACPAgentStatus> {
    try {
      const out = await exec(machineId, `which ${this.meta.runCmd} 2>/dev/null && ${this.meta.runCmd} --version 2>/dev/null || echo NOT_INSTALLED`);
      const installed = !out.includes("NOT_INSTALLED");
      return { agentId: this.agentId, running: installed, installed, version: installed ? out.split("\n")[1]?.trim() : undefined };
    } catch {
      return { agentId: this.agentId, running: false, installed: false };
    }
  }

  async executeTask(machineId: string, task: string, opts?: { sessionId?: string; model?: string; dir?: string }, exec?: (machineId: string, cmd: string) => Promise<string>): Promise<string> {
    const model = opts?.model || "claude-sonnet-4";
    const dir = opts?.dir || "/tmp/acp-task";
    const escaped = task.replace(/'/g, "'\\''").replace(/"/g, '\\"');
    const cmd = this.buildCommand(escaped, model, dir);
    if (exec) return exec(machineId, cmd);
    return `[${this.agentId}] Simulated: ${task}`;
  }

  protected abstract buildCommand(task: string, model: string, dir: string): string;

  parseOutput(output: string): { result: string; toolCalls?: ACPToolCall[] } {
    const toolCalls: ACPToolCall[] = [];
    const toolRegex = /<tool_call>\s*(\{[^<]*\})\s*<\/tool_call>/g;
    let match;
    while ((match = toolRegex.exec(output)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        toolCalls.push({ id: `tc-${Date.now()}-${toolCalls.length}`, name: parsed.name || "unknown", arguments: parsed.args || {}, status: "completed", result: parsed.result });
      } catch {}
    }
    const clean = output.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim();
    return { result: clean || output, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
  }
}
