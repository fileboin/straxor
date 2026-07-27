import { Router } from "express";
import { db } from "../db/index.js";
import { sessions, sessionMessages } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";

const router = Router();

// GET /api/sessions — list sessions for a project
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: "projectId required" });
    }

    const rows = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.projectId, projectId)))
      .orderBy(desc(sessions.updatedAt));

    res.json(rows);
  } catch (error) {
    console.error("Error listing sessions:", error);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

// GET /api/sessions/:id — get session with messages
router.get("/:id", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const messages = await db
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.sessionId, id))
      .orderBy(sessionMessages.createdAt);

    res.json({ ...session, messages });
  } catch (error) {
    console.error("Error getting session:", error);
    res.status(500).json({ error: "Failed to get session" });
  }
});

// POST /api/sessions — create new session
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { projectId, machineId, title, agentConfig, askConfig } = req.body;

    if (!projectId || !machineId) {
      return res.status(400).json({ error: "projectId and machineId required" });
    }

    // Create OpenCode session on VPS
    let opencodeSessionId: string | null = null;
    try {
      const runtime = getAdapters().runtime(userId);
      const result = await runtime.createSession(
        machineId,
        title || "Straxor Session"
      );
      opencodeSessionId = result.id;
    } catch (err) {
      console.error("Failed to create OpenCode session:", err);
    }

    const [row] = await db
      .insert(sessions)
      .values({
        userId,
        projectId,
        machineId,
        opencodeSessionId,
        title: title || null,
        status: "active",
        agentConfig: agentConfig ? JSON.stringify(agentConfig) : null,
        askConfig: askConfig ? JSON.stringify(askConfig) : null,
      })
      .returning();

    res.status(201).json(row);
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

// PATCH /api/sessions/:id — update session metadata
router.patch("/:id", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const updates = req.body;

    // Only allow updating specific fields
    const allowed: Record<string, unknown> = {};
    if (updates.title !== undefined) allowed.title = updates.title;
    if (updates.status !== undefined) allowed.status = updates.status;
    if (updates.lastTask !== undefined) allowed.lastTask = updates.lastTask;
    if (updates.context !== undefined) allowed.context = updates.context;
    if (updates.todoSnapshot !== undefined)
      allowed.todoSnapshot =
        typeof updates.todoSnapshot === "string"
          ? updates.todoSnapshot
          : JSON.stringify(updates.todoSnapshot);
    if (updates.errorLog !== undefined)
      allowed.errorLog =
        typeof updates.errorLog === "string"
          ? updates.errorLog
          : JSON.stringify(updates.errorLog);
    if (updates.agentConfig !== undefined)
      allowed.agentConfig =
        typeof updates.agentConfig === "string"
          ? updates.agentConfig
          : JSON.stringify(updates.agentConfig);
    if (updates.askConfig !== undefined)
      allowed.askConfig =
        typeof updates.askConfig === "string"
          ? updates.askConfig
          : JSON.stringify(updates.askConfig);
    if (updates.activePromptIds !== undefined)
      allowed.activePromptIds =
        typeof updates.activePromptIds === "string"
          ? updates.activePromptIds
          : JSON.stringify(updates.activePromptIds);

    allowed.updatedAt = new Date();

    const [row] = await db
      .update(sessions)
      .set(allowed)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
      .returning();

    if (!row) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(row);
  } catch (error) {
    console.error("Error updating session:", error);
    res.status(500).json({ error: "Failed to update session" });
  }
});

// POST /api/sessions/:id/messages — save a message
router.post("/:id/messages", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { role, content, label, toolCalls } = req.body;

    // Verify session ownership
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const [row] = await db
      .insert(sessionMessages)
      .values({
        sessionId: id,
        role: role || "user",
        content: content || "",
        label: label || null,
        toolCalls: toolCalls ? JSON.stringify(toolCalls) : null,
      })
      .returning();

    // Update session updatedAt
    await db
      .update(sessions)
      .set({ updatedAt: new Date() })
      .where(eq(sessions.id, id));

    res.status(201).json(row);
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json({ error: "Failed to save message" });
  }
});

// GET /api/sessions/:id/messages — get messages for a session
router.get("/:id/messages", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Verify session ownership
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const messages = await db
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.sessionId, id))
      .orderBy(sessionMessages.createdAt);

    res.json(messages);
  } catch (error) {
    console.error("Error getting messages:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

// DELETE /api/sessions/:id — delete session
router.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    await db
      .delete(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting session:", error);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

export default router;
