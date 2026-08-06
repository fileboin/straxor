import { Router } from "express";
import type { Request, Response } from "express";
import { getAdapters } from "../adapters/registry.js";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { userApiKeys, repoConnections } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { classifyComplexity, pickModel } from "../lib/model-router.js";
import { getSharedWorkspaceStatus, normalizeSlot } from "../runtime/local/shared-workspace.js";
import {
  resolveAttachments,
  countImageBlocks,
  type AttachmentRef,
  type ContentBlock,
} from "../lib/attachments.js";

const router = Router();

// POST /api/chat/orchestrate — parallel multi-model execution.
// Accepts an array of models; runs all in parallel, merges SSE stream
// tagged with modelId so the client can display side-by-side results.
router.post("/orchestrate", requireAuth, async (req: Request, res: Response) => {
  const {
    models,
    messages,
    thinking,
    attachments,
  } = req.body as {
    models: { providerId: string; modelId: string; apiKey: string }[];
    messages: { role: "user" | "assistant" | "system"; content: string }[];
    thinking?: string;
    attachments?: AttachmentRef[];
  };

  if (!models || !Array.isArray(models) || models.length === 0) {
    res.status(400).json({ error: "models array required (1+ entries)" });
    return;
  }
  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const { contentBlocks } = await resolveAttachments(attachments);
    let finalMessages: { role: "user" | "assistant" | "system"; content: string | ContentBlock[] }[] = messages;
    if (contentBlocks.length > 0) {
      finalMessages = appendBlocksToLastUser(messages, contentBlocks);
    }

    const adapter = getAdapters().aiProvider;

    // Launch all model streams in parallel.
    const streams = models.map((m) =>
      adapter.streamChat({
        providerId: m.providerId,
        modelId: m.modelId,
        messages: finalMessages,
        apiKey: m.apiKey,
        thinking,
      })
    );

    const readers = streams.map((s) => s[Symbol.asyncIterator]());
    const done = new Array(readers.length).fill(false);
    let activeCount = readers.length;

    async function pull(idx: number) {
      try {
        while (true) {
          const { done: d, value } = await readers[idx].next();
          if (d) {
            done[idx] = true;
            activeCount--;
            if (activeCount === 0) {
              res.write("data: [DONE]\n\n");
              res.end();
            }
            return;
          }
          const event = value;
          if (event.type === "token") {
            res.write(
              `data: ${JSON.stringify({ modelIndex: idx, token: event.content })}\n\n`
            );
          } else if (event.type === "error") {
            res.write(
              `data: ${JSON.stringify({ modelIndex: idx, error: event.content })}\n\n`
            );
          }
        }
      } catch {
        done[idx] = true;
        activeCount--;
        if (activeCount === 0) {
          res.write("data: [DONE]\n\n");
          res.end();
        }
      }
    }

    await Promise.all(readers.map((_, i) => pull(i)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

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
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { providerId, modelId, messages, apiKey, thinking, attachments, slot } = req.body as {
    providerId: string;
    modelId: string;
    messages: { role: "user" | "assistant" | "system"; content: string }[];
    apiKey: string;
    thinking?: string;
    attachments?: AttachmentRef[];
    slot?: string | null;
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

    // Inject the active GitHub repository context (Ask panel). The Agent panel
    // already gets this via /api/agent/send; this makes Ask aware of the repo too.
    const context = await buildRepoContext(req.user!.userId, slot);
    if (context) {
      finalMessages = prependContextToLastUser(finalMessages, context);
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

// Build the [STRAXOR GITHUB CONTEXT] block for the Ask panel when the user has
// an active repository. Returns undefined when nothing is connected.
async function buildRepoContext(userId: string, slot?: string | null): Promise<string | undefined> {
  try {
    const normalizedSlot = normalizeSlot(slot);
    const [repo] = await db
      .select()
      .from(repoConnections)
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true), eq(repoConnections.slot, normalizedSlot)))
      .limit(1);
    if (!repo) return undefined;
    const status = await getSharedWorkspaceStatus(userId, normalizedSlot);
    const dir = status.connected ? status.workspace : "";
    return [
      "[STRAXOR GITHUB CONTEXT]",
      `Active repository: ${repo.fullName}`,
      `Active branch: ${repo.defaultBranch}`,
      dir ? `Workspace directory: ${dir}` : null,
      "You are connected to a GitHub repository. Answer questions about this repository and its code when relevant. Do not claim a repository is unavailable unless you have verified it.",
      "[/STRAXOR GITHUB CONTEXT]",
    ]
      .filter((l): l is string => !!l)
      .join("\n");
  } catch {
    return undefined;
  }
}

// Prepend the context block to the last user message (before any attachments).
function prependContextToLastUser(
  messages: { role: "user" | "assistant" | "system"; content: string | ContentBlock[] }[],
  context: string
): { role: "user" | "assistant" | "system"; content: string | ContentBlock[] }[] {
  const out = messages.map((m) => ({ ...m }));
  for (let i = out.length - 1; i >= 0; i--) {
    const cur = out[i];
    if (cur.role === "user") {
      const text = typeof cur.content === "string" ? cur.content : "";
      const blocks = typeof cur.content === "string" ? [] : (cur.content as ContentBlock[]);
      out[i] = {
        ...cur,
        content: [{ type: "text", text: `${context}\n\n${text}` }, ...blocks],
      };
      break;
    }
  }
  return out;
}

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
