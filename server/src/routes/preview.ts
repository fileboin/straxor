import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";
import { createVPSPreviewAdapter } from "../adapters/preview/vps.js";
import type { PreviewTarget } from "../adapters/preview/adapter.js";
import {
  detectLocalFramework,
  getPreviewInfo,
  getPreviewLogs,
  previewKey,
  refreshPreviewStatus,
  restartPreview,
  startPreview,
  stopPreview,
} from "../runtime/local/preview.js";
import { getRepoWorkspaceDir } from "../runtime/local/workspace.js";

const router = Router();

function getPreview(userId: string) {
  const runtime = getAdapters().runtime(userId);
  const exec = (machineId: string, cmd: string) => runtime.executeCommand(machineId, cmd);
  return createVPSPreviewAdapter(exec);
}

// POST /api/preview/start — start preview (target: "vps" | "local")
router.post("/start", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.userId ?? req.userId;
    const { machineId, target, port, rootPath, framework, buildCommand, devCommand, envVars, owner, name, taskId, args } = req.body;

    if ((target as PreviewTarget) === "local") {
      if (!owner || !name) {
        return res.status(400).json({ error: "owner and name are required for a local preview" });
      }
      const info = await startPreview({
        userId,
        owner,
        name,
        taskId: taskId ?? null,
        command: typeof devCommand === "string" ? devCommand : undefined,
        args: Array.isArray(args) ? args : undefined,
        port: typeof port === "number" ? port : undefined,
        env: envVars,
      });
      return res.json(info);
    }

    if (!machineId) return res.status(400).json({ error: "machineId required" });

    const preview = getPreview(userId);
    const status = await preview.start({
      machineId,
      target: (target as PreviewTarget) || "vps",
      port,
      rootPath,
      framework,
      buildCommand,
      devCommand,
      envVars,
    });

    res.json(status);
  } catch (error: any) {
    console.error("Preview start error:", error);
    res.status(500).json({ error: error.message || "Failed to start preview" });
  }
});

// POST /api/preview/stop — stop preview
router.post("/stop", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.userId ?? req.userId;
    const { machineId, target, owner, name, taskId } = req.body;

    if ((target as PreviewTarget) === "local") {
      if (!owner || !name) {
        return res.status(400).json({ error: "owner and name are required for a local preview" });
      }
      const info = await stopPreview(previewKey(userId, owner, name, taskId ?? null));
      return res.json({ success: !!info, state: info?.state ?? null });
    }

    if (!machineId) return res.status(400).json({ error: "machineId required" });

    const preview = getPreview(userId);
    await preview.stop(machineId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Preview stop error:", error);
    res.status(500).json({ error: error.message || "Failed to stop preview" });
  }
});

// POST /api/preview/restart — restart preview
router.post("/restart", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.userId ?? req.userId;
    const { owner, name, taskId, devCommand, args, port, envVars } = req.body;
    if (!owner || !name) {
      return res.status(400).json({ error: "owner and name are required for a local preview" });
    }
    const info = await restartPreview({
      userId,
      owner,
      name,
      taskId: taskId ?? null,
      command: typeof devCommand === "string" ? devCommand : undefined,
      args: Array.isArray(args) ? args : undefined,
      port: typeof port === "number" ? port : undefined,
      env: envVars,
    });
    res.json(info);
  } catch (error: any) {
    console.error("Preview restart error:", error);
    res.status(500).json({ error: error.message || "Failed to restart preview" });
  }
});

// GET /api/preview/status — get preview status
router.get("/status", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.userId ?? req.userId;
    const { machineId, target, owner, name, taskId } = req.query;

    if ((target as PreviewTarget) === "local") {
      if (!owner || !name) {
        return res.status(400).json({ error: "owner and name are required for a local preview" });
      }
      const info = await refreshPreviewStatus(previewKey(userId, owner, name, taskId ?? null));
      if (!info) return res.status(404).json({ error: "No local preview for this task" });
      return res.json(info);
    }

    if (!machineId) return res.status(400).json({ error: "machineId required" });

    const preview = getPreview(userId);
    const status = await preview.getStatus(machineId);
    res.json(status);
  } catch (error: any) {
    console.error("Preview status error:", error);
    res.status(500).json({ error: error.message || "Failed to get status" });
  }
});

// GET /api/preview/logs — get preview logs
router.get("/logs", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.userId ?? req.userId;
    const { machineId, target, owner, name, taskId, limit } = req.query;

    if ((target as PreviewTarget) === "local") {
      if (!owner || !name) {
        return res.status(400).json({ error: "owner and name are required for a local preview" });
      }
      const lines = getPreviewLogs(previewKey(userId, owner, name, taskId ?? null), limit ? parseInt(limit, 10) : undefined);
      return res.json(lines.map((line, i) => ({ timestamp: Date.now() - (lines.length - i), level: "stdout", message: line })));
    }

    if (!machineId) return res.status(400).json({ error: "machineId required" });

    const preview = getPreview(userId);
    const logs = await preview.getLogs(machineId, limit ? parseInt(limit, 10) : undefined);
    res.json(logs);
  } catch (error: any) {
    console.error("Preview logs error:", error);
    res.status(500).json({ error: error.message || "Failed to get logs" });
  }
});

// GET /api/preview/framework — detect framework
router.get("/framework", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.userId ?? req.userId;
    const { machineId, target, owner, name, rootPath } = req.query;

    if ((target as PreviewTarget) === "local") {
      if (!owner || !name) {
        return res.status(400).json({ error: "owner and name are required for a local preview" });
      }
      const cwd = getRepoWorkspaceDir(userId, owner, name);
      const framework = await detectLocalFramework(cwd);
      return res.json({ framework });
    }

    if (!machineId) return res.status(400).json({ error: "machineId required" });

    const preview = getPreview(userId);
    const framework = await preview.getFramework(machineId, rootPath);
    res.json({ framework });
  } catch (error: any) {
    console.error("Framework detection error:", error);
    res.status(500).json({ error: error.message || "Failed to detect framework" });
  }
});

export default router;
