import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getGitRemoteAdapter,
  setGitRemoteConfig,
  getGitRemoteConfig,
  hydrateGitRemoteConfig,
  listGitTokens,
  addGitToken,
  renameGitToken,
  activateGitToken,
  deleteGitToken,
  getGitTokenById,
  getGitAdapterForSlot,
} from "../adapters/git/remote/registry.js";
import type { GitTokenSlot } from "../adapters/git/remote/registry.js";
import type { GitPlatformId } from "../adapters/git/remote/adapter.js";

const router = Router();

// ── Config (legacy single-token) ──

// GET /api/git-remote/config/:platform — get platform config
router.get("/config/:platform", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    await hydrateGitRemoteConfig(userId);
    const config = getGitRemoteConfig(userId, platform);
    res.json({ platform, configured: !!config?.token, baseUrl: config?.baseUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to get config" });
  }
});

// POST /api/git-remote/config/:platform — set platform config (token, baseUrl)
router.post("/config/:platform", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { token, baseUrl } = req.body;

    await setGitRemoteConfig(userId, platform, { token, baseUrl });

    // Verify by checking auth
    const adapter = getGitRemoteAdapter(userId, platform);
    const ok = adapter.isAuthenticated();

    res.json({ platform, configured: ok });
  } catch (error) {
    res.status(500).json({ error: "Failed to set config" });
  }
});

// ── Token slots (multi-token) ──

// GET /api/git-remote/:platform/tokens — list token slots (no raw tokens)
router.get("/:platform/tokens", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    await hydrateGitRemoteConfig(userId);
    const tokens = await listGitTokens(userId, platform);
    res.json({ platform, tokens });
  } catch (error) {
    res.status(500).json({ error: "Failed to list tokens" });
  }
});

// POST /api/git-remote/:platform/tokens/validate — validate a token via /user
router.post("/:platform/tokens/validate", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { token, baseUrl } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });

    const slot: GitTokenSlot = {
      id: "",
      platform,
      name: "validate",
      isDefault: false,
      token,
      baseUrl: baseUrl || null,
    };
    const adapter = getGitAdapterForSlot(userId, platform, slot);

    let username: string | null = null;
    let valid = true;
    try {
      if (adapter.getUser) {
        const user = await adapter.getUser();
        username = user?.username || null;
        valid = !!user;
      } else {
        await adapter.listRepos();
      }
    } catch {
      valid = false;
    }

    res.json({ valid, username, platform });
  } catch (error) {
    res.status(500).json({ error: "Failed to validate token" });
  }
});

// POST /api/git-remote/:platform/tokens — add a new token slot
router.post("/:platform/tokens", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { name, token, baseUrl } = req.body;
    if (!token) return res.status(400).json({ error: "Token is required" });

    // Validate before persisting
    let username: string | null = null;
    const slot: GitTokenSlot = {
      id: "",
      platform,
      name: "validate",
      isDefault: false,
      token,
      baseUrl: baseUrl || null,
    };
    const adapter = getGitAdapterForSlot(userId, platform, slot);
    try {
      if (adapter.getUser) {
        const user = await adapter.getUser();
        if (!user) {
          return res.status(400).json({ error: "Token nije validan — GitHub je odbio zahtjev" });
        }
        username = user.username;
      } else {
        await adapter.listRepos();
      }
    } catch {
      return res.status(400).json({ error: "Token nije validan — GitHub je odbio zahtjev" });
    }

    const saved = await addGitToken(userId, platform, {
      name: name || "GitHub",
      token,
      baseUrl,
      username,
    });

    res.status(201).json({ token: { ...saved, token: undefined } });
  } catch (error) {
    res.status(500).json({ error: "Failed to add token" });
  }
});

// PATCH /api/git-remote/:platform/tokens/:id — rename a slot
router.patch("/:platform/tokens/:id", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    await renameGitToken(userId, id, String(name));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to rename token" });
  }
});

// POST /api/git-remote/:platform/tokens/:id/activate — set default slot
router.post("/:platform/tokens/:id/activate", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { id } = req.params;
    const slot = await getGitTokenById(userId, id);
    if (!slot) return res.status(404).json({ error: "Token not found" });
    await activateGitToken(userId, id, platform);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to activate token" });
  }
});

// DELETE /api/git-remote/:platform/tokens/:id — remove a slot
router.delete("/:platform/tokens/:id", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { id } = req.params;
    await deleteGitToken(userId, id, platform);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete token" });
  }
});

// ── Repositories ──

// GET /api/git-remote/:platform/repos — list repos
router.get("/:platform/repos", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const adapter = getGitRemoteAdapter(userId, platform);
    const repos = await adapter.listRepos();
    res.json(repos);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to list repos" });
  }
});

// GET /api/git-remote/:platform/repo/:owner/:repo — get single repo
router.get("/:platform/repo/:owner/:repo", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { owner, repo } = req.params;
    const adapter = getGitRemoteAdapter(userId, platform);
    const result = await adapter.getRepo(owner, repo);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get repo" });
  }
});

// POST /api/git-remote/:platform/repo/:owner/:repo/fork — fork repo
router.post("/:platform/repo/:owner/:repo/fork", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { owner, repo } = req.params;
    const adapter = getGitRemoteAdapter(userId, platform);
    const result = await adapter.forkRepo(owner, repo);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fork repo" });
  }
});

// POST /api/git-remote/:platform/repos — create new repo
router.post("/:platform/repos", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { name, description, private: isPrivate } = req.body;
    const adapter = getGitRemoteAdapter(userId, platform);
    const result = await adapter.createRepo(name, { description, private: isPrivate });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create repo" });
  }
});

// ── Branches ──

// GET /api/git-remote/:platform/repo/:owner/:repo/branches
router.get("/:platform/repo/:owner/:repo/branches", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { owner, repo } = req.params;
    const adapter = getGitRemoteAdapter(userId, platform);
    const branches = await adapter.listBranches(owner, repo);
    res.json(branches);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to list branches" });
  }
});

// POST /api/git-remote/:platform/repo/:owner/:repo/branches — create branch
router.post("/:platform/repo/:owner/:repo/branches", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { owner, repo } = req.params;
    const { name, fromSha } = req.body;
    const adapter = getGitRemoteAdapter(userId, platform);
    await adapter.createBranch(owner, repo, name, fromSha);
    res.status(201).json({ name });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create branch" });
  }
});

// ── Pull Requests ──

// GET /api/git-remote/:platform/repo/:owner/:repo/pulls
router.get("/:platform/repo/:owner/:repo/pulls", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { owner, repo } = req.params;
    const state = req.query.state as string | undefined;
    const adapter = getGitRemoteAdapter(userId, platform);
    const pulls = await adapter.listPullRequests(owner, repo, state as any);
    res.json(pulls);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to list pull requests" });
  }
});

// POST /api/git-remote/:platform/repo/:owner/:repo/pulls — create PR
router.post("/:platform/repo/:owner/:repo/pulls", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { owner, repo } = req.params;
    const { title, description, sourceBranch, targetBranch } = req.body;
    const adapter = getGitRemoteAdapter(userId, platform);
    const pr = await adapter.createPullRequest(owner, repo, { title, description, sourceBranch, targetBranch });
    res.status(201).json(pr);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create pull request" });
  }
});

// POST /api/git-remote/:platform/repo/:owner/:repo/pulls/:prId/merge
router.post("/:platform/repo/:owner/:repo/pulls/:prId/merge", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { owner, repo, prId } = req.params;
    const adapter = getGitRemoteAdapter(userId, platform);
    await adapter.mergePullRequest(owner, repo, parseInt(prId));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to merge pull request" });
  }
});

// ── Issues ──

// GET /api/git-remote/:platform/repo/:owner/:repo/issues
router.get("/:platform/repo/:owner/:repo/issues", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { owner, repo } = req.params;
    const state = req.query.state as string | undefined;
    const adapter = getGitRemoteAdapter(userId, platform);
    const issues = await adapter.listIssues(owner, repo, state as any);
    res.json(issues);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to list issues" });
  }
});

// POST /api/git-remote/:platform/repo/:owner/:repo/issues — create issue
router.post("/:platform/repo/:owner/:repo/issues", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user!.userId;
    const platform = req.params.platform as GitPlatformId;
    const { owner, repo } = req.params;
    const { title, description, labels } = req.body;
    const adapter = getGitRemoteAdapter(userId, platform);
    const issue = await adapter.createIssue(owner, repo, { title, description, labels });
    res.status(201).json(issue);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create issue" });
  }
});

export default router;
