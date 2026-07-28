// ── Multi-Agent Types ──

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
export type FrameworkStatus = "available" | "configured" | "running" | "error";

export interface AgentFramework {
  id: FrameworkId;
  name: string;
  icon: string;
  description: string;
  language: string;
  baseUrl?: string;
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
  steps: WorkflowStep[];
  createdAt: string;
  status: "draft" | "running" | "completed" | "failed";
}

export interface WorkflowStep {
  id: string;
  role: AgentRole;
  frameworkId: FrameworkId | null;
  instruction: string;
  dependsOn: string[];
  status: TaskStatus;
  taskId: string | null;
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

// ── Framework Definitions ──

export const FRAMEWORKS: AgentFramework[] = [
  {
    id: "hermes",
    name: "Hermes Agent",
    icon: "🦅",
    description: "Agentic AI framework s tool-use i function-calling podrškom",
    language: "Python",
    repository: "https://github.com/aiwaves-cn/hermes-agent",
    features: ["Function calling", "Tool use", "Chain-of-thought", "Multi-turn"],
    rolesSupported: ["research", "coding", "documentation"],
  },
  {
    id: "voltagent",
    name: "VoltAgent",
    icon: "⚡",
    description: "Open-source AI agent framework za LLM orchestraciju",
    language: "TypeScript",
    repository: "https://github.com/voltagent/voltagent",
    features: ["TypeScript native", "LLM orchestration", "Tool integration", "Memory"],
    rolesSupported: ["coding", "testing", "documentation"],
  },
  {
    id: "deerflow",
    name: "DeerFlow",
    icon: "🦌",
    description: "Deep research framework za autonomno istraživanje i izvještaje",
    language: "Python",
    repository: "https://github.com/bytedance/deer-flow",
    features: ["Deep research", "Web browsing", "Report generation", "Multi-step"],
    rolesSupported: ["research", "documentation"],
  },
  {
    id: "agentarius",
    name: "Agentarius",
    icon: "🤖",
    description: "Multi-agent orkestracija s rolama i delegacijom",
    language: "Python",
    repository: "https://github.com/agentarius/agentarius",
    features: ["Agent delegation", "Role-based", "Task scheduling", "Monitoring"],
    rolesSupported: ["research", "coding", "testing", "security", "documentation"],
  },
  {
    id: "langgraph",
    name: "LangGraph",
    icon: "🕸",
    description: "Stateful multi-agent workflows s LangChain-om",
    language: "Python",
    repository: "https://github.com/langchain-ai/langgraph",
    features: ["State machines", "Conditional routing", "Human-in-the-loop", "Persistence"],
    rolesSupported: ["research", "coding", "testing", "security", "documentation"],
  },
  {
    id: "crewai",
    name: "CrewAI",
    icon: "👥",
    description: "Role-based multi-agent AI sistema s delegacijom",
    language: "Python",
    repository: "https://github.com/crewAIInc/crewAI",
    features: ["Role delegation", "Task delegation", "Sequential/parallel", "Memory"],
    rolesSupported: ["research", "coding", "testing", "security", "documentation"],
  },
  {
    id: "autogen",
    name: "AutoGen",
    icon: "🔄",
    description: "Microsoft-ov multi-agent conversation framework",
    language: "Python",
    repository: "https://github.com/microsoft/autogen",
    features: ["Agent conversations", "Code execution", "Group chat", "Human input"],
    rolesSupported: ["research", "coding", "testing", "documentation"],
  },
];

// ── Role Definitions ──

export const AGENT_ROLES: AgentRoleDef[] = [
  {
    id: "research",
    name: "Research Agent",
    icon: "🔍",
    color: "blue",
    description: "Istraživanje, analiza dokumenata, prikupljanje informacija",
    capabilities: ["Web search", "Document analysis", "Data gathering", "Summarization", "Fact-checking"],
  },
  {
    id: "coding",
    name: "Coding Agent",
    icon: "💻",
    color: "green",
    description: "Pisanje koda, refactoring, implementacija feature-a",
    capabilities: ["Code generation", "Refactoring", "Bug fixing", "Code review", "Architecture"],
  },
  {
    id: "testing",
    name: "Testing Agent",
    icon: "🧪",
    color: "purple",
    description: "Testiranje, pronalaženje bug-ova, validacija",
    capabilities: ["Unit testing", "Integration testing", "E2E testing", "Bug detection", "Coverage analysis"],
  },
  {
    id: "security",
    name: "Security Agent",
    icon: "🛡",
    color: "red",
    description: "Sigurnosna provjera, vulnerability scanning, audit",
    capabilities: ["Vulnerability scanning", "Dependency audit", "Code security review", "Compliance checks", "Pen testing"],
  },
  {
    id: "documentation",
    name: "Documentation Agent",
    icon: "📝",
    color: "yellow",
    description: "Generisanje dokumentacije, README, komentara",
    capabilities: ["Doc generation", "API docs", "README creation", "Comment writing", "Changelog"],
  },
];

export function getFramework(id: string): AgentFramework | undefined {
  return FRAMEWORKS.find((f) => f.id === id);
}

export function getRoleDef(id: string): AgentRoleDef | undefined {
  return AGENT_ROLES.find((r) => r.id === id);
}

export function getFrameworksForRole(role: AgentRole): AgentFramework[] {
  return FRAMEWORKS.filter((f) => f.rolesSupported.includes(role));
}

export function getRolesForFramework(frameworkId: AgentRole): AgentRoleDef[] {
  const fw = getFramework(frameworkId);
  if (!fw) return [];
  return AGENT_ROLES.filter((r) => fw.rolesSupported.includes(r.id));
}
