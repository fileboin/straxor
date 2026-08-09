import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { repoConnections } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import {
  getGitRemoteAdapter,
  hydrateGitRemoteConfig,
  getGitRemoteToken,
} from "../adapters/git/remote/registry.js";
import type { GitPlatformId } from "../adapters/git/remote/adapter.js";
import { ensureWorkspace, getRepoWorkspaceDir, hasGitBinary, pushWorkspace, commitWorkspace } from "../runtime/local/workspace.js";
import { stopLocalEnginesForUser } from "../runtime/local/engine.js";
import { normalizeSlot, type RepoSlot } from "../runtime/local/shared-workspace.js";

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
    const { platform, fullName, slot } = req.body as {
      platform: GitPlatformId;
      fullName: string;
      slot?: string | null;
    };

    if (!platform || !fullName || !fullName.includes("/")) {
      res.status(400).json({ error: "Missing required fields: platform, fullName (owner/repo)" });
      return;
    }

    const normalizedSlot = normalizeSlot(slot);
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
          connectionType: "token",
          slot: normalizedSlot,
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
          slot: normalizedSlot,
          connectionType: "token",
        })
        .returning();
      connectionId = inserted[0].id;
    }

    // Set as active (single active repo per user per panel slot)
    await db
      .update(repoConnections)
      .set({ isActive: false })
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true), eq(repoConnections.slot, normalizedSlot)));
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
    const { platform, fullName, slot } = req.body as {
      platform: GitPlatformId;
      fullName: string;
      slot?: string | null;
    };

    if (!platform || !fullName) {
      res.status(400).json({ error: "Missing required fields: platform, fullName" });
      return;
    }

    const normalizedSlot = normalizeSlot(slot);

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
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.slot, normalizedSlot)));
    await db
      .update(repoConnections)
      .set({ isActive: true, slot: normalizedSlot })
      .where(eq(repoConnections.id, found[0].id));

    await stopLocalEnginesForUser(userId);

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

    await stopLocalEnginesForUser(userId);

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/repos/prepare — clone/pull the active repo into the local sandbox
router.post("/prepare", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const active = await db
      .select()
      .from(repoConnections)
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true)))
      .limit(1);

    if (active.length === 0) {
      res.status(404).json({ error: "No active repo — connect one first" });
      return;
    }

    const conn = active[0];
    const isUrlConnection = conn.connectionType === "url";
    const token = isUrlConnection ? undefined : await getGitRemoteToken(userId, conn.platform as GitPlatformId);
    if (!token && !isUrlConnection) {
      res.status(401).json({ error: "Platform token missing — save a token first" });
      return;
    }

    const info = await ensureWorkspace({
      userId,
      platform: conn.platform,
      owner: conn.owner,
      name: conn.name,
      fullName: conn.fullName,
      cloneUrl: conn.cloneUrl,
      defaultBranch: conn.defaultBranch,
      token,
    });

    res.json({ success: true, ...info });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/repos/workspace — report local sandbox status for the active repo
router.get("/workspace", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const active = await db
      .select()
      .from(repoConnections)
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true)))
      .limit(1);

    if (active.length === 0) {
      res.json({ success: false, connected: false });
      return;
    }

    const conn = active[0];
    const dir = getRepoWorkspaceDir(userId, conn.owner, conn.name);
    const fs = await import("fs");
    const path = await import("path");
    const ready = fs.existsSync(dir) && fs.existsSync(path.join(dir, ".git"));
    res.json({
      success: true,
      connected: true,
      repo: conn.fullName,
      branch: conn.defaultBranch,
      sandboxDir: dir,
      cloned: ready,
      readOnly: false,
      connectionType: conn.connectionType,
      pushCapable: conn.connectionType !== "url" || !!(await getGitRemoteToken(userId, conn.platform as GitPlatformId)),
      gitBinary: await hasGitBinary(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/repos/push — push the active repo's sandbox to the remote.
// The server decrypts the stored token internally and refreshes the sandbox
// origin URL before pushing, so the raw token never leaves the server.
router.post("/push", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const active = await db
      .select()
      .from(repoConnections)
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true)))
      .limit(1);

    if (active.length === 0) {
      res.status(404).json({ error: "No active repo — connect one first" });
      return;
    }

    const conn = active[0];

    const token = await getGitRemoteToken(userId, conn.platform as GitPlatformId);
    if (!token) {
      const isUrlConnection = conn.connectionType === "url";
      res.status(isUrlConnection ? 403 : 401).json({
        error: isUrlConnection
          ? "Repo povezan preko URL-a je spreman za lokalni rad, ali push zahteva sačuvan GitHub token na serveru"
          : "Platform token missing — save a token first",
      });
      return;
    }

    const info = await ensureWorkspace({
      userId,
      platform: conn.platform,
      owner: conn.owner,
      name: conn.name,
      fullName: conn.fullName,
      cloneUrl: conn.cloneUrl,
      defaultBranch: conn.defaultBranch,
      token,
    });

    const output = await pushWorkspace(userId, conn.owner, conn.name, conn.defaultBranch);

    res.json({ success: true, repo: conn.fullName, branch: conn.defaultBranch, lastCommit: info.lastCommit, output });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/repos/commit — stage + commit the active repo's sandbox changes as
// the Straxor Agent identity (Straxor Agent <agent@straxor.dev>).
router.post("/commit", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const message: string = (req.body?.message as string) || "Straxor Agent commit";

    const active = await db
      .select()
      .from(repoConnections)
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true)))
      .limit(1);

    if (active.length === 0) {
      res.status(404).json({ error: "No active repo — connect one first" });
      return;
    }

    const conn = active[0];

    const result = await commitWorkspace(userId, conn.owner, conn.name, message, conn.defaultBranch);

    res.json({
      success: true,
      repo: conn.fullName,
      branch: conn.defaultBranch,
      hash: result.hash,
      committed: result.committed,
      message: result.message,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
