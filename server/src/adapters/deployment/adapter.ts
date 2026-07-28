// Re-export all types from the new types module for backward compatibility.
export type {
  DeploymentStatus,
  DeploymentTarget,
  Deployment,
  BuildLogEntry,
  DeployParams,
} from "./types.js";

export interface DeploymentAdapter {
  deploy(projectId: string, params: import("./types.js").DeployParams): Promise<import("./types.js").Deployment>;
  getStatus(deploymentId: string): Promise<import("./types.js").Deployment>;
  getBuildLog(deploymentId: string): Promise<import("./types.js").BuildLogEntry[]>;
  stop(deploymentId: string): Promise<void>;
  listByProject(projectId: string): Promise<import("./types.js").Deployment[]>;
}
