import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { sessions, deployments, machines, projects } from "../db/schema.js";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";
import { getRuntimeManager } from "../runtime/manager.js";

const router = Router();

type KanbanColumn = "active" | "waiting" | "paused" | "error" | "completed";

interface KanbanCard {
  id: string;
  type: "session" | "deployment" | "machine";
  column: KanbanColumn;
  title: string;
  description: string;
  projectName: string | null;
  agentName: string | null;
  runtimeId: string | null;
  model: string | null;
  status: string;
  error: string | null;
  updatedAt: string;
  actions: {
    canPause: boolean;
    canResume: boolean;
    canChangeModel: boolean;
    canChangeRuntime: boolean;
    canRestart: boolean;
  };
  metadata: Record<string, unknown>;
}

interface KanbanResponse {
  columns: Record<KanbanColumn, KanbanCard[]>;
  summary: {
    total: number;
    active: number;
    waiting: number;
    paused: number;
    error: number;
    completed: number;
  };
}

// GET /api/kanban — aggregated command center view
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const userProjects = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, userId));

    const projectIds = userProjects.map((p) => p.id);
    const projectNames = new Map(userProjects.map((p) => [p.id, p.name]));

    const [sessionRows, deploymentRows, machineRows] = await Promise.all([
      projectIds.length > 0
        ? db
            .select()
            .from(sessions)
            .where(and(eq(sessions.userId, userId), inArray(sessions.projectId, projectIds)))
            .orderBy(desc(sessions.updatedAt))
        : Promise.resolve([]),
      projectIds.length > 0
        ? db
            .select()
            .from(deployments)
            .where(and(eq(deployments.userId, userId), inArray(deployments.projectId, projectIds)))
            .orderBy(desc(deployments.createdAt))
        : Promise.resolve([]),
      db
        .select()
        .from(machines)
        .where(eq(machines.userId, userId))
        .orderBy(desc(machines.updatedAt)),
    ]);

    const manager = getRuntimeManager();
    const machineRuntimeInfo = new Map<string, { runtimeId: string; health: string }>();
    for (const m of machineRows) {
      try {
        const activeId = manager.getActiveId();
        const health = manager.getCachedHealth(activeId);
        machineRuntimeInfo.set(m.id, {
          runtimeId: activeId,
          health: health?.status || "unknown",
        });
      } catch {
        machineRuntimeInfo.set(m.id, { runtimeId: "opencode", health: "unknown" });
      }
    }

    const cards: KanbanCard[] = [];

    for (const s of sessionRows) {
      const agentConfig = tryParseJson(s.agentConfig);
      const errorLog = tryParseJson(s.errorLog);
      const todoSnapshot = tryParseJson(s.todoSnapshot);
      const hasError = !!errorLog?.length;
      const isWaiting =
        todoSnapshot?.some((t: any) => t.status === "needs_review" || t.status === "completed") || false;

      let column: KanbanColumn = "active";
      if (s.status === "paused") column = "paused";
      else if (hasError) column = "error";
      else if (isWaiting) column = "waiting";
      else if (s.status === "completed") column = "completed";

      cards.push({
        id: s.id,
        type: "session",
        column,
        title: s.title || "Nepoznat task",
        description: s.lastTask || "",
        projectName: projectNames.get(s.projectId) || null,
        agentName: agentConfig?.model || agentConfig?.provider || null,
        runtimeId: agentConfig?.runtimeId || machineRuntimeInfo.get(s.machineId)?.runtimeId || null,
        model: agentConfig?.model || null,
        status: s.status,
        error: hasError ? JSON.stringify(errorLog) : null,
        updatedAt: (s.updatedAt || s.createdAt).toISOString(),
        actions: {
          canPause: s.status === "active",
          canResume: s.status === "paused" || s.status === "completed",
          canChangeModel: true,
          canChangeRuntime: true,
          canRestart: hasError,
        },
        metadata: {
          machineId: s.machineId,
          opencodeSessionId: s.opencodeSessionId,
          todoCount: todoSnapshot?.length || 0,
          completedTodos: todoSnapshot?.filter((t: any) => t.status === "completed").length || 0,
        },
      });
    }

    for (const d of deploymentRows) {
      cards.push({
        id: d.id,
        type: "deployment",
        column: d.status === "failed" ? "error" : d.status === "stopped" ? "completed" : "active",
        title: `Deploy: ${d.target}`,
        description: d.branch ? `Branch: ${d.branch}${d.commitMessage ? ` \u2014 ${d.commitMessage}` : ""}` : "",
        projectName: projectNames.get(d.projectId) || null,
        agentName: null,
        runtimeId: null,
        model: null,
        status: d.status,
        error: null,
        updatedAt: (d.finishedAt || d.createdAt).toISOString(),
        actions: {
          canPause: false, canResume: false, canChangeModel: false, canChangeRuntime: false,
          canRestart: d.status === "failed" || d.status === "stopped" || d.status === "building",
        },
        metadata: { target: d.target, liveUrl: d.liveUrl, duration: d.duration },
      });
    }

    for (const m of machineRows) {
      const rt = machineRuntimeInfo.get(m.id);
      const isError = m.status === "error";
      cards.push({
        id: m.id,
        type: "machine",
        column: m.status === "error" ? "error" : m.status === "ready" ? "active" : "paused",
        title: m.name || m.host,
        description: `${m.host}:${m.port}${m.opencodeRunning ? " \u2014 OpenCode \u2713" : " \u2014 OpenCode \u2717"}`,
        projectName: null,
        agentName: null,
        runtimeId: rt?.runtimeId || null,
        model: null,
        status: m.status,
        error: m.lastError || null,
        updatedAt: (m.updatedAt || m.createdAt).toISOString(),
        actions: {
          canPause: m.status === "ready",
          canResume: isError,
          canChangeModel: false,
          canChangeRuntime: true,
          canRestart: isError || !m.opencodeRunning,
        },
        metadata: { host: m.host, port: m.port, opencodeRunning: m.opencodeRunning, opencodePort: m.opencodePort },
      });
    }

    const columns: Record<KanbanColumn, KanbanCard[]> = { active: [], waiting: [], paused: [], error: [], completed: [] };
    for (const card of cards) {
      columns[card.column]?.push(card);
    }

    const summary = { total: cards.length, active: columns.active.length, waiting: columns.waiting.length, paused: columns.paused.length, error: columns.error.length, completed: columns.completed.length };

    res.json({ columns, summary });
  } catch (error) {
    console.error("Kanban error:", error);
    res.status(500).json({ error: "Failed to load command center" });
  }
});

// POST /api/kanban/session/:id/pause
router.post("/session/:id/pause", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;

  try {
    const [s] = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId))).limit(1);
    if (!s) { res.status(404).json({ error: "Session not found" }); return; }

    await db.update(sessions).set({ status: "paused", updatedAt: new Date() }).where(eq(sessions.id, id));

    if (s.opencodeSessionId) {
      try {
        const adapter = getAdapters().runtime(userId);
        await adapter.abortSession(s.machineId, s.opencodeSessionId);
      } catch {}
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to pause session" });
  }
});

// POST /api/kanban/session/:id/resume
router.post("/session/:id/resume", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;

  try {
    await db.update(sessions).set({ status: "active", updatedAt: new Date() }).where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to resume session" });
  }
});

// POST /api/kanban/session/:id/change-model
router.post("/session/:id/change-model", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const { provider, model } = req.body as { provider?: string; model?: string };

  try {
    const [s] = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId))).limit(1);
    if (!s) { res.status(404).json({ error: "Session not found" }); return; }

    const agentConfig = tryParseJson(s.agentConfig) || {};
    if (provider) agentConfig.provider = provider;
    if (model) agentConfig.model = model;

    await db.update(sessions).set({ agentConfig: JSON.stringify(agentConfig), updatedAt: new Date() }).where(eq(sessions.id, id));

    try {
      const manager = getRuntimeManager();
      await (manager as any).updateRuntime(s.machineId, undefined, { provider, model });
    } catch {}

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to change model" });
  }
});

// POST /api/kanban/session/:id/change-runtime
router.post("/session/:id/change-runtime", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const { runtimeId } = req.body as { runtimeId: string };

  try {
    const [s] = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId))).limit(1);
    if (!s) { res.status(404).json({ error: "Session not found" }); return; }

    const agentConfig = tryParseJson(s.agentConfig) || {};
    agentConfig.runtimeId = runtimeId;

    await db.update(sessions).set({ agentConfig: JSON.stringify(agentConfig), updatedAt: new Date() }).where(eq(sessions.id, id));

    try {
      const manager = getRuntimeManager();
      manager.setActive(runtimeId as any);
    } catch {}

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to change runtime" });
  }
});

function tryParseJson(val: string | null | undefined): any {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

export default router;
