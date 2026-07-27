const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type CheckName = "build" | "tests" | "diff" | "errors" | "files";

export interface CheckResult {
  name: CheckName;
  passed: boolean;
  evidence: string;
  duration?: number;
}

export interface VerificationResult {
  id: string;
  stepId: string;
  machineId: string;
  sessionId: string;
  overallPassed: boolean;
  checks: CheckResult[];
  timestamp: string;
}

export const CHECK_LABELS: Record<CheckName, string> = {
  build: "Build",
  tests: "Testovi",
  diff: "Git Diff",
  errors: "Greške",
  files: "Datoteke",
};

export const CHECK_ICONS: Record<CheckName, string> = {
  build: "🔨",
  tests: "🧪",
  diff: "📝",
  errors: "🐛",
  files: "📁",
};

export const CHECK_COLORS: Record<CheckName, string> = {
  build: "text-purple-400",
  tests: "text-blue-400",
  diff: "text-yellow-400",
  errors: "text-red-400",
  files: "text-green-400",
};

export async function runVerification(
  machineId: string,
  sessionId: string,
  stepId: string,
  checks?: CheckName[],
  projectPath?: string,
  filePatterns?: string[]
): Promise<VerificationResult> {
  const res = await fetch(`${API_BASE}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      machineId,
      sessionId,
      stepId,
      checks,
      projectPath,
      filePatterns,
    }),
  });
  if (!res.ok) throw new Error("Verification failed");
  return res.json();
}
