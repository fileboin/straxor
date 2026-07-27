import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { consoleEntries } from "../db/schema.js";
import { eq, and, desc, like, sql } from "drizzle-orm";
import { EventEmitter } from "events";

const router = Router();
const bus = new EventEmitter();
bus.setMaxListeners(50);

// GET /api/console — search console entries
router.get("/", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { category, level, query, limit: limitStr } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(limitStr || "300", 10), 500);

  try {
    const conditions = [eq(consoleEntries.userId, userId)];
    if (category) conditions.push(eq(consoleEntries.category, category));
    if (level) conditions.push(eq(consoleEntries.level, level));
    if (query) conditions.push(like(consoleEntries.message, `%${query}%`));

    const rows = await db
      .select()
      .from(consoleEntries)
      .where(and(...conditions))
      .orderBy(desc(consoleEntries.createdAt))
      .limit(limit);

    const result = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      category: r.category,
      level: r.level,
      message: r.message,
      source: r.source,
      stackTrace: r.stackTrace,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      timestamp: r.createdAt?.toISOString() || new Date().toISOString(),
    }));

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/console — ingest a console entry
router.post("/", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { category, level, message, source, stackTrace, metadata } = req.body as {
    category: string;
    level?: string;
    message: string;
    source?: string;
    stackTrace?: string;
    metadata?: Record<string, unknown>;
  };

  if (!category || !message) {
    res.status(400).json({ error: "category and message are required" });
    return;
  }

  try {
    const [row] = await db
      .insert(consoleEntries)
      .values({
        userId,
        category,
        level: level || "error",
        message,
        source,
        stackTrace,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })
      .returning();

    const entry = {
      id: row.id,
      userId: row.userId,
      category: row.category,
      level: row.level,
      message: row.message,
      source: row.source,
      stackTrace: row.stackTrace,
      metadata,
      timestamp: row.createdAt?.toISOString() || new Date().toISOString(),
    };

    // Broadcast to SSE listeners
    bus.emit("entry", entry);

    res.json(entry);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// DELETE /api/console — clear all console entries for user
router.delete("/", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;

  try {
    await db
      .delete(consoleEntries)
      .where(eq(consoleEntries.userId, userId));
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/console/stream — SSE stream of console entries
router.get("/stream", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { category } = req.query as { category?: string };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const handler = (entry: any) => {
    if (entry.userId !== userId) return;
    if (category && entry.category !== category) return;
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  };

  bus.on("entry", handler);

  req.on("close", () => {
    bus.off("entry", handler);
  });
});

export default router;
