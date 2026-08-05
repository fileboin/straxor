import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { FRAMEWORKS, AGENT_ROLES, type FrameworkId, type AgentRole } from "../adapters/multi-agent/types.js";
import {
  createInstance, getAllInstances, getInstance, deleteInstance,
  createTask, getTask, getAllTasks, updateTaskStatus, assignTask, autoAssignTask, completeTask,
  sendMessage, getMessages,
  createWorkflow, getAllWorkflows, getWorkflow, deleteWorkflow,
  getStats,
} from "../adapters/multi-agent/orchestrator.js";
import { executeTaskWithOpenCode } from "../adapters/multi-agent/opencode-runner.js";
import { getSharedWorkspaceStatus } from "../runtime/local/shared-workspace.js";

const router = Router();

// ── Frameworks ──

// GET /api/multi-agent/frameworks — list all frameworks
router.get("/frameworks", requireAuth, (_req, res) => {
  res.json(FRAMEWORKS);
});

// GET /api/multi-agent/roles — list all roles
router.get("/roles", requireAuth, (_req, res) => {
  res.json(AGENT_ROLES);
});

// One global GitHub context for every panel and every multi-agent task of the
// signed-in user. It reports the same active repo used by the local engine.
router.get("/context", requireAuth, async (req, res) => {
  try {
    res.json(await getSharedWorkspaceStatus(req.user!.userId));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Context unavailable" });
  }
});

// ── Agent Instances ──

// GET /api/multi-agent/instances — list all agent instances
router.get("/instances", requireAuth, (_req, res) => {
  res.json(getAllInstances());
});

// POST /api/multi-agent/instances — create new agent instance
router.post("/instances", requireAuth, (req, res) => {
  try {
    const { frameworkId, role, name } = req.body;
    if (!frameworkId || !role) {
      return res.status(400).json({ error: "frameworkId and role required" });
    }
    const instance = createInstance(frameworkId as FrameworkId, role as AgentRole, name);
    res.json(instance);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/multi-agent/instances/:id — delete agent instance
router.delete("/instances/:id", requireAuth, (req, res) => {
  const deleted = deleteInstance(req.params.id as string);
  if (!deleted) return res.status(404).json({ error: "Instance not found" });
  res.json({ success: true });
});

// ── Tasks ──

// GET /api/multi-agent/tasks — list all tasks
router.get("/tasks", requireAuth, (_req, res) => {
  res.json(getAllTasks());
});

// POST /api/multi-agent/tasks — create task
router.post("/tasks", requireAuth, (req, res) => {
  try {
    const { title, description, role, priority, input, frameworkId, assignedAgentId, dependencies } = req.body;
    if (!title || !role) {
      return res.status(400).json({ error: "title and role required" });
    }
    const task = createTask({ title, description: description || "", role, priority, input: input || "", frameworkId, assignedAgentId, dependencies });
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/multi-agent/tasks/:id/assign — assign task to agent
router.post("/tasks/:id/assign", requireAuth, (req, res) => {
  try {
    const { agentId } = req.body;
    let task;
    if (agentId) {
      task = assignTask(req.params.id as string, agentId);
    } else {
      task = autoAssignTask(req.params.id as string);
    }
    if (!task) return res.status(404).json({ error: "Task or agent not found" });
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/multi-agent/tasks/:id/status — update task status
router.put("/tasks/:id/status", requireAuth, (req, res) => {
  try {
    const { status, output, error } = req.body;
    const task = updateTaskStatus(req.params.id as string, status, output, error);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/multi-agent/tasks/:id/complete — complete task with output
router.post("/tasks/:id/complete", requireAuth, (req, res) => {
  try {
    const { output, tokens, costUSD } = req.body;
    const task = completeTask(req.params.id as string, output || "", tokens || 0, costUSD || 0);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/multi-agent/tasks/:id/run — execute the assigned role through the
// same local OpenCode engine and repository as the main Agent panel.
router.post("/tasks/:id/run", requireAuth, async (req, res) => {
  const task = getTask(req.params.id as string);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (task.status === "running") return res.status(409).json({ error: "Task is already running" });
  res.status(202).json({ accepted: true, taskId: task.id, status: "running" });
  executeTaskWithOpenCode(req.user!.userId, task.id).catch(() => {});
});

// ── Messages ──

// GET /api/multi-agent/messages — list messages (optional ?taskId=)
router.get("/messages", requireAuth, (req, res) => {
  const { taskId } = req.query;
  res.json(getMessages(taskId as string | undefined));
});

// POST /api/multi-agent/messages — send message between agents
router.post("/messages", requireAuth, (req, res) => {
  try {
    const { fromAgentId, toAgentId, taskId, content, type } = req.body;
    if (!fromAgentId || !taskId || !content) {
      return res.status(400).json({ error: "fromAgentId, taskId, and content required" });
    }
    const msg = sendMessage({ fromAgentId, toAgentId, taskId, content, type: type || "status" });
    res.json(msg);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ── Workflows ──

// GET /api/multi-agent/workflows — list all workflows
router.get("/workflows", requireAuth, (_req, res) => {
  res.json(getAllWorkflows());
});

// POST /api/multi-agent/workflows — create workflow
router.post("/workflows", requireAuth, (req, res) => {
  try {
    const { name, description, steps } = req.body;
    if (!name || !steps || !Array.isArray(steps)) {
      return res.status(400).json({ error: "name and steps[] required" });
    }
    const wf = createWorkflow({ name, description: description || "", steps });
    res.json(wf);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/multi-agent/workflows/:id
router.delete("/workflows/:id", requireAuth, (req, res) => {
  const deleted = deleteWorkflow(req.params.id as string);
  if (!deleted) return res.status(404).json({ error: "Workflow not found" });
  res.json({ success: true });
});

// ── Stats ──

// GET /api/multi-agent/stats
router.get("/stats", requireAuth, (_req, res) => {
  res.json(getStats());
});

export default router;
