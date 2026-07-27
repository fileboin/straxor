import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { projectEnvs, projectEnvHistory } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// Known validation rules for common env keys
const VALIDATION_RULES: Record<string, { pattern?: RegExp; required?: boolean; description?: string }> = {
  DATABASE_URL: { pattern: /^postgres(ql)?:\/\//, required: true, description: "PostgreSQL connection string" },
  API_KEY: { required: true, description: "API key for external service" },
  SECRET: { required: true, description: "Application secret" },
  JWT_SECRET: { required: true, description: "JWT signing secret" },
  PORT: { pattern: /^\d+$/, description: "Port number" },
  NODE_ENV: { pattern: /^(development|production|test)$/, description: "Node environment" },
  CLIENT_URL: { pattern: /^https?:\/\//, description: "Frontend URL for CORS" },
};

function validateEnvKey(key: string, value: string): string | null {
  const rule = VALIDATION_RULES[key];
  if (!rule) return null;
  if (rule.required && (!value || value.trim() === "")) {
    return `${key} je obavezan`;
  }
  if (rule.pattern && value && !rule.pattern.test(value)) {
    return `${key} nije u valjanom formatu`;
  }
  return null;
}

// GET /api/envs/:projectId — list env vars
router.get("/:projectId", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const projectId = req.params.projectId as string;

  try {
    const rows = await db
      .select()
      .from(projectEnvs)
      .where(and(eq(projectEnvs.projectId, projectId), eq(projectEnvs.userId, userId)))
      .orderBy(projectEnvs.key);

    const envs = rows.map((r) => ({
      id: r.id,
      key: r.key,
      value: r.isSecret ? "••••••••" : r.value,
      rawValue: r.value,
      description: r.description,
      isSecret: r.isSecret,
      isRequired: r.isRequired,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.json(envs);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/envs/:projectId — create env var
router.post("/:projectId", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const projectId = req.params.projectId as string;
  const { key, value, description, isSecret, isRequired } = req.body as {
    key: string;
    value: string;
    description?: string;
    isSecret?: boolean;
    isRequired?: boolean;
  };

  if (!key || key.trim() === "") {
    res.status(400).json({ error: "Key je obavezan" });
    return;
  }

  // Validate
  const error = validateEnvKey(key, value);
  if (error) {
    res.status(400).json({ error });
    return;
  }

  try {
    // Check for duplicate key
    const existing = await db
      .select()
      .from(projectEnvs)
      .where(and(eq(projectEnvs.projectId, projectId), eq(projectEnvs.key, key)))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: `Key "${key}" već postoji` });
      return;
    }

    const [row] = await db
      .insert(projectEnvs)
      .values({
        projectId,
        userId,
        key,
        value,
        description,
        isSecret: isSecret || false,
        isRequired: isRequired || false,
      })
      .returning();

    // Log history
    await db.insert(projectEnvHistory).values({
      projectId,
      userId,
      envId: row.id,
      action: "create",
      key,
      newValue: isSecret ? "[hidden]" : value,
    });

    res.status(201).json({
      id: row.id,
      key: row.key,
      value: row.isSecret ? "••••••••" : row.value,
      rawValue: row.value,
      description: row.description,
      isSecret: row.isSecret,
      isRequired: row.isRequired,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// PUT /api/envs/:projectId/:envId — update env var
router.put("/:projectId/:envId", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const projectId = req.params.projectId as string;
  const envId = req.params.envId as string;
  const { value, description, isSecret, isRequired } = req.body as {
    value?: string;
    description?: string;
    isSecret?: boolean;
    isRequired?: boolean;
  };

  try {
    const existing = await db
      .select()
      .from(projectEnvs)
      .where(and(eq(projectEnvs.id, envId), eq(projectEnvs.projectId, projectId)))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Env var not found" });
      return;
    }

    const old = existing[0];

    // Validate new value if provided
    if (value !== undefined) {
      const error = validateEnvKey(old.key, value);
      if (error) {
        res.status(400).json({ error });
        return;
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (value !== undefined) updates.value = value;
    if (description !== undefined) updates.description = description;
    if (isSecret !== undefined) updates.isSecret = isSecret;
    if (isRequired !== undefined) updates.isRequired = isRequired;

    await db
      .update(projectEnvs)
      .set(updates)
      .where(eq(projectEnvs.id, envId));

    // Log history
    if (value !== undefined && value !== old.value) {
      await db.insert(projectEnvHistory).values({
        projectId,
        userId,
        envId,
        action: "update",
        key: old.key,
        oldValue: old.isSecret ? "[hidden]" : old.value,
        newValue: isSecret ? "[hidden]" : value,
      });
    }

    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// DELETE /api/envs/:projectId/:envId — delete env var
router.delete("/:projectId/:envId", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const projectId = req.params.projectId as string;
  const envId = req.params.envId as string;

  try {
    const existing = await db
      .select()
      .from(projectEnvs)
      .where(and(eq(projectEnvs.id, envId), eq(projectEnvs.projectId, projectId)))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Env var not found" });
      return;
    }

    const old = existing[0];

    await db.delete(projectEnvs).where(eq(projectEnvs.id, envId));

    // Log history
    await db.insert(projectEnvHistory).values({
      projectId,
      userId,
      envId,
      action: "delete",
      key: old.key,
      oldValue: old.isSecret ? "[hidden]" : old.value,
    });

    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/envs/:projectId/history — get env history
router.get("/:projectId/history", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const projectId = req.params.projectId as string;
  const { limit } = req.query as { limit?: string };

  try {
    const rows = await db
      .select()
      .from(projectEnvHistory)
      .where(and(eq(projectEnvHistory.projectId, projectId), eq(projectEnvHistory.userId, userId)))
      .orderBy(desc(projectEnvHistory.createdAt))
      .limit(limit ? parseInt(limit, 10) : 50);

    res.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/envs/:projectId/validate — validate all env vars
router.post("/:projectId/validate", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const projectId = req.params.projectId as string;

  try {
    const rows = await db
      .select()
      .from(projectEnvs)
      .where(and(eq(projectEnvs.projectId, projectId), eq(projectEnvs.userId, userId)));

    const errors: { key: string; error: string }[] = [];

    for (const row of rows) {
      if (row.isRequired && (!row.value || row.value.trim() === "")) {
        errors.push({ key: row.key, error: "Obavezno polje je prazno" });
        continue;
      }
      const err = validateEnvKey(row.key, row.value);
      if (err) {
        errors.push({ key: row.key, error: err });
      }
    }

    res.json({ valid: errors.length === 0, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
