const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type ScannerId = "socket" | "osv" | "github-advisory" | "npm-audit" | "pip-audit" | "osv-scanner";

export interface ScannerInfo {
  id: ScannerId;
  name: string;
  available: boolean;
}

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Vulnerability {
  id: string;
  summary: string;
  severity: Severity;
  packageName: string;
  installedVersion: string;
  patchedVersions?: string;
  url?: string;
  cve?: string;
  source: ScannerId;
}

export interface ScanVerdict {
  safe: boolean;
  verdict: "allow" | "warn" | "block";
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  vulnerabilities: Vulnerability[];
  scannersUsed: Array<{
    name: string;
    success: boolean;
    found: number;
  }>;
  scannedAt: string;
}

export async function fetchScanners(): Promise<ScannerInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/api/security/scanners`, {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function checkBeforeInstall(
  packageName: string,
  version: string | undefined,
  ecosystem: string,
  machineId?: string
): Promise<ScanVerdict> {
  const res = await fetch(`${API_BASE}/api/security/check-before-install`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ packageName, version, ecosystem, machineId }),
  });
  if (!res.ok) throw new Error("Security check failed");
  return res.json();
}

export async function scanPackages(
  ecosystem: string,
  packages: Array<{ name: string; version: string }>,
  scanners?: ScannerId[],
  machineId?: string
): Promise<ScanVerdict> {
  const res = await fetch(`${API_BASE}/api/security/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ ecosystem, packages, scanners, machineId }),
  });
  if (!res.ok) throw new Error("Security scan failed");
  return res.json();
}

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-blue-400",
  info: "text-text-muted",
};

export const SEVERITY_BG: Record<Severity, string> = {
  critical: "bg-red-500/10 border-red-500/30",
  high: "bg-orange-500/10 border-orange-500/30",
  medium: "bg-yellow-500/10 border-yellow-500/30",
  low: "bg-blue-500/10 border-blue-500/30",
  info: "bg-surface-2 border-border",
};

export const VERDICT_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  allow: { label: "Sigurno", color: "text-green-400", icon: "✓" },
  warn: { label: "Upozorenje", color: "text-yellow-400", icon: "⚠" },
  block: { label: "Blokirano", color: "text-red-400", icon: "⛔" },
};
