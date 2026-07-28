import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { codeComments, users } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/projects/:projectId/comments — list comments for a file (optional)
router.get("/:projectId", requireAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { filePath } = req.query;

  try {
    const conditions = [eq(codeComments.projectId, projectId)];
    if (filePath) conditions.push(eq(codeComments.filePath, filePath as string));

    const rows = await db
      .select({
        id: codeComments.id,
        userId: codeComments.userId,
        filePath: codeComments.filePath,
        lineStart: codeComments.lineStart,
        lineEnd: codeComments.lineEnd,
        content: codeComments.content,
        parentId: codeComments.parentId,
        isResolved: codeComments.isResolved,
        createdAt: codeComments.createdAt,
        updatedAt: codeComments.updatedAt,
        email: users.email,
      })
      .from(codeComments)
      .innerJoin(users, eq(users.id, codeComments.userId))
      .where(and(...conditions))
      .orderBy(desc(codeComments.createdAt));

    // Group by parentId for threading
    const topLevel = rows.filter((r) => !r.parentId);
    const replies = rows.filter((r) => r.parentId);

    const grouped = topLevel.map((comment) => ({
      ...comment,
      replies: replies.filter((r) => r.parentId === comment.id),
    }));

    res.json(grouped);
  } catch (error) {
    console.error("Comments list error:", error);
    res.status(500).json({ error: "Failed to list comments" });
  }
});

// POST /api/projects/:projectId/comments — add comment
router.post("/:projectId", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { projectId } = req.params;
  const { filePath, lineStart, lineEnd, content, parentId } = req.body as {
    filePath: string;
    lineStart: number;
    lineEnd: number;
    content: string;
    parentId?: string;
  };

  if (!filePath || lineStart === undefined || !content?.trim()) {
    res.status(400).json({ error: "filePath, lineStart, content required" });
    return;
  }

  try {
    const [comment] = await db
      .insert(codeComments)
      .values({
        projectId,
        userId,
        filePath,
        lineStart,
        lineEnd: lineEnd ?? lineStart,
        content: content.trim(),
        parentId: parentId || null,
      })
      .returning();

    res.json(comment);
  } catch (error) {
    console.error("Comment add error:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// PUT /api/projects/:projectId/comments/:commentId — update/resolve
router.put("/:projectId/comments/:commentId", requireAuth, async (req: Request, res: Response) => {
  const { projectId, commentId } = req.params;
  const { content, isResolved } = req.body as { content?: string; isResolved?: boolean };

  try {
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (content !== undefined) updates.content = content;
    if (isResolved !== undefined) updates.isResolved = isResolved;

    const [updated] = await db
      .update(codeComments)
      .set(updates)
      .where(and(eq(codeComments.id, commentId), eq(codeComments.projectId, projectId)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Comment not found" }); return; }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update comment" });
  }
});

// DELETE /api/projects/:projectId/comments/:commentId
router.delete("/:projectId/comments/:commentId", requireAuth, async (req: Request, res: Response) => {
  const { projectId, commentId } = req.params;

  try {
    await db
      .delete(codeComments)
      .where(and(eq(codeComments.id, commentId), eq(codeComments.projectId, projectId)));

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

export default router;
