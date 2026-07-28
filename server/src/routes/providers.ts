import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getDirectProviderManager } from "../adapters/direct-providers/manager.js";
import { DIRECT_PROVIDERS, type DirectProviderId } from "../adapters/direct-providers/types.js";

const router = Router();

function getManager() {
  return getDirectProviderManager();
}

// GET /api/providers — list all direct providers with status
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const manager = getManager();
    const statuses = await manager.getAllStatuses(userId);

    // Attach provider definitions for full info
    const result = statuses.map((s) => {
      const def = DIRECT_PROVIDERS.find((p) => p.id === s.providerId);
      return { ...s, def };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/providers/definitions — provider definitions only (no auth needed for UI)
router.get("/definitions", requireAuth, (_req, res) => {
  res.json(DIRECT_PROVIDERS);
});

// POST /api/providers/:id/key — save API key for provider
router.post("/:id/key", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const providerId = req.params.id as string;
    const { key } = req.body;

    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "API key required" });
    }

    const def = DIRECT_PROVIDERS.find((p) => p.id === providerId);
    if (!def) return res.status(404).json({ error: "Unknown provider" });
    if (def.authMethod === "none") {
      return res.status(400).json({ error: "This provider does not require an API key" });
    }

    const manager = getManager();
    await manager.saveKey(userId, providerId, key);

    // Auto-enable on first key save
    manager.updateConfig(providerId, { isEnabled: true });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/providers/:id/key — delete API key
router.delete("/:id/key", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const providerId = req.params.id as string;

    const manager = getManager();
    const deleted = await manager.deleteKey(userId, providerId);

    if (!deleted) return res.status(404).json({ error: "API key not found" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/providers/:id/config — update provider config (baseUrl, isEnabled)
router.put("/:id/config", requireAuth, (req, res) => {
  try {
    const providerId = req.params.id as string;
    const { baseUrl, isEnabled } = req.body;

    const def = DIRECT_PROVIDERS.find((p) => p.id === providerId);
    if (!def) return res.status(404).json({ error: "Unknown provider" });

    const manager = getManager();
    manager.updateConfig(providerId, { baseUrl, isEnabled });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/providers/:id/health — check provider health
router.post("/:id/health", requireAuth, async (req, res) => {
  try {
    const providerId = req.params.id as string;

    const def = DIRECT_PROVIDERS.find((p) => p.id === providerId);
    if (!def) return res.status(404).json({ error: "Unknown provider" });

    const manager = getManager();
    const result = await manager.checkHealth(providerId);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/providers/health-all — check all providers health
router.post("/health-all", requireAuth, async (_req, res) => {
  try {
    const manager = getManager();
    const results: Record<string, { healthy: boolean; latencyMs: number; error?: string }> = {};

    for (const def of DIRECT_PROVIDERS) {
      results[def.id] = await manager.checkHealth(def.id);
    }

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/providers/:id/toggle — toggle provider on/off
router.post("/:id/toggle", requireAuth, (req, res) => {
  try {
    const providerId = req.params.id as string;
    const { enabled } = req.body;

    const def = DIRECT_PROVIDERS.find((p) => p.id === providerId);
    if (!def) return res.status(404).json({ error: "Unknown provider" });

    const manager = getManager();
    manager.toggleEnabled(providerId, enabled);

    res.json({ success: true, enabled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/providers/:id/key — get decrypted key (for internal use)
router.get("/:id/key", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const providerId = req.params.id as string;

    const manager = getManager();
    const key = await manager.getKey(userId, providerId);

    if (!key) return res.status(404).json({ error: "No API key found" });
    res.json({ key });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
