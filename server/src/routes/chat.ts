import { Router } from "express";
import type { Request, Response } from "express";
import { getAdapters } from "../adapters/registry.js";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { userApiKeys } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { classifyComplexity, pickModel } from "../lib/model-router.js";
import {
  resolveAttachments,
  countImageBlocks,
  type AttachmentRef,
  type ContentBlock,
} from "../lib/attachments.js";

const router = Router();

// POST /api/chat/route — difficulty router for Model orkestracija.
// Returns the best model the user has an API key for, based on task complexity.
router.post("/route", requireAuth, async (req: Request, res: Response) => {
  const { message, thinking } = req.body as { message?: string; thinking?: string };

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "Missing message" });
    return;
  }

  try {
    const userId = req.user!.userId;
    const keys = await db
      .select({ providerId: userApiKeys.providerId })
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.isEnabled, true)));

    const available = new Set(keys.map((k) => k.providerId));
    const difficulty = classifyComplexity(message);
    const pick = pickModel(difficulty, available, thinking);

    if (!pick) {
      res.json({ difficulty, routed: false, reason: "No API key for a suitable model", availableProviders: Array.from(available) });
      return;
    }

    res.json({
      difficulty,
      routed: true,
      providerId: pick.providerId,
      modelId: pick.modelId,
      reason: pick.reason,
      availableProviders: Array.from(available),
    });
  } catch (error) {
    const message_ = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message_ });
  }
});

// POST /api/chat — streaming SSE proxy via AIProviderAdapter
router.post("/", async (req: Request, res: Response) => {
  const { providerId, modelId, messages, apiKey, thinking, attachments } = req.body as {
    providerId: string;
    modelId: string;
    messages: { role: "user" | "assistant" | "system"; content: string }[];
    apiKey: string;
    thinking?: string;
    attachments?: AttachmentRef[];
  };

  // Providers that work without an API key (e.g. local Ollama).
  const KEYLESS_PROVIDERS = new Set<string>(["ollama"]);

  if (!providerId || !modelId || !messages || (!apiKey && !KEYLESS_PROVIDERS.has(providerId))) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    // Resolve attached files (images → base64 content blocks, other → text note).
    const { contentBlocks } = await resolveAttachments(attachments);

    let finalMessages: { role: "user" | "assistant" | "system"; content: string | ContentBlock[] }[] = messages;
    if (contentBlocks.length > 0) {
      finalMessages = appendBlocksToLastUser(messages, contentBlocks);
      console.log(
        `[chat:debug] provider=${providerId} model=${modelId} attachments=${attachments?.length ?? 0} imageBlocks=${countImageBlocks(contentBlocks)}`
      );
    }

    const adapter = getAdapters().aiProvider;
    const stream = adapter.streamChat({ providerId, modelId, messages: finalMessages, apiKey, thinking });

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

// Attach image/text blocks to the last user message so the model receives them
// as part of the same message as the user's text.
function appendBlocksToLastUser(
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  blocks: ContentBlock[]
): { role: "user" | "assistant" | "system"; content: string | ContentBlock[] }[] {
  const out: { role: "user" | "assistant" | "system"; content: string | ContentBlock[] }[] = messages.map((m) => ({ ...m }));
  for (let i = out.length - 1; i >= 0; i--) {
    const cur = out[i];
    if (cur.role === "user") {
      const text = typeof cur.content === "string" ? cur.content : "";
      const parts: ContentBlock[] = [];
      if (text) parts.push({ type: "text", text });
      parts.push(...blocks);
      out[i] = { ...cur, content: parts };
      break;
    }
  }
  return out;
}

export default router;
