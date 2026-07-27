import { Router } from "express";
import type { Request, Response } from "express";
import { getAdapters } from "../adapters/registry.js";

const router = Router();

// GET /api/logs — search logs
router.get("/", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { category, level, query, limit, offset } = req.query as Record<string, string>;

  try {
    const adapter = getAdapters().log;
    const entries = await adapter.search(userId, {
      category: category as any,
      level: level as any,
      query,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    res.json(entries);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/logs/stream — SSE real-time log stream
router.get("/stream", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { category } = req.query as { category?: string };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const adapter = getAdapters().log;
    const stream = adapter.stream(userId, category as any);

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 15000);

    res.on("close", () => {
      clearInterval(heartbeat);
      stream.return(undefined);
    });

    for await (const entry of stream) {
      if (res.closed) break;
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  }

  res.write("data: [DONE]\n\n");
  res.end();
});

// GET /api/logs/export — export logs
router.get("/export", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { category, format } = req.query as { category?: string; format?: string };

  try {
    const adapter = getAdapters().log;
    const data = await adapter.exportLogs(userId, {
      category: category as any,
      format: (format as "json" | "csv") || "json",
    });

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=logs.csv");
    } else {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=logs.json");
    }

    res.send(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/logs — ingest a log entry
router.post("/", async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { category, level, message, source, metadata } = req.body as {
    category: string;
    level?: string;
    message: string;
    source?: string;
    metadata?: Record<string, unknown>;
  };

  if (!category || !message) {
    res.status(400).json({ error: "category and message are required" });
    return;
  }

  try {
    const adapter = getAdapters().log;
    const entry = await adapter.ingest({
      userId,
      category: category as any,
      level: (level as any) || "info",
      message,
      source,
      metadata,
    });
    res.status(201).json(entry);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
