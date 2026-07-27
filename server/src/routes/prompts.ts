import { Router } from "express";
import { db } from "../db/index.js";
import { savedPrompts } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/prompts — fetch prompts (optionally filter by projectId)
router.get("/", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { projectId } = req.query;

    const conditions = [eq(savedPrompts.userId, userId)];
    if (projectId) {
      conditions.push(eq(savedPrompts.projectId, projectId));
    }

    const rows = await db
      .select()
      .from(savedPrompts)
      .where(and(...conditions))
      .orderBy(savedPrompts.createdAt);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching prompts:", error);
    res.status(500).json({ error: "Failed to fetch prompts" });
  }
});

// POST /api/prompts — create prompt
router.post("/", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { name, content, category, projectId, isGlobal } = req.body;

    if (!name || !content) {
      return res.status(400).json({ error: "Name and content required" });
    }

    const [row] = await db
      .insert(savedPrompts)
      .values({
        userId,
        name,
        content,
        category: category || "instruction",
        projectId: projectId || null,
        isGlobal: isGlobal || false,
      })
      .returning();

    res.status(201).json(row);
  } catch (error) {
    console.error("Error creating prompt:", error);
    res.status(500).json({ error: "Failed to create prompt" });
  }
});

// PUT /api/prompts/:id — update prompt
router.put("/:id", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { name, content, category, isGlobal } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (content !== undefined) updates.content = content;
    if (category !== undefined) updates.category = category;
    if (isGlobal !== undefined) updates.isGlobal = isGlobal;

    const [row] = await db
      .update(savedPrompts)
      .set(updates)
      .where(and(eq(savedPrompts.id, id), eq(savedPrompts.userId, userId)))
      .returning();

    if (!row) return res.status(404).json({ error: "Prompt not found" });
    res.json(row);
  } catch (error) {
    console.error("Error updating prompt:", error);
    res.status(500).json({ error: "Failed to update prompt" });
  }
});

// DELETE /api/prompts/:id — delete prompt
router.delete("/:id", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const [row] = await db
      .delete(savedPrompts)
      .where(and(eq(savedPrompts.id, id), eq(savedPrompts.userId, userId)))
      .returning();

    if (!row) return res.status(404).json({ error: "Prompt not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting prompt:", error);
    res.status(500).json({ error: "Failed to delete prompt" });
  }
});

export default router;
