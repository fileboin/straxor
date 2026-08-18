import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  WEBHOOK_EVENTS,
  createWebhook,
  deleteWebhook,
  deliverTestEvent,
  listWebhooks,
  updateWebhook,
  type WebhookInput,
} from "../lib/webhooks.js";

const router = Router();

router.use(requireAuth);

function parseInput(body: Record<string, unknown>): WebhookInput {
  const events = Array.isArray(body.events)
    ? (body.events as string[])
    : body.events === undefined
      ? ["*"]
      : [];
  return {
    url: String(body.url ?? ""),
    events,
    secret: typeof body.secret === "string" ? body.secret : null,
    active: typeof body.active === "boolean" ? body.active : undefined,
  };
}

// GET /api/webhooks — list the user's webhooks
router.get("/", async (req: Request, res: Response) => {
  try {
    const hooks = await listWebhooks(req.userId as string);
    res.json({ webhooks: hooks, events: WEBHOOK_EVENTS });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// POST /api/webhooks — register a new webhook
router.post("/", async (req: Request, res: Response) => {
  try {
    const input = parseInput(req.body ?? {});
    if (!input.url) {
      res.status(400).json({ error: "url is required" });
      return;
    }
    const hook = await createWebhook(req.userId as string, input);
    res.status(201).json(hook);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(message.includes("must start with") ? 400 : 500).json({ error: message });
  }
});

// PATCH /api/webhooks/:id — update url/events/secret/active
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const input = parseInput(req.body ?? {});
    const hook = await updateWebhook(req.userId as string, req.params.id as string, input);
    if (!hook) {
      res.status(404).json({ error: "Webhook not found" });
      return;
    }
    res.json(hook);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(message.includes("must start with") ? 400 : 500).json({ error: message });
  }
});

// DELETE /api/webhooks/:id — remove a webhook
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await deleteWebhook(req.userId as string, req.params.id as string);
    if (!deleted) {
      res.status(404).json({ error: "Webhook not found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// POST /api/webhooks/:id/test — send a signed test ping immediately
router.post("/:id/test", async (req: Request, res: Response) => {
  try {
    const result = await deliverTestEvent(req.userId as string, req.params.id as string, {
      ping: true,
      at: new Date().toISOString(),
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(message === "Webhook not found" ? 404 : 500).json({ error: message });
  }
});

export default router;
