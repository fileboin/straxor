export type DeploymentStatus = "building" | "running" | "failed" | "stopped";

export type DeploymentTarget =
  | "vps"
  | "docker"
  | "coolify"
  | "dokploy"
  | "caprover"
  | "render"
  | "railway"
  | "flyio"
  | "digitalocean"
  | "vercel"
  | "netlify"
  | "cloudflare";

export interface Deployment {
  id: string;
  projectId: string;
  userId: string;
  target: DeploymentTarget;
  status: DeploymentStatus;
  liveUrl: string | null;
  branch: string;
  commitHash: string | null;
  commitMessage: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  duration: number | null;
  createdAt: Date;
}

export interface BuildLogEntry {
  timestamp: Date;
  level: "info" | "warn" | "error";
  message: string;
}

export interface DeployParams {
  target: DeploymentTarget;
  branch?: string;
  envVars?: Record<string, string>;
}

export interface DeploymentProvider {
  readonly platform: DeploymentTarget;
  readonly name: string;
  isConfigured(): boolean;
  configure(config: Record<string, string>): void;
  deploy(projectId: string, params: DeployParams, addLog: (level: "info" | "warn" | "error", msg: string) => Promise<void>): Promise<{ status: DeploymentStatus; liveUrl: string | null }>;
  getStatus(externalId: string): Promise<{ status: DeploymentStatus; liveUrl: string | null }>;
  stop(externalId: string): Promise<void>;
}

export type { DeploymentAdapter } from "./adapter.js";
