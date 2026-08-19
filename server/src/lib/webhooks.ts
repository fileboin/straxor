// ── Webhooks (Phase 3): outbound webhook endpoints for external integrations ──
// Users register a URL + event filter. When a matching platform event fires,
// dispatchWebhook POSTs a signed JSON payload. Delivery is best-effort and
// never blocks the caller; the last delivery status is recorded on the row.

import { createHmac, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { webhooks } from "../db/schema.js";

export const WEBHOOK_EVENTS = [
  "agent.run.completed",
  "agent.run.failed",
  "team.task.verified",
  "team.task.approved",
  "terminal.process.exited",
  "preview.started",
  "preview.stopped",
  "deploy.completed",
  "deploy.failed",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookRecord {
  id: string;
  userId: string;
  url: string;
  secret: string | null;
  events: string[];
  active: boolean;
  lastDeliveryAt: Date | null;
  lastDeliveryStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookInput {
  url: string;
  events: string[];
  secret?: string | null;
  active?: boolean;
}

// Pure helpers (unit-tested below).

/** HMAC-SHA256 hex signature over the canonical JSON body. */
export function signWebhookPayload(secret: string, payload: unknown): string {
  return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

export function generateDeliveryId(): string {
  return randomUUID();
}

/** A hook fires when it subscribes to "*" or to the exact event name. */
export function webhookMatchesEvent(events: string[], event: string): boolean {
  return events.includes("*") || events.includes(event);
}

export function normalizeWebhookUrl(url: string): string {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error("Webhook URL must start with http:// or https://");
  }
  return trimmed;
}

// DB CRUD. Best-effort like agent-jobs: if the table has not been migrated,
// these throw and the caller can fall back gracefully.

function toRecord(row: typeof webhooks.$inferSelect): WebhookRecord {
  return {
    id: row.id,
    userId: row.userId,
    url: row.url,
    secret: row.secret,
    events: (row.events ?? []) as string[],
    active: row.active,
    lastDeliveryAt: row.lastDeliveryAt,
    lastDeliveryStatus: row.lastDeliveryStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createWebhook(userId: string, input: WebhookInput): Promise<WebhookRecord> {
  const url = normalizeWebhookUrl(input.url);
  const [row] = await db
    .insert(webhooks)
    .values({
      userId,
      url,
      secret: input.secret?.trim() || null,
      events: input.events ?? ["*"],
      active: input.active ?? true,
    })
    .returning();
  return toRecord(row);
}

export async function listWebhooks(userId: string): Promise<WebhookRecord[]> {
  const rows = await db.select().from(webhooks).where(eq(webhooks.userId, userId));
  return rows.map(toRecord);
}

export async function getWebhook(userId: string, id: string): Promise<WebhookRecord | null> {
  const rows = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)))
    .limit(1);
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function updateWebhook(
  userId: string,
  id: string,
  patch: Partial<WebhookInput>
): Promise<WebhookRecord | null> {
  const existing = await getWebhook(userId, id);
  if (!existing) return null;

  const url = patch.url !== undefined ? normalizeWebhookUrl(patch.url) : existing.url;
  const [row] = await db
    .update(webhooks)
    .set({
      url,
      secret: patch.secret !== undefined ? patch.secret?.trim() || null : existing.secret,
      events: patch.events ?? existing.events,
      active: patch.active ?? existing.active,
      updatedAt: new Date(),
    })
    .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)))
    .returning();
  return row ? toRecord(row) : null;
}

export async function deleteWebhook(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)))
    .returning({ id: webhooks.id });
  return rows.length > 0;
}

// Delivery.

export interface WebhookDeliverySummary {
  attempted: number;
  delivered: number;
  failed: number;
}

async function deliverOne(hook: WebhookRecord, event: string, payload: unknown): Promise<boolean> {
  const deliveryId = generateDeliveryId();
  const body = JSON.stringify({
    id: deliveryId,
    event,
    payload,
    deliveredAt: new Date().toISOString(),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "straxor-webhook/1.0",
    "X-Straxor-Event": event,
    "X-Straxor-Delivery": deliveryId,
  };
  if (hook.secret) {
    headers["X-Straxor-Signature"] = `sha256=${signWebhookPayload(hook.secret, body)}`;
  }

  let ok = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(hook.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    ok = res.ok;
  } catch {
    ok = false;
  }

  // Record the outcome best-effort; a failure to persist should not throw.
  try {
    await db
      .update(webhooks)
      .set({
        lastDeliveryAt: new Date(),
        lastDeliveryStatus: ok ? "delivered" : "failed",
        updatedAt: new Date(),
      })
      .where(and(eq(webhooks.id, hook.id), eq(webhooks.userId, hook.userId)));
  } catch {
    // ignore — persistence of delivery status is non-critical
  }

  return ok;
}

/** POST the event to every active, matching webhook for the user. Never throws. */
export async function dispatchWebhook(
  userId: string,
  event: string,
  payload: unknown
): Promise<WebhookDeliverySummary> {
  let hooks: WebhookRecord[] = [];
  try {
    hooks = await listWebhooks(userId);
  } catch {
    return { attempted: 0, delivered: 0, failed: 0 };
  }

  const matching = hooks.filter((h) => h.active && webhookMatchesEvent(h.events, event));
  let delivered = 0;
  let failed = 0;
  for (const hook of matching) {
    const ok = await deliverOne(hook, event, payload);
    if (ok) delivered += 1;
    else failed += 1;
  }
  return { attempted: matching.length, delivered, failed };
}

/** Deliver a test ping to a single hook (regardless of its event filter). */
export async function deliverTestEvent(
  userId: string,
  id: string,
  payload: unknown
): Promise<{ ok: boolean; hook: WebhookRecord }> {
  const hook = await getWebhook(userId, id);
  if (!hook) throw new Error("Webhook not found");
  const ok = await deliverOne(hook, "webhook.test", payload);
  return { ok, hook };
}
