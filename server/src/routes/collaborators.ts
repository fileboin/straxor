import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { projectCollaborators, users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/projects/:projectId/collaborators
router.get("/:projectId", requireAuth, async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;

  try {
    const rows = await db
      .select({
        id: projectCollaborators.id,
        userId: projectCollaborators.userId,
        role: projectCollaborators.role,
        permissions: projectCollaborators.permissions,
        createdAt: projectCollaborators.createdAt,
        email: users.email,
      })
      .from(projectCollaborators)
      .innerJoin(users, eq(users.id, projectCollaborators.userId))
      .where(eq(projectCollaborators.projectId, projectId));

    res.json(rows);
  } catch (error) {
    console.error("Collaborators list error:", error);
    res.status(500).json({ error: "Failed to list collaborators" });
  }
});

// POST /api/projects/:projectId/collaborators — add collaborator
router.post("/:projectId", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const projectId = req.params.projectId as string;
  const { email, role } = req.body as { email: string; role?: string };

  try {
    const [invitedUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!invitedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const existing = await db
      .select()
      .from(projectCollaborators)
      .where(and(eq(projectCollaborators.projectId, projectId), eq(projectCollaborators.userId, invitedUser.id)))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Already a collaborator" });
      return;
    }

    const [collab] = await db
      .insert(projectCollaborators)
      .values({ projectId, userId: invitedUser.id, role: role || "member", addedBy: userId })
      .returning();

    res.json(collab);
  } catch (error) {
    console.error("Add collaborator error:", error);
    res.status(500).json({ error: "Failed to add collaborator" });
  }
});

// PUT /api/projects/:projectId/collaborators/:collabId — update role
router.put("/:projectId/collaborators/:collabId", requireAuth, async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const collabId = req.params.collabId as string;
  const { role } = req.body as { role: string };

  try {
    const [updated] = await db
      .update(projectCollaborators)
      .set({ role, updatedAt: new Date() })
      .where(and(eq(projectCollaborators.id, collabId), eq(projectCollaborators.projectId, projectId)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Collaborator not found" }); return; }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update collaborator" });
  }
});

// DELETE /api/projects/:projectId/collaborators/:collabId
router.delete("/:projectId/collaborators/:collabId", requireAuth, async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const collabId = req.params.collabId as string;

  try {
    await db
      .delete(projectCollaborators)
      .where(and(eq(projectCollaborators.id, collabId), eq(projectCollaborators.projectId, projectId)));

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove collaborator" });
  }
});

export default router;
