import { api } from "./api.js";

// ── Types ──

export interface HomeCenterStats {
  apiKeys: number;
  projects: number;
  machines: number;
  activeMachines: number;
  sessions: number;
  recentLogs: { id: string; category: string; level: string; message: string; createdAt: string }[];
  permissions: number;
  deployments: number;
}

export interface HomeTile {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: "ai" | "system" | "tools" | "info";
  action: string; // panel ID or URL
  badge?: string;
  status?: "ok" | "warning" | "error" | "neutral";
}

// ── Tile Definitions ──

export const HOME_TILES: HomeTile[] = [
  {
    id: "providers",
    name: "AI Providers",
    description: "Direktne API konekcije — OpenAI, Anthropic, Google...",
    icon: "🔗",
    color: "blue",
    category: "ai",
    action: "providers",
  },
  {
    id: "browser-ai",
    name: "Browser AI",
    description: "WebLLM — lokalni modeli u browseru, besplatno",
    icon: "🌐",
    color: "purple",
    category: "ai",
    action: "browser-ai",
    badge: "WebLLM",
  },
  {
    id: "gateway",
    name: "AI Gateway",
    description: "Token router, cache, fallback i metrike",
    icon: "⚡",
    color: "yellow",
    category: "ai",
    action: "gateway",
  },
  {
    id: "multi-agent",
    name: "Multi-Agent",
    description: "CrewAI, LangGraph, AutoGen — agentic sistem",
    icon: "🤖",
    color: "green",
    category: "ai",
    action: "multi-agent",
  },
  {
    id: "runtime",
    name: "Runtime",
    description: "VPS status, OpenCode serve, health check",
    icon: "⚙",
    color: "orange",
    category: "system",
    action: "ssh",
  },
  {
    id: "deploy",
    name: "Deployment",
    description: "Deploy projekata na VPS, Docker, cloud",
    icon: "🚀",
    color: "red",
    category: "system",
    action: "deploy",
  },
  {
    id: "git",
    name: "Git Worktrees",
    description: "Paralelne grane, worktree management",
    icon: "🌳",
    color: "green",
    category: "tools",
    action: "worktrees",
  },
  {
    id: "git-remote",
    name: "Git Platforme",
    description: "GitHub, GitLab, Forgejo, Gitea, Bitbucket, HF Hub",
    icon: "🔗",
    color: "blue",
    category: "tools",
    action: "git-remote",
  },
  {
    id: "prompts",
    name: "Prompt Library",
    description: "Spremljeni prompti, agent uloge",
    icon: "📋",
    color: "blue",
    category: "tools",
    action: "prompts",
  },
  {
    id: "context",
    name: "Kontekst Engine",
    description: "Pravila, sjećanja, web research za AI",
    icon: "🧠",
    color: "purple",
    category: "tools",
    action: "context",
  },
  {
    id: "theme",
    name: "Tema",
    description: "Dark/Light, OLED, akcent boje",
    icon: "🎨",
    color: "pink",
    category: "info",
    action: "theme",
  },
  {
    id: "logs",
    name: "Logovi",
    description: "Sistemski logovi, greške, aktivnosti",
    icon: "📜",
    color: "orange",
    category: "info",
    action: "logs",
  },
  {
    id: "console",
    name: "Konzola",
    description: "Runtime greške, stack trace-ovi",
    icon: "💻",
    color: "red",
    category: "info",
    action: "console",
  },
  {
    id: "env",
    name: "Env Varijable",
    description: ".env upravljanje, validacija, historija",
    icon: "🔑",
    color: "yellow",
    category: "system",
    action: "env",
  },
  {
    id: "permissions",
    name: "Agent Dozvole",
    description: "Tool permisije — always/ask/never",
    icon: "🛡",
    color: "red",
    category: "system",
    action: "permissions",
  },
  {
    id: "rollback",
    name: "Historija verzija",
    description: "Vizuelni rollback, snapshot-ovi",
    icon: "↺",
    color: "orange",
    category: "tools",
    action: "rollback",
  },
  {
    id: "notifications",
    name: "Notifikacije",
    description: "Browser, Telegram, Discord, Email",
    icon: "🔔",
    color: "yellow",
    category: "system",
    action: "notifications",
  },
  {
    id: "export",
    name: "Export",
    description: "ZIP export, konfiguracija, datoteke",
    icon: "📦",
    color: "blue",
    category: "tools",
    action: "export",
  },
  {
    id: "security",
    name: "Sigurnost",
    description: "Package scanning, vulnerability check",
    icon: "🔒",
    color: "red",
    category: "system",
    action: "security",
  },
  {
    id: "sessions",
    name: "Sesije",
    description: "Prethodne sesije, nastavi rad",
    icon: "📑",
    color: "green",
    category: "info",
    action: "sessions",
  },
  {
    id: "docs",
    name: "Dokumentacija",
    description: "Vodiči, API referenca, primjeri",
    icon: "📖",
    color: "blue",
    category: "info",
    action: "docs",
  },
  {
    id: "design-studio",
    name: "Design Studio",
    description: "Website builder, prompt→UI, image gen, prezentacije",
    icon: "🎨",
    color: "pink",
    category: "tools",
    action: "design-studio",
  },
  {
    id: "web-research",
    name: "Web Research",
    description: "Firecrawl, Tavily, Brave, SearXNG, Custom Crawler",
    icon: "🔍",
    color: "green",
    category: "tools",
    action: "web-research",
  },
  {
    id: "design-assets",
    name: "Design Assets",
    description: "Ikone, tokeni, SVG kolekcije, brand",
    icon: "🖼",
    color: "purple",
    category: "tools",
    action: "design-assets",
  },
  {
    id: "usage",
    name: "Usage & Cost",
    description: "Troškovi, tokeni, budžeti, cjenovnik",
    icon: "📊",
    color: "orange",
    category: "system",
    action: "usage",
  },
  {
    id: "runtime-manager",
    name: "Runtime Manager",
    description: "OpenCode, Crush, Claude Code — izaberi runtime",
    icon: "⚙",
    color: "blue",
    category: "system",
    action: "runtime-manager",
  },
  {
    id: "quick-start",
    name: "Quick Start",
    description: "Predlošci za brzi početak projekta",
    icon: "✨",
    color: "green",
    category: "tools",
    action: "quick-start",
  },
  {
    id: "kanban",
    name: "Komandni Centar",
    description: "Kanban pregled sesija, deployeva i VPS statusa",
    icon: "📋",
    color: "purple",
    category: "system",
    action: "kanban",
  },
  {
    id: "mcp-marketplace",
    name: "MCP Marketplace",
    description: "MCP server registry — Firecrawl, Database, Docs, GitHub, Slack...",
    icon: "🔌",
    color: "blue",
    category: "system",
    action: "mcp-marketplace",
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    description: "DNS, SSL, Proxy, Tunnel, Uptime Monitoring & Alerts",
    icon: "🏗",
    color: "orange",
    category: "system",
    action: "infrastructure",
  },
  {
    id: "teams",
    name: "Team Collaboration",
    description: "Timovi, RBAC, deljenje projekata, kod komentari",
    icon: "👥",
    color: "green",
    category: "system",
    action: "teams",
  },
  {
    id: "organization",
    name: "Organization Dashboard",
    description: "Organizacije, budžeti, deljeni API ključevi, security politike",
    icon: "🏢",
    color: "purple",
    category: "system",
    action: "organization",
  },
  {
    id: "enterprise",
    name: "Enterprise Security",
    description: "Audit logovi, SSO/SAML, enkripcija, compliance, private deployment",
    icon: "🏭",
    color: "red",
    category: "system",
    action: "enterprise",
  },
  {
    id: "plugins",
    name: "Plugin Manager",
    description: "Custom plugini, adapteri, UI dodaci, SDK — ekosistem proširenja",
    icon: "🧩",
    color: "blue",
    category: "system",
    action: "plugins",
  },
  {
    id: "marketplace",
    name: "Marketplace",
    description: "Community template-i, agenti, promptovi, MCP serveri, radni okviri",
    icon: "🏪",
    color: "green",
    category: "system",
    action: "marketplace",
  },
  {
    id: "scale",
    name: "Global Scale & HA",
    description: "Runtime nodovi, load balancer, failover, auto-scaling",
    icon: "🌍",
    color: "red",
    category: "system",
    action: "scale",
  },
];

// ── API ──

export async function getHomeStats(): Promise<HomeCenterStats> {
  return api("/home-center/stats");
}
