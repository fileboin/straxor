export type DeploymentStatus = "building" | "running" | "failed" | "stopped";
export type DeploymentTarget = "vps" | "docker" | "render" | "railway" | "vercel" | "netlify" | "cloudflare";

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

export interface DeploymentAdapter {
  deploy(projectId: string, params: DeployParams): Promise<Deployment>;
  getStatus(deploymentId: string): Promise<Deployment>;
  getBuildLog(deploymentId: string): Promise<BuildLogEntry[]>;
  stop(deploymentId: string): Promise<void>;
  listByProject(projectId: string): Promise<Deployment[]>;
}
