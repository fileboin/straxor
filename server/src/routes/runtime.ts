import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";
import type { RuntimeChannel } from "../adapters/runtime/adapter.js";

const router = Router();

router.use(requireAuth);

// GET /api/runtime/health/:machineId — health check
router.get("/health/:machineId", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const machineId = req.params.machineId as string;

  try {
    const adapter = getAdapters().runtime(userId);
    const health = await adapter.healthCheck(machineId);
    res.json(health);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/runtime/restart/:machineId — restart opencode
router.post("/restart/:machineId", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const machineId = req.params.machineId as string;

  try {
    const adapter = getAdapters().runtime(userId);
    const health = await adapter.restart(machineId);
    res.json(health);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/runtime/reconnect/:machineId — reconnect SSH
router.post("/reconnect/:machineId", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const machineId = req.params.machineId as string;

  try {
    const adapter = getAdapters().runtime(userId);
    const health = await adapter.reconnect(machineId);
    res.json(health);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/runtime/update/:machineId — update runtime
router.post("/update/:machineId", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const machineId = req.params.machineId as string;
  const { channel, version } = req.body as {
    channel: RuntimeChannel;
    version?: string;
  };

  if (!channel) {
    res.status(400).json({ error: "channel is required (stable|beta|custom)" });
    return;
  }

  try {
    const adapter = getAdapters().runtime(userId);
    const health = await adapter.updateRuntime(machineId, channel, version);
    res.json(health);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
