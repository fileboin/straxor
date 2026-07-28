import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createCustomUsageAdapter } from "../adapters/usage/custom.js";
import { createOpenMeterAdapter } from "../adapters/usage/openmeter.js";
import { createLagoAdapter } from "../adapters/usage/lago.js";
import type { UsageAdapter } from "../adapters/usage/adapter.js";

const router = Router();

function getAdapter(): UsageAdapter {
  const backend = process.env.USAGE_BACKEND || "custom";
  switch (backend) {
    case "openmeter": return createOpenMeterAdapter();
    case "lago": return createLagoAdapter();
    default: return createCustomUsageAdapter();
  }
}

// POST /api/usage/events — log a usage event
router.post("/events", requireAuth, async (req, res) => {
  try {
    const adapter = getAdapter();
    const userId = (req as any).userId as string;
    const event = await adapter.logEvent({
      timestamp: new Date().toISOString(),
      userId,
      projectId: req.body.projectId,
      machineId: req.body.machineId,
      provider: req.body.provider,
      model: req.body.model,
      inputTokens: req.body.inputTokens || 0,
      outputTokens: req.body.outputTokens || 0,
      totalTokens: (req.body.inputTokens || 0) + (req.body.outputTokens || 0),
      costUsd: req.body.costUsd || 0,
      latencyMs: req.body.latencyMs,
      success: req.body.success !== false,
      errorMessage: req.body.errorMessage,
      metadata: req.body.metadata,
    });
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usage/events — list events
router.get("/events", requireAuth, async (req, res) => {
  try {
    const adapter = getAdapter();
    const events = await adapter.getEvents({
      from: req.query.from as string,
      to: req.query.to as string,
      provider: req.query.provider as string,
      model: req.query.model as string,
      projectId: req.query.projectId as string,
      limit: req.query.limit ? parseInt(String(req.query.limit)) : 50,
      offset: req.query.offset ? parseInt(String(req.query.offset)) : 0,
    });
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usage/aggregate — aggregated usage
router.get("/aggregate", requireAuth, async (req, res) => {
  try {
    const adapter = getAdapter();
    const agg = await adapter.getAggregate({
      dimension: (req.query.dimension as any) || "provider",
      from: req.query.from as string,
      to: req.query.to as string,
      provider: req.query.provider as string,
      model: req.query.model as string,
    });
    res.json(agg);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usage/summary — full cost summary
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const adapter = getAdapter();
    const summary = await adapter.getCostSummary({
      from: req.query.from as string,
      to: req.query.to as string,
    });
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usage/pricing — model pricing table
router.get("/pricing", requireAuth, async (_req, res) => {
  try {
    const adapter = getAdapter();
    const pricing = await adapter.getPricing();
    res.json(pricing);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/usage/estimate — estimate cost for a prompt
router.post("/estimate", requireAuth, async (req, res) => {
  try {
    const adapter = getAdapter();
    const { provider, model, inputTokens, outputTokens } = req.body;
    const cost = await adapter.estimateCost(provider, model, inputTokens || 0, outputTokens || 0);
    res.json({ costUsd: cost });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usage/budgets — list budgets
router.get("/budgets", requireAuth, async (_req, res) => {
  try {
    const adapter = getAdapter();
    const budgets = await adapter.listBudgets();
    res.json(budgets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/usage/budgets — create budget
router.post("/budgets", requireAuth, async (req, res) => {
  try {
    const adapter = getAdapter();
    const budget = await adapter.createBudget({
      name: req.body.name,
      monthlyLimitUsd: req.body.monthlyLimitUsd,
      alertThresholdPercent: req.body.alertThresholdPercent || 80,
      isHardLimit: req.body.isHardLimit || false,
    });
    res.json(budget);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/usage/budgets/:id
router.delete("/budgets/:id", requireAuth, async (req, res) => {
  try {
    const adapter = getAdapter();
    await adapter.deleteBudget(String(req.params.id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usage/periods — billing periods
router.get("/periods", requireAuth, async (_req, res) => {
  try {
    const adapter = getAdapter();
    const periods = await adapter.listPeriods();
    res.json(periods);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usage/backend — current backend info
router.get("/backend", requireAuth, (_req, res) => {
  const backend = process.env.USAGE_BACKEND || "custom";
  const urls: Record<string, string> = {
    openmeter: process.env.OPENMETER_URL || "https://api.openmeter.io",
    lago: process.env.LAGO_URL || "https://api.getlago.com",
    custom: "in-memory",
  };
  res.json({ backend, url: urls[backend] || "unknown" });
});

export default router;
