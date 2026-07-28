import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getRuntimeManager } from "../runtime/manager.js";
import { createACPAdapter } from "../runtime/acp/adapter.js";
import { ACP_AGENT_META, type ACPAgentId } from "../runtime/acp/types.js";
import type { RuntimeId } from "../runtime/types.js";

const router = Router();

// GET /api/acp/agents — list all ACP-compatible agents
router.get("/agents", requireAuth, (_req, res) => {
  const agents = Object.entries(ACP_AGENT_META).map(([id, meta]) => ({
    id,
    name: meta.name,
    description: meta.description,
    icon: meta.icon,
    color: meta.color,
    repoUrl: meta.repoUrl,
    installType: meta.installType,
  }));
  res.json(agents);
});

// POST /api/acp/:agentId/execute — execute a task via ACP agent
router.post("/:agentId/execute", requireAuth, async (req: any, res) => {
  try {
    const { agentId } = req.params;
    const { task, model, dir } = req.body;

    if (!ACP_AGENT_META[agentId as ACPAgentId]) {
      res.status(400).json({ error: `Unknown ACP agent: ${agentId}` });
      return;
    }
    if (!task) {
      res.status(400).json({ error: "Missing required field: task" });
      return;
    }

    const adapter = createACPAdapter(agentId as ACPAgentId);
    const machineId = req.body.machineId || "default";
    const parts = await adapter.sendMessage(machineId, `acp-exec-${Date.now()}`, task, {
      mode: "sync",
      systemPrompt: model,
    });

    res.json({ agentId, task, result: parts.parts?.[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "ACP execution failed" });
  }
});

// GET /api/acp/:agentId/status — check agent installation status
router.get("/:agentId/status", requireAuth, async (req: any, res) => {
  try {
    const { agentId } = req.params;
    if (!ACP_AGENT_META[agentId as ACPAgentId]) {
      res.status(400).json({ error: `Unknown ACP agent: ${agentId}` });
      return;
    }

    const mgr = getRuntimeManager();
    const health = await mgr.checkHealth(req.body?.machineId || "default", agentId as RuntimeId);
    res.json({ agentId, ...health });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Status check failed" });
  }
});

// POST /api/acp/:agentId/install — install an ACP agent
router.post("/:agentId/install", requireAuth, async (req: any, res) => {
  try {
    const { agentId } = req.params;
    if (!ACP_AGENT_META[agentId as ACPAgentId]) {
      res.status(400).json({ error: `Unknown ACP agent: ${agentId}` });
      return;
    }

    const adapter = createACPAdapter(agentId as ACPAgentId);
    const machineId = req.body.machineId || "default";
    const meta = ACP_AGENT_META[agentId as ACPAgentId];

    await adapter.install(machineId);
    res.json({ agentId, installed: true, installCmd: meta.installCmd });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Installation failed" });
  }
});

export default router;
