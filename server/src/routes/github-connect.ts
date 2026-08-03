// ── GitHub URL-based (tokenless, read-only) repo connection ──
// Lets a user connect ANY public GitHub repo by URL, without needing a token.
// Repos connected this way are read-only: the agent can clone/sync/pull but
// cannot push. Pushing requires a token (the existing flow).
//
// Endpoints:
//   POST /api/github/connect-url   body { repoUrl }  → validates + saves

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { gitConnections, repoConnections } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { encrypt } from "../lib/crypto.js";
import { stopLocalEnginesForUser } from "../runtime/local/engine.js";

const router = Router();

// https://github.com/owner/repo, https://github.com/owner/repo.git, www variant, http variant
const GH_URL_RE = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+?)(?:\.git)?\/?$/;
// owner/repo shorthand
const GH_SHORT_RE = /^([^/\s?#]+)\/([^/\s?#]+)$/;

interface RepoMeta {
  fullName: string;
  name: string;
  description: string | null;
  defaultBranch: string;
  stars: number;
  isPrivate: boolean;
}

async function fetchRepoMeta(owner: string, repo: string): Promise<RepoMeta> {
  const res = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    {
      headers: { "User-Agent": "straxor", Accept: "application/vnd.github+json" },
    }
  );

  if (res.status === 404) {
    const err: any = new Error("Repo not found or private — private repos require a token");
    err.status = 404;
    throw err;
  }
  if (!res.ok) {
    const err: any = new Error("GitHub API error: " + res.status);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  return {
    fullName: data.full_name || `${owner}/${repo}`,
    name: data.name || repo,
    description: data.description ?? null,
    defaultBranch: data.default_branch || "main",
    stars: data.stargazers_count ?? 0,
    isPrivate: !!data.private,
  };
}

// POST /api/github/connect-url — connect a public repo by URL (read-only).
router.post("/connect-url", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const { repoUrl } = req.body as { repoUrl?: string };

    if (!repoUrl || typeof repoUrl !== "string" || !repoUrl.trim()) {
      res.status(400).json({ error: "repoUrl is required" });
      return;
    }
    const url = repoUrl.trim();

    let m = GH_URL_RE.exec(url);
    if (!m) m = GH_SHORT_RE.exec(url);
    if (!m) {
      res
        .status(400)
        .json({ error: "Invalid GitHub repository URL. Expected https://github.com/owner/repo or owner/repo" });
      return;
    }
    const owner = m[1].replace(/\.git$/, "");
    const repo = m[2].replace(/\.git$/, "");

    const meta = await fetchRepoMeta(owner, repo);
    const fullName = meta.fullName;

    // Record the URL connection in the same table as token connections,
    // flagged connection_type='url' so it is never treated as a token slot.
    const existingConn = await db
      .select()
      .from(gitConnections)
      .where(and(eq(gitConnections.userId, userId), eq(gitConnections.platform, "github"), eq(gitConnections.name, fullName)))
      .limit(1);

    if (existingConn.length === 0) {
      await db.insert(gitConnections).values({
        userId,
        platform: "github",
        name: fullName,
        username: owner,
        isDefault: false,
        connectionType: "url",
        encryptedToken: encrypt(""),
      });
    }

    // Upsert the repo_connections row (read-only clone URL, no token embedded).
    const existing = await db
      .select()
      .from(repoConnections)
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.platform, "github"), eq(repoConnections.fullName, fullName)))
      .limit(1);

    const cloneUrl = `https://github.com/${owner}/${repo}.git`;
    let connectionId: string;
    if (existing.length > 0) {
      await db
        .update(repoConnections)
        .set({
          cloneUrl,
          defaultBranch: meta.defaultBranch,
          connectionType: "url",
          updatedAt: new Date(),
        })
        .where(and(eq(repoConnections.userId, userId), eq(repoConnections.platform, "github"), eq(repoConnections.fullName, fullName)));
      connectionId = existing[0].id;
    } else {
      const inserted = await db
        .insert(repoConnections)
        .values({
          userId,
          platform: "github",
          owner,
          name: repo,
          fullName,
          cloneUrl,
          defaultBranch: meta.defaultBranch,
          isActive: true,
          connectionType: "url",
        })
        .returning();
      connectionId = inserted[0].id;
    }

    // Single active repo per user.
    await db
      .update(repoConnections)
      .set({ isActive: false })
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true)));
    await db
      .update(repoConnections)
      .set({ isActive: true })
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.id, connectionId)));
    await stopLocalEnginesForUser(userId);

    res.json({
      success: true,
      id: connectionId,
      readOnly: true,
      repo: {
        fullName,
        name: meta.name,
        description: meta.description,
        defaultBranch: meta.defaultBranch,
        stars: meta.stars,
        isPrivate: meta.isPrivate,
      },
    });
  } catch (error: any) {
    const status = error?.status || 500;
    res.status(status).json({ error: error.message || "Failed to connect repository" });
  }
});

export default router;
