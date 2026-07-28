import { db } from "../../db/index.js";
import { deployments, deploymentBuildLogs } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";
import type { DeploymentAdapter } from "./adapter.js";
import type { Deployment, DeploymentStatus, DeploymentTarget, BuildLogEntry, DeployParams } from "./types.js";
import { getProvider } from "./registry.js";

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
    async deploy(_projectId, _params) {
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
    await db.insert(deploymentBuildLogs).values({ deploymentId, level, message });
  }

  return {
    ...base,

    async deploy(projectId: string, params: DeployParams) {
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

      await addBuildLog(deployment.id, "info", `Deployment started — target: ${params.target}, branch: ${deployment.branch}`);

      const provider = getProvider(params.target);
      if (!provider || !provider.isConfigured()) {
        await addBuildLog(deployment.id, "warn", `No provider configured for "${params.target}" — marking as stopped`);
        await db
          .update(deployments)
          .set({ status: "stopped", finishedAt: new Date(), duration: 0 })
          .where(eq(deployments.id, deployment.id));
        return { ...deployment, status: "stopped" as const, finishedAt: new Date(), duration: 0 };
      }

      try {
        const logFn = (level: "info" | "warn" | "error", msg: string) => addBuildLog(deployment.id, level, msg);
        const result = await provider.deploy(projectId, params, logFn);

        let status = result.status;
        let liveUrl = result.liveUrl;

        if (status === "running") {
          // Poll for completion up to 5 min
          const providerId = deployment.id; // use as externalId
          for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 10000));
            try {
              const st = await provider.getStatus(providerId);
              status = st.status;
              if (st.liveUrl) liveUrl = st.liveUrl;
              if (status === "running" || status === "failed" || status === "stopped") break;
            } catch {
              break;
            }
          }
        }

        await db
          .update(deployments)
          .set({
            status,
            liveUrl,
            finishedAt: status === "running" || status === "failed" || status === "stopped" ? new Date() : null,
            duration: Math.round((Date.now() - deployment.startedAt.getTime()) / 1000),
          })
          .where(eq(deployments.id, deployment.id));

        await addBuildLog(deployment.id, "info", `Deployment finished — status: ${status}${liveUrl ? `, URL: ${liveUrl}` : ""}`);

        return {
          ...deployment,
          status: status as DeploymentStatus,
          liveUrl,
          finishedAt: new Date(),
          duration: Math.round((Date.now() - deployment.startedAt.getTime()) / 1000),
        };
      } catch (err: any) {
        await addBuildLog(deployment.id, "error", `Deployment failed: ${err.message}`);
        await db
          .update(deployments)
          .set({ status: "failed", finishedAt: new Date() })
          .where(eq(deployments.id, deployment.id));
        return { ...deployment, status: "failed" as const, finishedAt: new Date(), duration: 0 };
      }
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
      const [row] = await db
        .select()
        .from(deployments)
        .where(eq(deployments.id, deploymentId))
        .limit(1);
      if (row) {
        const provider = getProvider(row.target as DeploymentTarget);
        if (provider && provider.isConfigured()) {
          try { await provider.stop(deploymentId); } catch {}
        }
      }
      return base.stop(deploymentId);
    },
  };
}

export type BoundDeploymentAdapter = ReturnType<typeof createBoundDeploymentAdapter>;
