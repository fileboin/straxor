export type AgentRole = "developer" | "designer" | "qa" | "security" | "marketing";

export interface RoleConfig {
  id: AgentRole;
  label: string;
  icon: string;
  color: string;
  description: string;
  systemPrompt: string;
}

export interface SavedPrompt {
  id: string;
  userId: string;
  projectId?: string;
  name: string;
  content: string;
  category: "rule" | "instruction" | "context" | "template";
  isGlobal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptCategory {
  id: string;
  label: string;
  icon: string;
}

export const ROLES: RoleConfig[] = [
  {
    id: "developer",
    label: "Developer",
    icon: "⌨",
    color: "accent-blue",
    description: "Fokus na kod, arhitekturu, implementaciju",
    systemPrompt: "Ti si senior softverski developer. Piši čist, održiv i dobro dokumentovan kod. Slijedi best practices, koristi tipove, piši testove. Razmišljaj o performansama i sigurnosti.",
  },
  {
    id: "designer",
    label: "Designer",
    icon: "◆",
    color: "accent",
    description: "Fokus na UI/UX, dizajn sisteme, pristupačnost",
    systemPrompt: "Ti si UI/UX dizajner. Fokusiraj se na korisničko iskustvo, vizuelni dizajn, pristupačnost (WCAG), konzistentnost dizajn sistema. Razmišljaj o mobilnom first pristupu.",
  },
  {
    id: "qa",
    label: "QA",
    icon: "◉",
    color: "accent-yellow",
    description: "Fokus na testove, bugove, kvalitet",
    systemPrompt: "Ti si QA inženjer. Fokusiraj se na pronalaženje bugova, pisanje testova, edge case-ove, regresione. Razmišljaj o tome kako bi korisnik mogao pokvariti aplikaciju.",
  },
  {
    id: "security",
    label: "Security",
    icon: "⬡",
    color: "accent-red",
    description: "Fokus na sigurnost, ranjivosti, zaštitu",
    systemPrompt: "Ti si sigurnosni stručnjak. Analiziraj kod za ranjivosti (XSS, SQL injection, CSRF, itd.). Provjeri autentikaciju, autorizaciju, enkripciju. Daj konkretne preporuke za poboljšanje.",
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: "▲",
    color: "accent-orange",
    description: "Fokus na sadržaj, SEO, copy, konverziju",
    systemPrompt: "Ti si marketing stručnjak. Piši uvjerljiv sadržaj, optimiziraj za SEO, fokusiraj se na konverziju i korisničku putanju. Razmišljaj o brand glasu i ciljanoj publici.",
  },
];

export const PROMPT_CATEGORIES: PromptCategory[] = [
  { id: "rule", label: "Pravila", icon: "⚖" },
  { id: "instruction", label: "Instrukcije", icon: "📋" },
  { id: "context", label: "Kontekst", icon: "◉" },
  { id: "template", label: "Šabloni", icon: "📝" },
];

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Prompts API ──

export async function fetchPrompts(projectId?: string): Promise<SavedPrompt[]> {
  try {
    const query = projectId ? `?projectId=${projectId}` : "";
    const res = await fetch(`${API_BASE}/api/prompts${query}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function createPrompt(data: {
  name: string;
  content: string;
  category: string;
  projectId?: string;
  isGlobal?: boolean;
}): Promise<SavedPrompt> {
  const res = await fetch(`${API_BASE}/api/prompts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create prompt");
  return res.json();
}

export async function updatePrompt(
  id: string,
  data: { name?: string; content?: string; category?: string; isGlobal?: boolean }
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/prompts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update prompt");
}

export async function deletePrompt(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/prompts/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

// ── Helpers ──

export function getRoleById(id: AgentRole): RoleConfig {
  return ROLES.find((r) => r.id === id) || ROLES[0];
}

export function getRoleColor(roleId: AgentRole): string {
  const role = getRoleById(roleId);
  return role.color;
}
