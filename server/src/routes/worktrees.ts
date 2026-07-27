import { Router } from "express";
import { db } from "../db/index.js";
import { worktrees } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";
import { createSshGitAdapter } from "../adapters/git/ssh.js";

const router = Router();

function getGitAdapter(userId: string) {
  const runtime = getAdapters().runtime(userId);
  return createSshGitAdapter((machineId, cmd) => runtime.executeCommand(machineId, cmd));
}

// GET /api/worktrees — list all worktrees for user's machines
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId } = req.query;

    const conditions = [eq(worktrees.userId, userId)];
    if (machineId) {
      conditions.push(eq(worktrees.machineId, machineId));
    }

    const rows = await db
      .select()
      .from(worktrees)
      .where(and(...conditions))
      .orderBy(worktrees.createdAt);

    res.json(rows);
  } catch (error) {
    console.error("Error listing worktrees:", error);
    res.status(500).json({ error: "Failed to list worktrees" });
  }
});

// GET /api/worktrees/:machineId/live — get live worktrees from VPS
router.get("/:machineId/live", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId } = req.params;
    const adapter = getGitAdapter(userId);
    const liveWorktrees = await adapter.listWorktrees(machineId);
    res.json(liveWorktrees);
  } catch (error) {
    console.error("Error getting live worktrees:", error);
    res.status(500).json({ error: "Failed to get worktrees" });
  }
});

// POST /api/worktrees — create worktree
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, branch, fromBranch, taskName } = req.body;

    if (!machineId || !branch) {
      return res.status(400).json({ error: "machineId and branch required" });
    }

    const adapter = getGitAdapter(userId);

    const worktree = await adapter.createWorktree(machineId, {
      branch,
      fromBranch,
      taskName,
    });

    const [row] = await db
      .insert(worktrees)
      .values({
        userId,
        machineId,
        branch,
        worktreePath: worktree.path,
        taskName: taskName || null,
        status: "active",
      })
      .returning();

    res.status(201).json({
      ...row,
      head: worktree.head,
      isMain: worktree.isMain,
    });
  } catch (error) {
    console.error("Error creating worktree:", error);
    res.status(500).json({ error: "Failed to create worktree" });
  }
});

// DELETE /api/worktrees/:id — remove worktree
router.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const [wt] = await db
      .select()
      .from(worktrees)
      .where(and(eq(worktrees.id, id), eq(worktrees.userId, userId)))
      .limit(1);

    if (!wt) {
      return res.status(404).json({ error: "Worktree not found" });
    }

    const adapter = getGitAdapter(userId);
    await adapter.removeWorktree(wt.machineId, wt.branch);

    await db.delete(worktrees).where(eq(worktrees.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error("Error removing worktree:", error);
    res.status(500).json({ error: "Failed to remove worktree" });
  }
});

// POST /api/worktrees/:id/merge — merge worktree into target branch
router.post("/:id/merge", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { targetBranch } = req.body;

    const [wt] = await db
      .select()
      .from(worktrees)
      .where(and(eq(worktrees.id, id), eq(worktrees.userId, userId)))
      .limit(1);

    if (!wt) {
      return res.status(404).json({ error: "Worktree not found" });
    }

    const adapter = getGitAdapter(userId);
    const result = await adapter.mergeWorktree(
      wt.machineId,
      wt.branch,
      targetBranch || "main"
    );

    if (result.success) {
      await db
        .update(worktrees)
        .set({ status: "merged", updatedAt: new Date() })
        .where(eq(worktrees.id, id));
    }

    res.json(result);
  } catch (error) {
    console.error("Error merging worktree:", error);
    res.status(500).json({ error: "Failed to merge worktree" });
  }
});

// GET /api/worktrees/:id/status — get worktree git status
router.get("/:id/status", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const [wt] = await db
      .select()
      .from(worktrees)
      .where(and(eq(worktrees.id, id), eq(worktrees.userId, userId)))
      .limit(1);

    if (!wt) {
      return res.status(404).json({ error: "Worktree not found" });
    }

    const adapter = getGitAdapter(userId);
    const status = await adapter.getWorktreeStatus(wt.machineId, wt.branch);
    res.json(status);
  } catch (error) {
    console.error("Error getting worktree status:", error);
    res.status(500).json({ error: "Failed to get status" });
  }
});

// GET /api/worktrees/:id/diff — get worktree diff
router.get("/:id/diff", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const [wt] = await db
      .select()
      .from(worktrees)
      .where(and(eq(worktrees.id, id), eq(worktrees.userId, userId)))
      .limit(1);

    if (!wt) {
      return res.status(404).json({ error: "Worktree not found" });
    }

    const adapter = getGitAdapter(userId);
    const diff = await adapter.getWorktreeDiff(wt.machineId, wt.branch);
    res.json(diff);
  } catch (error) {
    console.error("Error getting worktree diff:", error);
    res.status(500).json({ error: "Failed to get diff" });
  }
});

export default router;
