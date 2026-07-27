import { Router } from "express";
import type { Request, Response } from "express";
import { getAdapters } from "../adapters/registry.js";

const router = Router();

// POST /api/chat — streaming SSE proxy via AIProviderAdapter
router.post("/", async (req: Request, res: Response) => {
  const { providerId, modelId, messages, apiKey, thinking } = req.body as {
    providerId: string;
    modelId: string;
    messages: { role: "user" | "assistant" | "system"; content: string }[];
    apiKey: string;
    thinking?: string;
  };

  if (!providerId || !modelId || !messages || !apiKey) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const adapter = getAdapters().aiProvider;
    const stream = adapter.streamChat({ providerId, modelId, messages, apiKey, thinking });

    for await (const event of stream) {
      if (event.type === "token") {
        res.write(`data: ${JSON.stringify({ token: event.content })}\n\n`);
      } else if (event.type === "error") {
        res.write(`data: ${JSON.stringify({ error: event.content })}\n\n`);
        break;
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

export default router;
