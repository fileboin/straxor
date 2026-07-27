import { db } from "../../db/index.js";
import { deployments, deploymentBuildLogs } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import type {
  DeploymentAdapter,
  Deployment,
  DeploymentStatus,
  DeploymentTarget,
  BuildLogEntry,
  DeployParams,
} from "./adapter.js";

function rowToDeployment(row: typeof deployments.$inferSelect): Deployment {
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId,
    target: row.target as DeploymentTarget,
    status: row.status as DeploymentStatus,
    liveUrl: row.liveUrl,
    branch: row.branch,
    commitHash: row.commitHash,
    commitMessage: row.commitMessage,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    duration: row.duration,
    createdAt: row.createdAt,
  };
}

export function createDbDeploymentAdapter(): DeploymentAdapter {
  return {
    async deploy(projectId, params) {
      // Get userId from the first env lookup or use a system user
      // For now, we'll need userId passed via context — use a workaround
      throw new Error("deploy requires userId — use bound adapter");
    },

    async getStatus(deploymentId) {
      const [row] = await db
        .select()
        .from(deployments)
        .where(eq(deployments.id, deploymentId))
        .limit(1);

      if (!row) throw new Error("Deployment not found");
      return rowToDeployment(row);
    },

    async getBuildLog(deploymentId) {
      const rows = await db
        .select()
        .from(deploymentBuildLogs)
        .where(eq(deploymentBuildLogs.deploymentId, deploymentId))
        .orderBy(deploymentBuildLogs.timestamp);

      return rows.map((r) => ({
        timestamp: r.timestamp,
        level: r.level as "info" | "warn" | "error",
        message: r.message,
      }));
    },

    async stop(deploymentId) {
      await db
        .update(deployments)
        .set({ status: "stopped", finishedAt: new Date() })
        .where(eq(deployments.id, deploymentId));
    },

    async listByProject(projectId) {
      const rows = await db
        .select()
        .from(deployments)
        .where(eq(deployments.projectId, projectId))
        .orderBy(desc(deployments.createdAt))
        .limit(50);

      return rows.map(rowToDeployment);
    },
  };
}

export function createBoundDeploymentAdapter(userId: string) {
  const base = createDbDeploymentAdapter();

  async function addBuildLog(
    deploymentId: string,
    level: "info" | "warn" | "error",
    message: string
  ) {
    await db.insert(deploymentBuildLogs).values({
      deploymentId,
      level,
      message,
    });
  }

  return {
    ...base,

    async deploy(projectId: string, params: DeployParams) {
      // Create deployment record
      const [row] = await db
        .insert(deployments)
        .values({
          projectId,
          userId,
          target: params.target,
          status: "building",
          branch: params.branch || "main",
          startedAt: new Date(),
        })
        .returning();

      const deployment = rowToDeployment(row);

      // Log build start
      await addBuildLog(deployment.id, "info", `Deployment started — target: ${params.target}, branch: ${deployment.branch}`);

      // In a real implementation, this would trigger the actual deploy
      // via the target platform's API (Render, Vercel, etc.)
      // For now, mark as running after a short simulated build
      await addBuildLog(deployment.id, "info", "Build queued — awaiting adapter implementation");

      // Mark as stopped (stub — no real deploy)
      await db
        .update(deployments)
        .set({
          status: "stopped",
          finishedAt: new Date(),
          duration: 0,
        })
        .where(eq(deployments.id, deployment.id));

      await addBuildLog(deployment.id, "info", "Stub mode — no target adapter configured");

      return {
        ...deployment,
        status: "stopped" as const,
        finishedAt: new Date(),
        duration: 0,
      };
    },

    async listByProject(projectId: string) {
      return base.listByProject(projectId);
    },

    async getStatus(deploymentId: string) {
      return base.getStatus(deploymentId);
    },

    async getBuildLog(deploymentId: string) {
      return base.getBuildLog(deploymentId);
    },

    async stop(deploymentId: string) {
      return base.stop(deploymentId);
    },
  };
}

export type BoundDeploymentAdapter = ReturnType<typeof createBoundDeploymentAdapter>;
