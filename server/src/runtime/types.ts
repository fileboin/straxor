// ── Universal Runtime Adapter Types ──
// Every AI coding runtime must implement this interface.
// The STRAXOR core never depends on runtime-specific code.

// ── Runtime Identity ──

export type RuntimeId =
  | "opencode"
  | "crush"
  | "free-claude-code"
  | "claude-code"
  | "codex"
  | "gemini-cli"
  | "cline"
  | "continue"
  | "goose"
  | "openhands"
  | "deerflow"
  | "voltagent"
  | "langgraph"
  | "crewai"
  | "autogen"
  | "agentarius"
  | "custom";

export interface RuntimeDefinition {
  id: RuntimeId;
  name: string;
  description: string;
  icon: string;
  color: string;
  version?: string;
  installCommand?: string;
  repoUrl?: string;
  isInstalled: boolean;
  isEnabled: boolean;
}

// ── Provider Configuration ──

export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "openrouter"
  | "ollama"
  | "deepseek"
  | "groq"
  | "xai"
  | "custom";

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  icon: string;
  color: string;
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  defaultModel?: string;
  isEnabled: boolean;
}

// ── Session ──

export interface RuntimeSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  runtimeId: RuntimeId;
  model?: string;
  provider?: string;
  messageCount?: number;
}

// ── Messages ──

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface RuntimeMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  model?: string;
  provider?: string;
  toolCalls?: RuntimeToolCall[];
  metadata?: Record<string, unknown>;
}

// ── Tool Execution ──

export type ToolStatus = "pending" | "running" | "completed" | "error" | "blocked";

export interface RuntimeToolCall {
  id: string;
  name: string;
  args: Record<string, unknown> | string;
  status: ToolStatus;
  result?: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
}

// ── Events (SSE) ──

export type RuntimeEventType =
  | "session.created"
  | "session.idle"
  | "session.error"
  | "message.updated"
  | "part.updated"
  | "tool.started"
  | "tool.completed"
  | "tool.error"
  | "heartbeat"
  | "done";

export interface RuntimeEvent {
  type: RuntimeEventType;
  timestamp: string;
  sessionId?: string;
  messageId?: string;
  data?: unknown;
}

// ── Todos / Diff ──

export interface RuntimeTodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export interface RuntimeFileDiff {
  path: string;
  additions: string[];
  deletions: string[];
}

// ── MCP Server ──

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  isEnabled: boolean;
}

// ── Health ──

export type RuntimeHealthStatus = "healthy" | "degraded" | "down" | "unknown";

export interface RuntimeHealth {
  status: RuntimeHealthStatus;
  running: boolean;
  sshConnected: boolean;
  port: number | null;
  version?: string;
  uptime?: string;
  pid?: number;
  pidFile?: string;
  lastError?: string;
  lastCheck?: string;
  provider?: string;
  model?: string;
}

// ── Runtime Status ──

export type RuntimeChannel = "stable" | "beta" | "custom";

// ── The Universal Interface ──

export interface UniversalRuntimeAdapter {
  // Identity
  readonly id: RuntimeId;
  readonly name: string;

  // Lifecycle
  install(machineId: string): Promise<void>;
  isInstalled(machineId: string): Promise<boolean>;

  // Session Management
  createSession(machineId: string, title: string): Promise<RuntimeSession>;
  resumeSession(machineId: string, sessionId: string): Promise<RuntimeSession>;
  listSessions(machineId: string): Promise<RuntimeSession[]>;
  deleteSession?(machineId: string, sessionId: string): Promise<void>;

  // Messaging
  sendMessage(
    machineId: string,
    sessionId: string,
    text: string,
    opts?: { mode?: "sync" | "async"; systemPrompt?: string }
  ): Promise<{ parts?: unknown[] }>;

  // Streaming (SSE)
  openEventStream(machineId: string): Promise<import("stream").Duplex>;

  // Context / Inspection
  getTodos(machineId: string, sessionId: string): Promise<RuntimeTodoItem[]>;
  getDiff(machineId: string, sessionId: string): Promise<RuntimeFileDiff[]>;

  // Execution Control
  abortSession(machineId: string, sessionId: string): Promise<boolean>;
  cancelExecution?(machineId: string, sessionId: string): Promise<void>;

  // Provider Management
  setProvider?(machineId: string, config: ProviderConfig): Promise<void>;
  getActiveProvider?(machineId: string): Promise<ProviderConfig | null>;

  // MCP
  listMCPServers?(machineId: string): Promise<MCPServerConfig[]>;
  addMCPServer?(machineId: string, config: MCPServerConfig): Promise<void>;
  removeMCPServer?(machineId: string, serverId: string): Promise<void>;

  // Health & Operations
  healthCheck(machineId: string): Promise<RuntimeHealth>;
  restart(machineId: string): Promise<RuntimeHealth>;
  reconnect(machineId: string): Promise<RuntimeHealth>;
  updateRuntime(
    machineId: string,
    channel: RuntimeChannel,
    version?: string
  ): Promise<RuntimeHealth>;

  // Shell
  executeCommand(machineId: string, command: string): Promise<string>;
}
