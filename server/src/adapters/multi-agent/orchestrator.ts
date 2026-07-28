import {
  FRAMEWORKS,
  AGENT_ROLES,
  type FrameworkId,
  type AgentRole,
  type AgentInstance,
  type AgentTask,
  type AgentMessage,
  type WorkflowDefinition,
  type WorkflowStep,
  type TaskStatus,
  type TaskPriority,
} from "./types.js";

// ── In-memory stores ──
const instances: Map<string, AgentInstance> = new Map();
const tasks: Map<string, AgentTask> = new Map();
const messages: AgentMessage[] = [];
const workflows: Map<string, WorkflowDefinition> = new Map();
let taskCounter = 0;

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Instance Management ──

export function createInstance(frameworkId: FrameworkId, role: AgentRole, name?: string): AgentInstance {
  const fw = FRAMEWORKS.find((f) => f.id === frameworkId);
  const roleDef = AGENT_ROLES.find((r) => r.id === role);
  if (!fw) throw new Error(`Unknown framework: ${frameworkId}`);
  if (!fw.rolesSupported.includes(role)) {
    throw new Error(`Framework ${fw.name} does not support role: ${role}`);
  }

  const instance: AgentInstance = {
    id: genId("agent"),
    frameworkId,
    role,
    name: name || `${roleDef?.name || role} (${fw.name})`,
    status: "idle",
    currentTaskId: null,
    config: {},
    createdAt: new Date().toISOString(),
    lastActiveAt: null,
  };

  instances.set(instance.id, instance);
  return instance;
}

export function getInstance(id: string): AgentInstance | undefined {
  return instances.get(id);
}

export function getAllInstances(): AgentInstance[] {
  return Array.from(instances.values());
}

export function getInstancesByRole(role: AgentRole): AgentInstance[] {
  return Array.from(instances.values()).filter((i) => i.role === role);
}

export function deleteInstance(id: string): boolean {
  return instances.delete(id);
}

// ── Task Management ──

export function createTask(params: {
  title: string;
  description: string;
  role: AgentRole;
  priority?: TaskPriority;
  input: string;
  frameworkId?: FrameworkId;
  assignedAgentId?: string;
  dependencies?: string[];
}): AgentTask {
  taskCounter++;
  const task: AgentTask = {
    id: genId("task"),
    title: params.title,
    description: params.description,
    role: params.role,
    assignedAgentId: params.assignedAgentId || null,
    frameworkId: params.frameworkId || null,
    status: "pending",
    priority: params.priority || "medium",
    input: params.input,
    output: null,
    error: null,
    dependencies: params.dependencies || [],
    subtasks: [],
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    tokens: 0,
    costUSD: 0,
  };

  tasks.set(task.id, task);
  return task;
}

export function getTask(id: string): AgentTask | undefined {
  return tasks.get(id);
}

export function getAllTasks(): AgentTask[] {
  return Array.from(tasks.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getTasksByRole(role: AgentRole): AgentTask[] {
  return getAllTasks().filter((t) => t.role === role);
}

export function updateTaskStatus(id: string, status: TaskStatus, output?: string, error?: string): AgentTask | null {
  const task = tasks.get(id);
  if (!task) return null;

  task.status = status;
  if (status === "running") task.startedAt = new Date().toISOString();
  if (status === "completed" || status === "failed") task.completedAt = new Date().toISOString();
  if (output !== undefined) task.output = output;
  if (error !== undefined) task.error = error;

  tasks.set(id, task);
  return task;
}

export function assignTask(taskId: string, agentId: string): AgentTask | null {
  const task = tasks.get(taskId);
  const agent = instances.get(agentId);
  if (!task || !agent) return null;

  task.assignedAgentId = agentId;
  task.frameworkId = agent.frameworkId;
  task.status = "assigned";

  agent.status = "working";
  agent.currentTaskId = taskId;
  agent.lastActiveAt = new Date().toISOString();

  tasks.set(taskId, task);
  instances.set(agentId, agent);
  return task;
}

export function completeTask(taskId: string, output: string, tokens = 0, costUSD = 0): AgentTask | null {
  const task = tasks.get(taskId);
  if (!task) return null;

  task.status = "completed";
  task.output = output;
  task.completedAt = new Date().toISOString();
  task.tokens = tokens;
  task.costUSD = costUSD;

  // Free up agent
  if (task.assignedAgentId) {
    const agent = instances.get(task.assignedAgentId);
    if (agent) {
      agent.status = "idle";
      agent.currentTaskId = null;
      instances.set(task.assignedAgentId, agent);
    }
  }

  tasks.set(taskId, task);
  return task;
}

// ── Auto-assign ──

export function autoAssignTask(taskId: string): AgentTask | null {
  const task = tasks.get(taskId);
  if (!task) return null;

  // Find idle agent with matching role
  const candidates = Array.from(instances.values()).filter(
    (i) => i.role === task.role && i.status === "idle"
  );

  if (candidates.length === 0) return null;

  // Prefer matching framework
  const preferred = task.frameworkId
    ? candidates.filter((c) => c.frameworkId === task.frameworkId)
    : candidates;

  const agent = preferred.length > 0 ? preferred[0] : candidates[0];
  return assignTask(taskId, agent.id);
}

// ── Messages ──

export function sendMessage(params: {
  fromAgentId: string;
  toAgentId?: string;
  taskId: string;
  content: string;
  type: AgentMessage["type"];
}): AgentMessage {
  const agent = instances.get(params.fromAgentId);
  const msg: AgentMessage = {
    id: genId("msg"),
    fromAgentId: params.fromAgentId,
    toAgentId: params.toAgentId || null,
    taskId: params.taskId,
    role: agent?.role || "coding",
    content: params.content,
    type: params.type,
    timestamp: new Date().toISOString(),
  };
  messages.push(msg);
  return msg;
}

export function getMessages(taskId?: string): AgentMessage[] {
  if (taskId) return messages.filter((m) => m.taskId === taskId);
  return [...messages].reverse();
}

// ── Workflows ──

export function createWorkflow(params: {
  name: string;
  description: string;
  steps: { role: AgentRole; frameworkId?: FrameworkId; instruction: string; dependsOn?: string[] }[];
}): WorkflowDefinition {
  const steps: WorkflowStep[] = params.steps.map((s, idx) => ({
    id: `step-${idx}`,
    role: s.role,
    frameworkId: s.frameworkId || null,
    instruction: s.instruction,
    dependsOn: s.dependsOn || [],
    status: "pending" as TaskStatus,
    taskId: null,
  }));

  const wf: WorkflowDefinition = {
    id: genId("wf"),
    name: params.name,
    description: params.description,
    steps,
    createdAt: new Date().toISOString(),
    status: "draft",
  };

  workflows.set(wf.id, wf);
  return wf;
}

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return workflows.get(id);
}

export function getAllWorkflows(): WorkflowDefinition[] {
  return Array.from(workflows.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function deleteWorkflow(id: string): boolean {
  return workflows.delete(id);
}

// ── Stats ──

export function getStats() {
  const allTasks = getAllTasks();
  const allInstances = getAllInstances();
  const completed = allTasks.filter((t) => t.status === "completed");
  const running = allTasks.filter((t) => t.status === "running");
  const totalTokens = allTasks.reduce((s, t) => s + t.tokens, 0);
  const totalCost = allTasks.reduce((s, t) => s + t.costUSD, 0);

  return {
    totalInstances: allInstances.length,
    idleInstances: allInstances.filter((i) => i.status === "idle").length,
    workingInstances: allInstances.filter((i) => i.status === "working").length,
    totalTasks: allTasks.length,
    completedTasks: completed.length,
    runningTasks: running.length,
    failedTasks: allTasks.filter((t) => t.status === "failed").length,
    totalTokens,
    totalCostUSD: totalCost,
    totalWorkflows: workflows.size,
    roleBreakdown: AGENT_ROLES.map((r) => ({
      role: r.id,
      name: r.name,
      icon: r.icon,
      instances: allInstances.filter((i) => i.role === r.id).length,
      tasks: allTasks.filter((t) => t.role === r.id).length,
      completed: completed.filter((t) => t.role === r.id).length,
    })),
    frameworkBreakdown: FRAMEWORKS.map((f) => ({
      framework: f.id,
      name: f.name,
      icon: f.icon,
      instances: allInstances.filter((i) => i.frameworkId === f.id).length,
      tasks: allTasks.filter((t) => t.frameworkId === f.id).length,
    })),
  };
}
