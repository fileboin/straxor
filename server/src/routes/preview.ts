import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";
import { createVPSPreviewAdapter } from "../adapters/preview/vps.js";
import type { PreviewTarget, DeviceSize } from "../adapters/preview/adapter.js";

const router = Router();

function getPreview(userId: string) {
  const runtime = getAdapters().runtime(userId);
  const exec = (machineId: string, cmd: string) => runtime.executeCommand(machineId, cmd);
  return createVPSPreviewAdapter(exec);
}

// POST /api/preview/start — start preview
router.post("/start", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, target, port, rootPath, framework, buildCommand, devCommand, envVars } = req.body;

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
    const userId = req.userId;
    const { machineId } = req.body;
    if (!machineId) return res.status(400).json({ error: "machineId required" });

    const preview = getPreview(userId);
    await preview.stop(machineId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Preview stop error:", error);
    res.status(500).json({ error: error.message || "Failed to stop preview" });
  }
});

// GET /api/preview/status — get preview status
router.get("/status", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId } = req.query;
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
    const userId = req.userId;
    const { machineId, limit } = req.query;
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
    const userId = req.userId;
    const { machineId, rootPath } = req.query;
    if (!machineId) return res.status(400).json({ error: "machineId required" });

    const preview = getPreview(userId);
    const framework = await preview.getFramework(machineId, rootPath);
    res.json({ framework });
  } catch (error: any) {
    console.error("Framework detection error:", error);
    res.status(500).json({ error: "Failed to detect framework" });
  }
});

export default router;
