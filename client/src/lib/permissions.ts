export type PermissionLevel = "always" | "ask" | "never";

export interface ToolPermission {
  toolId: string;
  level: PermissionLevel;
  label: string;
  description: string;
  category: "file" | "command" | "data" | "network" | "package";
  risk: "low" | "medium" | "high" | "critical";
}

export interface PermissionConfig {
  [toolId: string]: PermissionLevel;
}

export const TOOLS: Omit<ToolPermission, "level">[] = [
  {
    toolId: "write_file",
    label: "Write File",
    description: "Kreira ili mijenja sadržaj datoteke",
    category: "file",
    risk: "high",
  },
  {
    toolId: "delete_file",
    label: "Delete File",
    description: "Briše datoteku sa diska",
    category: "file",
    risk: "critical",
  },
  {
    toolId: "read_file",
    label: "Read File",
    description: "Čita sadržaj datoteke",
    category: "file",
    risk: "low",
  },
  {
    toolId: "execute_command",
    label: "Execute Command",
    description: "Izvršava shell komandu na VPS-u",
    category: "command",
    risk: "critical",
  },
  {
    toolId: "install_package",
    label: "Install Package",
    description: "Instalira npm/pip/apt paket",
    category: "package",
    risk: "high",
  },
  {
    toolId: "database_query",
    label: "Database Query",
    description: "Izvršava SQL upit ili migraciju",
    category: "data",
    risk: "high",
  },
  {
    toolId: "web_search",
    label: "Web Search",
    description: "Pretražuje internet",
    category: "network",
    risk: "low",
  },
  {
    toolId: "web_fetch",
    label: "Web Fetch",
    description: "Preuzima sadržaj sa URL-a",
    category: "network",
    risk: "medium",
  },
];

const RISK_COLORS: Record<string, string> = {
  low: "text-green-400",
  medium: "text-yellow-400",
  high: "text-orange-400",
  critical: "text-red-400",
};

const RISK_BG: Record<string, string> = {
  low: "bg-green-500/10",
  medium: "bg-yellow-500/10",
  high: "bg-orange-500/10",
  critical: "bg-red-500/10",
};

export { RISK_COLORS, RISK_BG };

const CATEGORY_ICONS: Record<string, string> = {
  file: "📄",
  command: "⌘",
  data: "◈",
  network: "◉",
  package: "📦",
};

export { CATEGORY_ICONS };

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchPermissions(): Promise<PermissionConfig> {
  try {
    const res = await fetch(`${API_BASE}/api/permissions`, {
      headers: authHeaders(),
    });
    if (!res.ok) return getDefaultPermissions();
    const data = await res.json();
    return { ...getDefaultPermissions(), ...data };
  } catch {
    return getDefaultPermissions();
  }
}

export async function savePermissions(config: PermissionConfig): Promise<void> {
  const res = await fetch(`${API_BASE}/api/permissions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to save permissions");
}

export async function checkToolPermission(
  toolId: string
): Promise<{ allowed: boolean; level: PermissionLevel }> {
  try {
    const res = await fetch(`${API_BASE}/api/permissions/check/${toolId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return { allowed: false, level: "ask" };
    return res.json();
  } catch {
    return { allowed: false, level: "ask" };
  }
}

export function getDefaultPermissions(): PermissionConfig {
  const config: PermissionConfig = {};
  for (const tool of TOOLS) {
    config[tool.toolId] = "ask";
  }
  return config;
}

export function getPermissionLabel(level: PermissionLevel): string {
  switch (level) {
    case "always":
      return "Auto-odobri";
    case "ask":
      return "Pitaj me";
    case "never":
      return "Blokiraj";
  }
}

export function getPermissionColor(level: PermissionLevel): string {
  switch (level) {
    case "always":
      return "text-green-400";
    case "ask":
      return "text-yellow-400";
    case "never":
      return "text-red-400";
  }
}

export function getPermissionBg(level: PermissionLevel): string {
  switch (level) {
    case "always":
      return "bg-green-500/10 border-green-500/30";
    case "ask":
      return "bg-yellow-500/10 border-yellow-500/30";
    case "never":
      return "bg-red-500/10 border-red-500/30";
  }
}
