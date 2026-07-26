import { Router } from "express";
import { db } from "../db/index.js";
import { projects } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, req.user!.userId))
    .orderBy(desc(projects.createdAt));

  res.json(rows);
});

router.post("/", async (req, res) => {
  const { name, description, template, color } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: "Naziv projekta je obavezan" });
  }

  const validTemplates = ["empty", "react", "nextjs", "node-api", "fastapi", "flutter", "expo", "laravel"];
  const templateValue = validTemplates.includes(template) ? template : "empty";

  const [project] = await db
    .insert(projects)
    .values({
      userId: req.user!.userId,
      name: name.trim(),
      description: description?.trim() || null,
      template: templateValue,
      color: color || "#3b82f6",
    })
    .returning();

  res.status(201).json(project);
});

router.delete("/:id", async (req, res) => {
  const [deleted] = await db
    .delete(projects)
    .where(eq(projects.id, req.params.id))
    .returning();

  if (!deleted) {
    return res.status(404).json({ error: "Projekt nije pronađen" });
  }

  res.json({ ok: true });
});

export default router;
