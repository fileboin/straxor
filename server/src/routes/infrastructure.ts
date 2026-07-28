import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { infraConfigs } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { createInfrastructureRegistry } from "../adapters/infrastructure/registry.js";
import { getProvidersByType, getProvider as getProviderDef, type InfraType, type InfraConfig } from "../adapters/infrastructure/types.js";

const router = Router();

const registry = createInfrastructureRegistry();

// GET /api/infrastructure/providers — list all providers
router.get("/providers", requireAuth, (_req: Request, res: Response) => {
  res.json(registry.getProviders());
});

// GET /api/infrastructure/providers/:type — filter by type
router.get("/providers/:type", requireAuth, (req: Request, res: Response) => {
  const providers = getProvidersByType(req.params.type as InfraType);
  res.json(providers);
});

// GET /api/infrastructure — list user's infra configs
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { type } = req.query;

  try {
    const conditions = [eq(infraConfigs.userId, userId)];
    if (type) conditions.push(eq(infraConfigs.type, type as string));

    const rows = await db
      .select()
      .from(infraConfigs)
      .where(and(...conditions))
      .orderBy(desc(infraConfigs.createdAt));

    const parsed = rows.map(parseRow);
    res.json(parsed);
  } catch (error) {
    console.error("Infra list error:", error);
    res.status(500).json({ error: "Failed to list infrastructure configs" });
  }
});

// POST /api/infrastructure — add config
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { type, adapter, name, domain, projectId, machineId, config, credentials } = req.body as Record<string, any>;

  if (!type || !adapter || !name) {
    res.status(400).json({ error: "type, adapter, name required" });
    return;
  }

  try {
    const [row] = await db
      .insert(infraConfigs)
      .values({
        userId,
        projectId: projectId || null,
        machineId: machineId || null,
        type,
        adapter,
        name,
        domain: domain || null,
        status: "pending",
        config: config ? JSON.stringify(config) : "{}",
        credentials: credentials ? JSON.stringify(credentials) : "{}",
      })
      .returning();

    res.json(parseRow(row));
  } catch (error) {
    console.error("Infra add error:", error);
    res.status(500).json({ error: "Failed to add infra config" });
  }
});

// PUT /api/infrastructure/:id — update config
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  const body = req.body as Record<string, any>;

  try {
    const updates: Record<string, any> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.domain !== undefined) updates.domain = body.domain;
    if (body.projectId !== undefined) updates.projectId = body.projectId;
    if (body.machineId !== undefined) updates.machineId = body.machineId;
    if (body.status !== undefined) updates.status = body.status;
    if (body.config !== undefined) updates.config = JSON.stringify(body.config);
    if (body.credentials !== undefined) updates.credentials = JSON.stringify(body.credentials);
    if (body.lastError !== undefined) updates.lastError = body.lastError;
    updates.updatedAt = new Date();

    const [row] = await db
      .update(infraConfigs)
      .set(updates)
      .where(and(eq(infraConfigs.id, id), eq(infraConfigs.userId, userId)))
      .returning();

    if (!row) { res.status(404).json({ error: "Config not found" }); return; }
    res.json(parseRow(row));
  } catch (error) {
    console.error("Infra update error:", error);
    res.status(500).json({ error: "Failed to update infra config" });
  }
});

// DELETE /api/infrastructure/:id
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { id } = req.params;

  try {
    await db.delete(infraConfigs).where(and(eq(infraConfigs.id, id), eq(infraConfigs.userId, userId)));
    res.json({ ok: true });
  } catch (error) {
    console.error("Infra delete error:", error);
    res.status(500).json({ error: "Failed to delete infra config" });
  }
});

// POST /api/infrastructure/:id/test — test/health check
router.post("/:id/test", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { id } = req.params;

  try {
    const [row] = await db
      .select()
      .from(infraConfigs)
      .where(and(eq(infraConfigs.id, id), eq(infraConfigs.userId, userId)))
      .limit(1);

    if (!row) { res.status(404).json({ error: "Config not found" }); return; }

    const config = parseRow(row);
    const result = await registry.healthCheck(config);

    // Update lastChecked
    await db
      .update(infraConfigs)
      .set({
        lastChecked: new Date(),
        status: result.status === "ok" ? "active" : "error",
        lastError: result.message,
      })
      .where(eq(infraConfigs.id, id));

    res.json(result);
  } catch (error) {
    console.error("Infra test error:", error);
    res.status(500).json({ error: "Failed to test infra config" });
  }
});

function parseRow(row: any): InfraConfig {
  return {
    ...row,
    config: tryParseJson(row.config) || {},
    credentials: tryParseJson(row.credentials) || {},
    createdAt: row.createdAt?.toISOString?.() || row.createdAt,
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt,
    lastChecked: row.lastChecked?.toISOString?.() || row.lastChecked || null,
  };
}

function tryParseJson(val: string | null | undefined): any {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

export default router;
