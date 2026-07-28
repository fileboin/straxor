import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { deployments, deploymentBuildLogs } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { createBoundDeploymentAdapter } from "../adapters/deployment/db.js";
import type { DeploymentTarget } from "../adapters/deployment/types.js";
import { configureProvider, getProviderConfig, isProviderConfigured, TARGET_META } from "../adapters/deployment/registry.js";

const router = Router();

// ── Provider config ──

// GET /api/deployments/providers — list all providers with config status
router.get("/providers", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const result = Object.entries(TARGET_META).map(([id, meta]) => ({
    id,
    name: meta.name,
    icon: meta.icon,
    color: meta.color,
    configured: isProviderConfigured(userId, id as DeploymentTarget),
  }));
  res.json(result);
});

// GET /api/deployments/providers/:target — get provider config
router.get("/providers/:target", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const target = req.params.target as DeploymentTarget;
  const config = getProviderConfig(userId, target);
  const meta = TARGET_META[target];
  res.json({
    configured: !!config && Object.keys(config).length > 0,
    fields: Object.entries(config || {}).map(([key, value]) => ({ key, value: meta?.configFields.find(f => f.key === key)?.secret ? "••••••" : value })),
  });
});

// POST /api/deployments/providers/:target — configure provider
router.post("/providers/:target", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const target = req.params.target as DeploymentTarget;
  const { config } = req.body as { config: Record<string, string> };

  configureProvider(userId, target, config || {});

  res.json({ target, configured: isProviderConfigured(userId, target) });
});

// ── Existing deployment endpoints ──

// GET /api/deployments/:projectId — list deployments for project
router.get("/:projectId", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const projectId = req.params.projectId as string;

  try {
    const rows = await db
      .select()
      .from(deployments)
      .where(and(eq(deployments.projectId, projectId), eq(deployments.userId, userId)))
      .orderBy(desc(deployments.createdAt))
      .limit(50);

    res.json(
      rows.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        target: r.target,
        status: r.status,
        liveUrl: r.liveUrl,
        branch: r.branch,
        commitHash: r.commitHash,
        commitMessage: r.commitMessage,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        duration: r.duration,
        createdAt: r.createdAt,
      }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/deployments/:projectId — trigger deployment
router.post("/:projectId", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const projectId = req.params.projectId as string;
  const { target, branch, envVars } = req.body as {
    target: DeploymentTarget;
    branch?: string;
    envVars?: Record<string, string>;
  };

  if (!target) {
    res.status(400).json({ error: "target is required" });
    return;
  }

  try {
    const adapter = createBoundDeploymentAdapter(userId);
    const deployment = await adapter.deploy(projectId, { target, branch, envVars });
    res.status(201).json(deployment);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/deployments/detail/:deploymentId — get single deployment
router.get("/detail/:deploymentId", async (req: Request, res: Response) => {
  const deploymentId = req.params.deploymentId as string;

  try {
    const [row] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, deploymentId))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Deployment not found" });
      return;
    }

    res.json({
      id: row.id,
      projectId: row.projectId,
      target: row.target,
      status: row.status,
      liveUrl: row.liveUrl,
      branch: row.branch,
      commitHash: row.commitHash,
      commitMessage: row.commitMessage,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      duration: row.duration,
      createdAt: row.createdAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/deployments/log/:deploymentId — get build log
router.get("/log/:deploymentId", async (req: Request, res: Response) => {
  const deploymentId = req.params.deploymentId as string;

  try {
    const rows = await db
      .select()
      .from(deploymentBuildLogs)
      .where(eq(deploymentBuildLogs.deploymentId, deploymentId))
      .orderBy(deploymentBuildLogs.timestamp);

    res.json(
      rows.map((r) => ({
        timestamp: r.timestamp,
        level: r.level,
        message: r.message,
      }))
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/deployments/stop/:deploymentId — stop deployment
router.post("/stop/:deploymentId", async (req: Request, res: Response) => {
  const deploymentId = req.params.deploymentId as string;

  try {
    const adapter = createBoundDeploymentAdapter((req as any).userId as string);
    await adapter.stop(deploymentId);
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
