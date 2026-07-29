import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { publishLinks, projects } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import crypto from "crypto";

const router = Router();

function generateSlug(): string {
  return crypto.randomBytes(6).toString("base64url").toLowerCase();
}

function generateUrl(slug: string): string {
  const base = process.env.PUBLISH_DOMAIN || "https://straxor.app";
  return `${base}/p/${slug}`;
}

// GET /api/publish/:projectId — list publish links for a project
router.get("/:projectId", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { projectId } = req.params;
  try {
    const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    const links = await db.select().from(publishLinks)
      .where(eq(publishLinks.projectId, projectId))
      .orderBy(desc(publishLinks.createdAt));
    res.json(links.map(l => ({ ...l, hasPassword: !!l.passwordHash })));
  } catch (error) {
    console.error("Publish list error:", error);
    res.status(500).json({ error: "Failed to list publish links" });
  }
});

// POST /api/publish/:projectId — create publish link
router.post("/:projectId", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { projectId } = req.params;
  const { password, expiresInHours } = req.body as { password?: string; expiresInHours?: number };
  try {
    const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    const slug = generateSlug();
    const url = generateUrl(slug);
    const passwordHash = password ? crypto.createHash("sha256").update(password).digest("hex") : null;
    const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 3600000) : null;
    const [link] = await db.insert(publishLinks).values({ projectId, userId, slug, url, passwordHash, expiresAt }).returning();
    res.status(201).json({ ...link, hasPassword: !!link.passwordHash });
  } catch (error) {
    console.error("Publish create error:", error);
    res.status(500).json({ error: "Failed to create publish link" });
  }
});

// PUT /api/publish/:projectId/:linkId — update publish link
router.put("/:projectId/:linkId", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { projectId, linkId } = req.params;
  const { isEnabled, password, expiresInHours } = req.body as { isEnabled?: boolean; password?: string | null; expiresInHours?: number | null };
  try {
    const [existing] = await db.select().from(publishLinks).where(and(eq(publishLinks.id, linkId), eq(publishLinks.projectId, projectId), eq(publishLinks.userId, userId)));
    if (!existing) { res.status(404).json({ error: "Link not found" }); return; }
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (isEnabled !== undefined) update.isEnabled = isEnabled;
    if (password !== undefined) update.passwordHash = password ? crypto.createHash("sha256").update(password).digest("hex") : null;
    if (expiresInHours !== undefined) update.expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 3600000) : null;
    const [link] = await db.update(publishLinks).set(update).where(eq(publishLinks.id, linkId)).returning();
    res.json({ ...link, hasPassword: !!link.passwordHash });
  } catch (error) {
    console.error("Publish update error:", error);
    res.status(500).json({ error: "Failed to update link" });
  }
});

// DELETE /api/publish/:projectId/:linkId — delete publish link
router.delete("/:projectId/:linkId", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { projectId, linkId } = req.params;
  try {
    const [existing] = await db.select().from(publishLinks).where(and(eq(publishLinks.id, linkId), eq(publishLinks.projectId, projectId), eq(publishLinks.userId, userId)));
    if (!existing) { res.status(404).json({ error: "Link not found" }); return; }
    await db.delete(publishLinks).where(eq(publishLinks.id, linkId));
    res.json({ success: true });
  } catch (error) {
    console.error("Publish delete error:", error);
    res.status(500).json({ error: "Failed to delete link" });
  }
});

// POST /api/publish/verify/:slug — verify password for protected link (public)
router.post("/verify/:slug", async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { password } = req.body as { password?: string };
  try {
    const [link] = await db.select().from(publishLinks).where(and(eq(publishLinks.slug, slug), eq(publishLinks.isEnabled, true)));
    if (!link) { res.status(404).json({ error: "Link not found" }); return; }
    if (link.expiresAt && new Date() > link.expiresAt) { res.status(410).json({ error: "Link expired" }); return; }
    if (link.passwordHash) {
      if (!password) { res.json({ protected: true }); return; }
      const hash = crypto.createHash("sha256").update(password).digest("hex");
      if (hash !== link.passwordHash) { res.status(403).json({ error: "Invalid password" }); return; }
    }
    res.json({ protected: false, url: link.url, projectId: link.projectId });
  } catch (error) {
    console.error("Publish verify error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;
