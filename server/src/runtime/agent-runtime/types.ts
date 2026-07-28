// ── Agent Runtime Types ──

export type AgentRuntimeId = "openhands" | "deerflow" | "voltagent" | "langgraph" | "crewai" | "autogen" | "agentarius";

export const AGENT_RUNTIME_META: Record<AgentRuntimeId, { name: string; description: string; repoUrl: string; icon: string; color: string }> = {
  openhands: {
    name: "OpenHands",
    description: "Open-source AI coding agent (formerly OpenDevin) — autonomous development",
    repoUrl: "https://github.com/All-Hands-AI/OpenHands",
    icon: "✋",
    color: "text-blue-400",
  },
  deerflow: {
    name: "DeerFlow",
    description: "Lightweight agent orchestration framework — fast, modular",
    repoUrl: "https://github.com/deerflow/agent",
    icon: "🦌",
    color: "text-amber-400",
  },
  voltagent: {
    name: "VoltAgent",
    description: "High-performance multi-agent system with task routing",
    repoUrl: "https://github.com/voltaic/voltagent",
    icon: "⚡",
    color: "text-yellow-400",
  },
  langgraph: {
    name: "LangGraph",
    description: "LangChain graph-based agent orchestration — stateful workflows",
    repoUrl: "https://github.com/langchain-ai/langgraph",
    icon: "🔗",
    color: "text-green-400",
  },
  crewai: {
    name: "CrewAI",
    description: "Multi-agent orchestration — role-based agent crews",
    repoUrl: "https://github.com/crewAIInc/crewAI",
    icon: "👥",
    color: "text-orange-400",
  },
  autogen: {
    name: "AutoGen",
    description: "Microsoft multi-agent conversation framework",
    repoUrl: "https://github.com/microsoft/autogen",
    icon: "🔄",
    color: "text-purple-400",
  },
  agentarius: {
    name: "Agentarius",
    description: "Decentralized multi-agent platform — agent discovery, meshing",
    repoUrl: "https://github.com/agentarius/core",
    icon: "🌐",
    color: "text-cyan-400",
  },
};
