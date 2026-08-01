import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { repoConnections } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import {
  getGitRemoteAdapter,
  hydrateGitRemoteConfig,
} from "../adapters/git/remote/registry.js";
import type { GitPlatformId } from "../adapters/git/remote/adapter.js";

const router = Router();

// Hydrate platform configs from DB on every request (server restart safe).
router.use(requireAuth, async (req, _res, next) => {
  await hydrateGitRemoteConfig(req.user!.userId);
  next();
});

// GET /api/repos — list connected repos (active flagged)
router.get("/", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await db
      .select()
      .from(repoConnections)
      .where(eq(repoConnections.userId, userId))
      .orderBy(repoConnections.createdAt);

    res.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/repos/connect — connect a repo for the agent (becomes active)
router.post("/connect", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { platform, fullName } = req.body as {
      platform: GitPlatformId;
      fullName: string;
    };

    if (!platform || !fullName || !fullName.includes("/")) {
      res.status(400).json({ error: "Missing required fields: platform, fullName (owner/repo)" });
      return;
    }

    const [owner, name] = fullName.split("/");

    const adapter = getGitRemoteAdapter(userId, platform);
    if (!adapter.isAuthenticated()) {
      res.status(401).json({ error: "Platform not configured — save a token first" });
      return;
    }

    const repo = await adapter.getRepo(owner, name);

    // Upsert connection row
    const existing = await db
      .select()
      .from(repoConnections)
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.platform, platform), eq(repoConnections.fullName, fullName)))
      .limit(1);

    let connectionId: string;
    if (existing.length > 0) {
      await db
        .update(repoConnections)
        .set({
          cloneUrl: repo.cloneUrl,
          defaultBranch: repo.defaultBranch || "main",
          updatedAt: new Date(),
        })
        .where(and(eq(repoConnections.userId, userId), eq(repoConnections.platform, platform), eq(repoConnections.fullName, fullName)));
      connectionId = existing[0].id;
    } else {
      const inserted = await db
        .insert(repoConnections)
        .values({
          userId,
          platform,
          owner,
          name,
          fullName,
          cloneUrl: repo.cloneUrl,
          defaultBranch: repo.defaultBranch || "main",
          isActive: true,
        })
        .returning();
      connectionId = inserted[0].id;
    }

    // Set as active (single active repo per user)
    await db
      .update(repoConnections)
      .set({ isActive: false })
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true)));
    await db
      .update(repoConnections)
      .set({ isActive: true })
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.id, connectionId)));

    res.json({ success: true, id: connectionId, repo });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/repos/active — set the active repo for the agent
router.post("/active", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { platform, fullName } = req.body as {
      platform: GitPlatformId;
      fullName: string;
    };

    if (!platform || !fullName) {
      res.status(400).json({ error: "Missing required fields: platform, fullName" });
      return;
    }

    const found = await db
      .select()
      .from(repoConnections)
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.platform, platform), eq(repoConnections.fullName, fullName)))
      .limit(1);

    if (found.length === 0) {
      res.status(404).json({ error: "Repo not connected" });
      return;
    }

    await db
      .update(repoConnections)
      .set({ isActive: false })
      .where(eq(repoConnections.userId, userId));
    await db
      .update(repoConnections)
      .set({ isActive: true })
      .where(eq(repoConnections.id, found[0].id));

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/repos/disconnect — remove a connected repo
router.post("/disconnect", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { platform, fullName } = req.body as {
      platform: GitPlatformId;
      fullName: string;
    };

    if (!platform || !fullName) {
      res.status(400).json({ error: "Missing required fields: platform, fullName" });
      return;
    }

    await db
      .delete(repoConnections)
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.platform, platform), eq(repoConnections.fullName, fullName)));

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
