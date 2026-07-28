import { api } from "./api.js";

// ── Types ──

export type FrameworkId =
  | "hermes"
  | "voltagent"
  | "deerflow"
  | "agentarius"
  | "langgraph"
  | "crewai"
  | "autogen";

export type AgentRole =
  | "research"
  | "coding"
  | "testing"
  | "security"
  | "documentation";

export type TaskStatus = "pending" | "assigned" | "running" | "completed" | "failed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface AgentFramework {
  id: FrameworkId;
  name: string;
  icon: string;
  description: string;
  language: string;
  repository: string;
  features: string[];
  rolesSupported: AgentRole[];
}

export interface AgentRoleDef {
  id: AgentRole;
  name: string;
  icon: string;
  color: string;
  description: string;
  capabilities: string[];
}

export interface AgentInstance {
  id: string;
  frameworkId: FrameworkId;
  role: AgentRole;
  name: string;
  status: "idle" | "working" | "error" | "offline";
  currentTaskId: string | null;
  config: Record<string, unknown>;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  role: AgentRole;
  assignedAgentId: string | null;
  frameworkId: FrameworkId | null;
  status: TaskStatus;
  priority: TaskPriority;
  input: string;
  output: string | null;
  error: string | null;
  dependencies: string[];
  subtasks: string[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  tokens: number;
  costUSD: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: { id: string; role: AgentRole; frameworkId: FrameworkId | null; instruction: string; dependsOn: string[]; status: TaskStatus; taskId: string | null }[];
  createdAt: string;
  status: "draft" | "running" | "completed" | "failed";
}

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string | null;
  taskId: string;
  role: AgentRole;
  content: string;
  type: "task" | "result" | "question" | "delegation" | "status";
  timestamp: string;
}

export interface MultiAgentStats {
  totalInstances: number;
  idleInstances: number;
  workingInstances: number;
  totalTasks: number;
  completedTasks: number;
  runningTasks: number;
  failedTasks: number;
  totalTokens: number;
  totalCostUSD: number;
  totalWorkflows: number;
  roleBreakdown: { role: AgentRole; name: string; icon: string; instances: number; tasks: number; completed: number }[];
  frameworkBreakdown: { framework: FrameworkId; name: string; icon: string; instances: number; tasks: number }[];
}

// ── Labels & Colors ──

export const ROLE_COLORS: Record<AgentRole, string> = {
  research: "text-blue-400",
  coding: "text-green-400",
  testing: "text-purple-400",
  security: "text-red-400",
  documentation: "text-yellow-400",
};

export const ROLE_BG: Record<AgentRole, string> = {
  research: "bg-blue-500/10",
  coding: "bg-green-500/10",
  testing: "bg-purple-500/10",
  security: "bg-red-500/10",
  documentation: "bg-yellow-500/10",
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: "text-text-muted",
  assigned: "text-blue-400",
  running: "text-accent",
  completed: "text-green-400",
  failed: "text-red-400",
  cancelled: "text-text-muted",
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "text-text-muted",
  medium: "text-blue-400",
  high: "text-yellow-400",
  critical: "text-red-400",
};

// ── API ──

export async function listFrameworks(): Promise<AgentFramework[]> {
  return api("/multi-agent/frameworks");
}

export async function listRoles(): Promise<AgentRoleDef[]> {
  return api("/multi-agent/roles");
}

export async function listInstances(): Promise<AgentInstance[]> {
  return api("/multi-agent/instances");
}

export async function createInstance(frameworkId: string, role: string, name?: string): Promise<AgentInstance> {
  return api("/multi-agent/instances", {
    method: "POST",
    body: JSON.stringify({ frameworkId, role, name }),
  });
}

export async function deleteInstance(id: string): Promise<void> {
  await api(`/multi-agent/instances/${id}`, { method: "DELETE" });
}

export async function listTasks(): Promise<AgentTask[]> {
  return api("/multi-agent/tasks");
}

export async function createTask(params: {
  title: string;
  description?: string;
  role: string;
  priority?: string;
  input?: string;
  frameworkId?: string;
  assignedAgentId?: string;
  dependencies?: string[];
}): Promise<AgentTask> {
  return api("/multi-agent/tasks", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function assignTask(taskId: string, agentId?: string): Promise<AgentTask> {
  return api(`/multi-agent/tasks/${taskId}/assign`, {
    method: "POST",
    body: JSON.stringify({ agentId }),
  });
}

export async function updateTaskStatus(taskId: string, status: string, output?: string, error?: string): Promise<AgentTask> {
  return api(`/multi-agent/tasks/${taskId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, output, error }),
  });
}

export async function completeTask(taskId: string, output: string, tokens?: number, costUSD?: number): Promise<AgentTask> {
  return api(`/multi-agent/tasks/${taskId}/complete`, {
    method: "POST",
    body: JSON.stringify({ output, tokens, costUSD }),
  });
}

export async function listMessages(taskId?: string): Promise<AgentMessage[]> {
  const params = taskId ? `?taskId=${taskId}` : "";
  return api(`/multi-agent/messages${params}`);
}

export async function sendMessage(fromAgentId: string, taskId: string, content: string, type?: string, toAgentId?: string): Promise<AgentMessage> {
  return api("/multi-agent/messages", {
    method: "POST",
    body: JSON.stringify({ fromAgentId, toAgentId, taskId, content, type: type || "status" }),
  });
}

export async function listWorkflows(): Promise<WorkflowDefinition[]> {
  return api("/multi-agent/workflows");
}

export async function createWorkflow(params: {
  name: string;
  description?: string;
  steps: { role: string; frameworkId?: string; instruction: string; dependsOn?: string[] }[];
}): Promise<WorkflowDefinition> {
  return api("/multi-agent/workflows", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function deleteWorkflow(id: string): Promise<void> {
  await api(`/multi-agent/workflows/${id}`, { method: "DELETE" });
}

export async function getStats(): Promise<MultiAgentStats> {
  return api("/multi-agent/stats");
}
