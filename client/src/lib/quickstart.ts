import { api } from "./api.js";

export type QuickStartId =
  | "landing-page"
  | "dashboard"
  | "crm"
  | "marketplace"
  | "saas"
  | "blog"
  | "portfolio"
  | "mobile-app";

export interface QuickStartDependency {
  name: string;
  version: string;
}

export interface QuickStartTemplate {
  id: QuickStartId;
  name: string;
  description: string;
  detailedDescription: string;
  icon: string;
  color: string;
  category: "web" | "app" | "business";
  framework: string;
  installCommand: string;
  devCommand: string;
  buildCommand?: string;
  port: number;
  dependencies: QuickStartDependency[];
  devDependencies?: QuickStartDependency[];
}

export interface ScaffoldResult {
  success: boolean;
  projectDir: string;
  error?: string;
}

export interface DevServerStatus {
  running: boolean;
  port: number;
  pid?: number;
  url?: string;
}

const FORMAT_COLORS: Record<string, string> = {
  "React + Vite + Tailwind": "text-blue-400",
  "React + Vite + Tailwind + Recharts": "text-green-400",
};

const FORMAT_BG: Record<string, string> = {
  "React + Vite + Tailwind": "bg-blue-500/10",
  "React + Vite + Tailwind + Recharts": "bg-green-500/10",
};

export function getFrameworkLabel(fw: string): string {
  return fw;
}

export function getFrameworkColor(fw: string): string {
  return FORMAT_COLORS[fw] || "text-text-muted";
}

export function getFrameworkBg(fw: string): string {
  return FORMAT_BG[fw] || "bg-surface-3";
}

export async function listTemplates(): Promise<QuickStartTemplate[]> {
  return api("/quickstart/templates");
}

export async function scaffoldProject(
  templateId: QuickStartId,
  projectName: string,
  sshConfig: Record<string, unknown> | null,
  targetDir?: string
): Promise<ScaffoldResult> {
  return api("/quickstart/scaffold", {
    method: "POST",
    body: JSON.stringify({ templateId, projectName, sshConfig, targetDir }),
  });
}

export async function startDevServer(
  projectDir: string,
  templateId: QuickStartId,
  projectName: string,
  sshConfig: Record<string, unknown> | null
): Promise<DevServerStatus> {
  return api("/quickstart/start-dev", {
    method: "POST",
    body: JSON.stringify({ projectDir, templateId, projectName, sshConfig }),
  });
}

export async function stopDevServer(projectDir: string): Promise<{ success: boolean }> {
  return api("/quickstart/stop-dev", {
    method: "POST",
    body: JSON.stringify({ projectDir }),
  });
}

export async function getDevStatus(projectDir: string): Promise<DevServerStatus> {
  return api("/quickstart/dev-status", {
    method: "POST",
    body: JSON.stringify({ projectDir }),
  });
}
