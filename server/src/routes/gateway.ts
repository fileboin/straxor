import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { GatewayRouter } from "../adapters/gateway/router.js";

const router = Router();

// Singleton gateway router
let gateway: GatewayRouter | null = null;

function getGateway(): GatewayRouter {
  if (!gateway) gateway = new GatewayRouter();
  return gateway;
}

// ── Gateway Config ──

// GET /api/gateway/config — list all gateways
router.get("/config", requireAuth, (_req, res) => {
  try {
    const gw = getGateway();
    res.json(gw.getAllGateways());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/gateway/config/:id — update gateway config
router.put("/config/:id", requireAuth, (req, res) => {
  try {
    const gw = getGateway();
    const updated = gw.updateGateway(req.params.id as string, req.body);
    if (!updated) return res.status(404).json({ error: "Gateway not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/gateway/config — add custom gateway
router.post("/config", requireAuth, (req, res) => {
  try {
    const gw = getGateway();
    const { id, name, type, baseUrl, apiKey, priority, rateLimit, monthlyQuota, models, timeout } = req.body;
    if (!id || !name || !baseUrl) {
      return res.status(400).json({ error: "id, name, and baseUrl required" });
    }

    const config = {
      id, name, type: type || "custom", baseUrl, apiKey,
      isEnabled: true,
      priority: priority || 10,
      rateLimit, monthlyQuota, models, timeout,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    gw.addGateway(config);
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/gateway/config/:id — remove custom gateway
router.delete("/config/:id", requireAuth, (req, res) => {
  try {
    const gw = getGateway();
    const removed = gw.removeGateway(req.params.id as string);
    if (!removed) return res.status(404).json({ error: "Gateway not found" });
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Health & Status ──

// GET /api/gateway/status — all provider statuses
router.get("/status", requireAuth, async (_req, res) => {
  try {
    const gw = getGateway();
    const statuses = await gw.getStatuses();
    res.json(statuses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/gateway/health/:id — check specific gateway health
router.post("/health/:id", requireAuth, async (req, res) => {
  try {
    const gw = getGateway();
    const health = await gw.checkHealth(req.params.id as string);
    res.json({ health });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/gateway/reset/:id — reset circuit breaker for gateway
router.post("/reset/:id", requireAuth, (req, res) => {
  try {
    const gw = getGateway();
    (gw as any).circuitBreaker.reset(req.params.id as string);
    (gw as any).healthChecker.resetGateway(req.params.id as string);
    res.json({ reset: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Cache ──

// GET /api/gateway/cache/stats — cache statistics
router.get("/cache/stats", requireAuth, async (_req, res) => {
  try {
    const gw = getGateway();
    const stats = await gw.getCacheStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/gateway/cache — clear cache
router.delete("/cache", requireAuth, async (req, res) => {
  try {
    const gw = getGateway();
    const { pattern } = req.query;
    await gw.clearCache(pattern as string | undefined);
    res.json({ cleared: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Metrics ──

// GET /api/gateway/metrics — full metrics
router.get("/metrics", requireAuth, async (_req, res) => {
  try {
    const gw = getGateway();
    const metrics = await gw.getMetrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Send through gateway ──

// POST /api/gateway/send — send chat completion
router.post("/send", requireAuth, async (req, res) => {
  try {
    const gw = getGateway();
    const { model, messages, maxTokens, temperature } = req.body;
    if (!model || !messages) {
      return res.status(400).json({ error: "model and messages required" });
    }

    const result = await gw.sendRequest({ model, messages, maxTokens, temperature });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
