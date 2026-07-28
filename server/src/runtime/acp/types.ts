import type { RuntimeId } from "../types.js";

// ── ACP / Agent Protocol Types ──

export type ACPAgentId =
  | "acp"
  | "opencode"
  | "claude-code"
  | "codex"
  | "gemini-cli"
  | "cline"
  | "goose"
  | "qwen-code";

export interface ACPAgentMeta {
  name: string;
  description: string;
  icon: string;
  color: string;
  repoUrl: string;
  installType: "npm" | "pip" | "docker" | "binary";
  installCmd: string;
  runCmd: string;
  cliArgs?: string;
}

export interface ACPMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: ACPToolCall[];
  timestamp: string;
}

export interface ACPToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "error";
  result?: string;
}

export interface ACPSession {
  id: string;
  agentId: ACPAgentId;
  title: string;
  status: "active" | "idle" | "error" | "completed";
  messages: ACPMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ACPAgentStatus {
  agentId: ACPAgentId;
  running: boolean;
  installed: boolean;
  version?: string;
  pid?: number;
  port?: number;
  error?: string;
}

export const ACP_AGENT_META: Record<ACPAgentId, ACPAgentMeta> = {
  acp: {
    name: "ACP Runtime",
    description: "Agent Communication Protocol — neutral agent client",
    icon: "🔌",
    color: "text-white",
    repoUrl: "https://github.com/agentcommunicationprotocol/acp",
    installType: "npm",
    installCmd: "npm install -g @acp/runtime",
    runCmd: "acp",
    cliArgs: "--port {{port}}",
  },
  opencode: {
    name: "OpenCode",
    description: "Open-source AI coding agent — SSH remote, local CLI",
    icon: "◇",
    color: "text-blue-400",
    repoUrl: "https://github.com/opencode-ai/opencode",
    installType: "npm",
    installCmd: "npm install -g @opencode-ai/opencode",
    runCmd: "opencode",
    cliArgs: "--model {{model}} --dir {{dir}}",
  },
  "claude-code": {
    name: "Claude Code",
    description: "Anthropic's official CLI coding agent",
    icon: "◆",
    color: "text-orange-400",
    repoUrl: "https://github.com/anthropics/claude-code",
    installType: "npm",
    installCmd: "npm install -g @anthropic-ai/claude-code",
    runCmd: "claude",
    cliArgs: "--model {{model}}",
  },
  codex: {
    name: "Codex CLI",
    description: "OpenAI's coding agent CLI — autonomous development",
    icon: "◉",
    color: "text-green-400",
    repoUrl: "https://github.com/openai/codex",
    installType: "npm",
    installCmd: "npm install -g @openai/codex",
    runCmd: "codex",
    cliArgs: "--model {{model}}",
  },
  "gemini-cli": {
    name: "Gemini CLI",
    description: "Google's Gemini-based coding agent CLI",
    icon: "◇",
    color: "text-blue-400",
    repoUrl: "https://github.com/google-gemini/gemini-cli",
    installType: "npm",
    installCmd: "npm install -g @google/gemini-cli",
    runCmd: "gemini",
    cliArgs: "run --model {{model}}",
  },
  cline: {
    name: "Cline",
    description: "VS Code AI coding extension — standalone CLI mode",
    icon: "⚡",
    color: "text-cyan-400",
    repoUrl: "https://github.com/cline/cline",
    installType: "npm",
    installCmd: "npm install -g @cline/cli",
    runCmd: "cline",
    cliArgs: "--provider {{provider}}",
  },
  goose: {
    name: "Goose",
    description: "Block's AI coding agent — autonomous task execution",
    icon: "🪿",
    color: "text-amber-400",
    repoUrl: "https://github.com/block/goose",
    installType: "npm",
    installCmd: "npm install -g @block/goose",
    runCmd: "goose",
    cliArgs: "run --model {{model}}",
  },
  "qwen-code": {
    name: "Qwen Code",
    description: "Alibaba's Qwen-based coding agent CLI",
    icon: "🐉",
    color: "text-red-400",
    repoUrl: "https://github.com/QwenLM/Qwen-Code",
    installType: "pip",
    installCmd: "pip install qwen-code",
    runCmd: "qwen-code",
    cliArgs: "--model {{model}}",
  },
};

// Sessions that use existing STRAXOR runtime (not standalone CLI)
export const ACP_LEGACY_RUNTIME: Partial<Record<ACPAgentId, RuntimeId>> = {
  opencode: "opencode",
};
