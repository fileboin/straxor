import { api } from "./api.js";

export interface McpServer {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  icon: string;
  category: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  tools: string[];
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface McpPreset {
  name: string;
  description: string;
  icon: string;
  category: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  isEnabled: boolean;
}

export type McpCategory = "web" | "data" | "docs" | "system" | "git" | "communication" | "ai" | "custom";

export const MCP_CATEGORIES: { id: McpCategory; label: string; icon: string; color: string }[] = [
  { id: "web", label: "Web", icon: "🌐", color: "blue" },
  { id: "data", label: "Data", icon: "🗄", color: "orange" },
  { id: "docs", label: "Dokumentacija", icon: "📖", color: "purple" },
  { id: "system", label: "Sistem", icon: "⚙", color: "red" },
  { id: "git", label: "Git", icon: "🐙", color: "green" },
  { id: "communication", label: "Komunikacija", icon: "💬", color: "yellow" },
  { id: "ai", label: "AI", icon: "🧠", color: "pink" },
  { id: "custom", label: "Custom", icon: "🔌", color: "gray" },
];

export async function listMcpServers(): Promise<McpServer[]> {
  return api("/mcp-marketplace");
}

export async function getMcpPresets(): Promise<McpPreset[]> {
  return api("/mcp-marketplace/presets");
}

export async function addMcpServer(data: {
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  tools?: string[];
  isEnabled?: boolean;
}): Promise<McpServer> {
  return api("/mcp-marketplace", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMcpServer(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    icon: string;
    category: string;
    command: string;
    args: string[];
    env: Record<string, string>;
    tools: string[];
    isEnabled: boolean;
  }>
): Promise<McpServer> {
  return api(`/mcp-marketplace/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteMcpServer(id: string): Promise<void> {
  await api(`/mcp-marketplace/${id}`, { method: "DELETE" });
}
