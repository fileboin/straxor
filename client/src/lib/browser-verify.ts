const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type BrowserCheckName =
  | "page_load"
  | "no_js_errors"
  | "no_5xx"
  | "forms_work"
  | "screenshot";

export interface BrowserCheckResult {
  name: BrowserCheckName;
  passed: boolean;
  evidence: string;
  screenshot?: string;
  consoleErrors?: string[];
  networkErrors?: string[];
  duration?: number;
}

export interface ScreenshotEntry {
  name: string;
  data: string;
  timestamp: string;
  viewport?: { width: number; height: number };
}

export interface BrowserVerificationResult {
  id: string;
  url: string;
  checks: BrowserCheckResult[];
  screenshots: ScreenshotEntry[];
  overallPassed: boolean;
  timestamp: string;
}

export interface FormInteraction {
  selector: string;
  value: string;
  submit?: boolean;
}

export const BROWSER_CHECK_LABELS: Record<BrowserCheckName, string> = {
  page_load: "Učitavanje",
  no_js_errors: "JS Greške",
  no_5xx: "5xx Status",
  forms_work: "Forme",
  screenshot: "Screenshot",
};

export const BROWSER_CHECK_ICONS: Record<BrowserCheckName, string> = {
  page_load: "🌐",
  no_js_errors: "🐛",
  no_5xx: "⚠️",
  forms_work: "📝",
  screenshot: "📸",
};

export async function runBrowserVerification(
  machineId: string,
  url: string,
  checks?: BrowserCheckName[],
  viewport?: { width: number; height: number },
  waitFor?: number,
  forms?: FormInteraction[],
  screenshotNames?: string[]
): Promise<BrowserVerificationResult> {
  const res = await fetch(`${API_BASE}/api/browser-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      machineId,
      url,
      checks,
      viewport,
      waitFor,
      forms,
      screenshotNames,
    }),
  });
  if (!res.ok) throw new Error("Browser verification failed");
  return res.json();
}

export async function takeScreenshot(
  machineId: string,
  url: string,
  name?: string,
  viewport?: { width: number; height: number }
): Promise<ScreenshotEntry> {
  const res = await fetch(`${API_BASE}/api/browser-verify/screenshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ machineId, url, name, viewport }),
  });
  if (!res.ok) throw new Error("Screenshot failed");
  return res.json();
}
