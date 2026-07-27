import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { userPermissions } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

const router = Router();

const DEFAULT_LEVEL = "ask";

// GET /api/permissions — get all permissions for user
router.get("/", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;

  try {
    const rows = await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId));

    const config: Record<string, string> = {};
    for (const row of rows) {
      config[row.toolId] = row.level;
    }

    res.json(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// PUT /api/permissions — update all permissions for user
router.put("/", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const config = req.body as Record<string, string>;

  if (!config || typeof config !== "object") {
    res.status(400).json({ error: "Invalid permissions config" });
    return;
  }

  try {
    // Delete existing permissions
    await db
      .delete(userPermissions)
      .where(eq(userPermissions.userId, userId));

    // Insert new permissions
    const entries = Object.entries(config).map(([toolId, level]) => ({
      userId,
      toolId,
      level: ["always", "ask", "never"].includes(level) ? level : DEFAULT_LEVEL,
    }));

    if (entries.length > 0) {
      await db.insert(userPermissions).values(entries);
    }

    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/permissions/check/:toolId — check if a tool is allowed
router.get("/check/:toolId", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const toolId = req.params.toolId as string;

  try {
    const [row] = await db
      .select()
      .from(userPermissions)
      .where(and(eq(userPermissions.userId, userId), eq(userPermissions.toolId, toolId)))
      .limit(1);

    const level = (row?.level || DEFAULT_LEVEL) as "always" | "ask" | "never";

    res.json({
      allowed: level !== "never",
      level,
    });
  } catch (error) {
    // Default to ask on error
    res.json({ allowed: true, level: "ask" });
  }
});

export default router;
