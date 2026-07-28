import { BaseDriver } from "./base.js";
import type { ACPAgentId, ACPAgentMeta } from "../types.js";
import { ACP_AGENT_META } from "../types.js";

export class ClaudeCodeDriver extends BaseDriver {
  agentId: ACPAgentId = "claude-code";
  meta: ACPAgentMeta = ACP_AGENT_META["claude-code"];
  protected buildCommand(task: string, model: string, dir: string): string {
    return `cd ${dir} && echo '${task}' | claude --model ${model} 2>&1`;
  }
}

export class CodexDriver extends BaseDriver {
  agentId: ACPAgentId = "codex";
  meta: ACPAgentMeta = ACP_AGENT_META.codex;
  protected buildCommand(task: string, model: string, dir: string): string {
    return `cd ${dir} && codex --model ${model} '${task}' 2>&1`;
  }
}

export class GeminiCLIDriver extends BaseDriver {
  agentId: ACPAgentId = "gemini-cli";
  meta: ACPAgentMeta = ACP_AGENT_META["gemini-cli"];
  protected buildCommand(task: string, model: string, dir: string): string {
    return `cd ${dir} && gemini run --model ${model} '${task}' 2>&1`;
  }
}

export class ClineDriver extends BaseDriver {
  agentId: ACPAgentId = "cline";
  meta: ACPAgentMeta = ACP_AGENT_META.cline;
  protected buildCommand(task: string, model: string, dir: string): string {
    return `cd ${dir} && cline --provider ${model} '${task}' 2>&1`;
  }
}

export class GooseDriver extends BaseDriver {
  agentId: ACPAgentId = "goose";
  meta: ACPAgentMeta = ACP_AGENT_META.goose;
  protected buildCommand(task: string, model: string, dir: string): string {
    return `cd ${dir} && goose run --model ${model} '${task}' 2>&1`;
  }
}

export class QwenCodeDriver extends BaseDriver {
  agentId: ACPAgentId = "qwen-code";
  meta: ACPAgentMeta = ACP_AGENT_META["qwen-code"];
  protected buildCommand(task: string, model: string, dir: string): string {
    return `cd ${dir} && qwen-code --model ${model} '${task}' 2>&1`;
  }
}
