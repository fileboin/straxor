import { api } from "./api.js";

// ── Types ──

export type RuleCategory = "general" | "style" | "architecture" | "testing" | "security" | "performance";

export interface ProjectRule {
  id: string;
  projectId: string;
  userId: string;
  name: string;
  content: string;
  category: RuleCategory;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export type MemoryCategory = "general" | "preference" | "decision" | "context" | "fact";

export interface Memory {
  id: string;
  userId: string;
  projectId: string | null;
  key: string;
  content: string;
  category: MemoryCategory;
  source: string;
  isGlobal: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebResearchResult {
  url: string;
  title: string;
  content: string;
  tokenCount: number;
}

export interface ContextSource {
  type: "rules" | "memory" | "files" | "web" | "system" | "search";
  label: string;
  content: string;
  tokenCount: number;
  priority: number;
}

export interface AssembledContext {
  sources: ContextSource[];
  totalTokens: number;
  truncated: boolean;
  systemPrompt: string;
  summary: string;
}

export const RULE_CATEGORIES: { id: RuleCategory; label: string; icon: string }[] = [
  { id: "general", label: "Općenito", icon: "📋" },
  { id: "style", label: "Stil", icon: "🎨" },
  { id: "architecture", label: "Arhitektura", icon: "🏗" },
  { id: "testing", label: "Testiranje", icon: "🧪" },
  { id: "security", label: "Sigurnost", icon: "🔒" },
  { id: "performance", label: "Performanse", icon: "⚡" },
];

export const MEMORY_CATEGORIES: { id: MemoryCategory; label: string; icon: string }[] = [
  { id: "general", label: "Općenito", icon: "📝" },
  { id: "preference", label: "Preferenca", icon: "👤" },
  { id: "decision", label: "Odluka", icon: "⚖" },
  { id: "context", label: "Kontekst", icon: "🔗" },
  { id: "fact", label: "Činjenica", icon: "📌" },
];

export const SOURCE_ICONS: Record<string, string> = {
  rules: "📋",
  memory: "🧠",
  files: "📄",
  web: "🌐",
  system: "⚙",
  search: "🔍",
};

// ── Rules API ──

export async function listRules(projectId: string): Promise<ProjectRule[]> {
  const params = new URLSearchParams({ projectId });
  return api(`/context/rules?${params}`);
}

export async function createRule(projectId: string, name: string, content: string, category: RuleCategory): Promise<ProjectRule> {
  return api("/context/rules", {
    method: "POST",
    body: JSON.stringify({ projectId, name, content, category }),
  });
}

export async function updateRule(id: string, updates: Partial<Pick<ProjectRule, "name" | "content" | "category" | "isActive" | "priority">>): Promise<ProjectRule> {
  return api(`/context/rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function deleteRule(id: string): Promise<void> {
  await api(`/context/rules/${id}`, { method: "DELETE" });
}

// ── Memories API ──

export async function listMemories(projectId?: string): Promise<Memory[]> {
  const params = new URLSearchParams();
  if (projectId) params.set("projectId", projectId);
  return api(`/context/memories?${params}`);
}

export async function createMemory(key: string, content: string, category: MemoryCategory, projectId?: string, isGlobal?: boolean): Promise<Memory> {
  return api("/context/memories", {
    method: "POST",
    body: JSON.stringify({ key, content, category, projectId, isGlobal }),
  });
}

export async function updateMemory(id: string, updates: Partial<Pick<Memory, "key" | "content" | "category" | "isGlobal">>): Promise<Memory> {
  return api(`/context/memories/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function deleteMemory(id: string): Promise<void> {
  await api(`/context/memories/${id}`, { method: "DELETE" });
}

// ── Web Research API ──

export async function fetchUrl(url: string): Promise<WebResearchResult> {
  return api("/context/web/fetch", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function searchWeb(query: string, maxResults?: number): Promise<{ url: string; title: string; snippet: string }[]> {
  return api("/context/web/search", {
    method: "POST",
    body: JSON.stringify({ query, maxResults }),
  });
}

export async function saveWebResearch(url: string, title: string, content: string, summary?: string): Promise<WebResearchResult> {
  return api("/context/web/save", {
    method: "POST",
    body: JSON.stringify({ url, title, content, summary }),
  });
}

export async function listWebHistory(): Promise<WebResearchResult[]> {
  return api("/context/web/history");
}

// ── Context Assembly API ──

export async function assembleContext(params: {
  prompt: string;
  projectId?: string;
  machineId?: string;
  projectPath?: string;
  maxTokens?: number;
}): Promise<AssembledContext> {
  return api("/context/assemble", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function summarizeText(text: string, maxTokens?: number): Promise<{ summarized: string; tokenCount: number }> {
  return api("/context/summarize", {
    method: "POST",
    body: JSON.stringify({ text, maxTokens }),
  });
}

export async function countTokens(text: string): Promise<{ count: number }> {
  return api("/context/count-tokens", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}
