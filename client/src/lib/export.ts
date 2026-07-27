const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type ExportScope = "source" | "assets" | "config" | "docs" | "all";

export interface ExportFileEntry {
  path: string;
  size: number;
  scope: ExportScope;
}

export interface ExportManifest {
  projectName: string;
  exportedAt: string;
  scopes: ExportScope[];
  files: ExportFileEntry[];
  totalSize: number;
  totalFiles: number;
}

export interface ExportResult {
  success: boolean;
  manifest: ExportManifest;
  downloadUrl: string;
  fileSize: number;
  error?: string;
}

export const EXPORT_SCOPES: Array<{
  id: ExportScope;
  label: string;
  icon: string;
  description: string;
}> = [
  { id: "source", label: "Izvorni kod", icon: "⌨", description: "Sve .ts, .tsx, .js, .css, .html datoteke" },
  { id: "assets", label: "Resursi", icon: "◆", description: "Slike, fontovi, mediji" },
  { id: "config", label: "Konfiguracija", icon: "⚙", description: "package.json, tsconfig, vite.config, itd." },
  { id: "docs", label: "Dokumentacija", icon: "📄", description: "README, CHANGELOG, docs/ direktorij" },
];

export async function generateExport(
  projectId: string,
  scopes: ExportScope[],
  machineId?: string
): Promise<ExportResult> {
  const res = await fetch(`${API_BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ projectId, scopes, machineId }),
  });
  if (!res.ok) throw new Error("Export failed");
  return res.json();
}

export async function fetchExportManifest(
  projectId: string,
  scopes?: ExportScope[],
  machineId?: string
): Promise<ExportManifest> {
  const query = new URLSearchParams({ projectId });
  if (scopes) query.set("scopes", scopes.join(","));
  if (machineId) query.set("machineId", machineId);

  const res = await fetch(`${API_BASE}/api/export/manifest?${query}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch manifest");
  return res.json();
}

export function getExportDownloadUrl(projectId: string): string {
  const token = localStorage.getItem("token");
  return `${API_BASE}/api/export/download/${projectId}?token=${token}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export const SCOPE_COLORS: Record<ExportScope, string> = {
  source: "text-accent-blue",
  assets: "text-accent",
  config: "text-accent-yellow",
  docs: "text-accent-orange",
  all: "text-text",
};
