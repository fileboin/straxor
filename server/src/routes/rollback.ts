import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";

const router = Router();

function getRollback(userId: string) {
  return getAdapters().rollback(userId);
}

// POST /api/rollback/create — create snapshot
router.post("/create", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, projectPath, name, description, type } = req.body;
    if (!machineId || !projectPath || !name) {
      return res.status(400).json({ error: "machineId, projectPath, and name required" });
    }

    const rollback = getRollback(userId);
    const snapshot = await rollback.createSnapshot(machineId, projectPath, name, description || "", type || "manual");
    res.json(snapshot);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create snapshot" });
  }
});

// GET /api/rollback/list — list snapshots
router.get("/list", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, projectPath } = req.query;
    if (!machineId || !projectPath) {
      return res.status(400).json({ error: "machineId and projectPath required" });
    }

    const rollback = getRollback(userId);
    const snapshots = await rollback.listSnapshots(machineId, projectPath);
    res.json(snapshots);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to list snapshots" });
  }
});

// POST /api/rollback/restore — restore to snapshot
router.post("/restore", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, projectPath, snapshotPath } = req.body;
    if (!machineId || !projectPath || !snapshotPath) {
      return res.status(400).json({ error: "machineId, projectPath, and snapshotPath required" });
    }

    const rollback = getRollback(userId);
    const result = await rollback.restoreSnapshot(machineId, projectPath, snapshotPath);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to restore snapshot" });
  }
});

// DELETE /api/rollback/:snapshotId — delete snapshot
router.delete("/:snapshotId", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { snapshotId } = req.params;
    const { snapshotPath } = req.query;
    if (!snapshotPath) {
      return res.status(400).json({ error: "snapshotPath query param required" });
    }

    const rollback = getRollback(userId);
    const { machineId } = req.query;
    if (!machineId) {
      return res.status(400).json({ error: "machineId query param required" });
    }
    await rollback.deleteSnapshot(machineId, snapshotPath as string);
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete snapshot" });
  }
});

// GET /api/rollback/diff/:snapshotId — diff against snapshot
router.get("/diff/:snapshotId", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { snapshotId } = req.params;
    const { machineId, projectPath, snapshotPath } = req.query;
    if (!machineId || !projectPath || !snapshotPath) {
      return res.status(400).json({ error: "machineId, projectPath, and snapshotPath required" });
    }

    const rollback = getRollback(userId);
    const diff = await rollback.diffSnapshot(machineId, projectPath, snapshotPath as string);
    res.json(diff);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to diff snapshot" });
  }
});

export default router;
