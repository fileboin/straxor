import { Router } from "express";
import { db } from "../db/index.js";
import { notificationConfigs, notificationHistory } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";
import type { NotificationChannel, NotificationEventType, NotificationEvent } from "../adapters/notification/adapter.js";

const router = Router();

// GET /api/notifications/configs — get all notification configs for user
router.get("/configs", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const rows = await db
      .select()
      .from(notificationConfigs)
      .where(eq(notificationConfigs.userId, userId));

    // Parse JSON fields
    const configs = rows.map((r) => ({
      ...r,
      events: JSON.parse(r.events || "[]") as NotificationEventType[],
      config: JSON.parse(r.config || "{}") as Record<string, string>,
    }));

    res.json(configs);
  } catch (error) {
    console.error("Error fetching notification configs:", error);
    res.status(500).json({ error: "Failed to fetch configs" });
  }
});

// PUT /api/notifications/configs — upsert notification config
router.put("/configs", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { channel, enabled, events, config } = req.body;

    if (!channel) {
      return res.status(400).json({ error: "channel required" });
    }

    // Check if exists
    const existing = await db
      .select()
      .from(notificationConfigs)
      .where(
        and(
          eq(notificationConfigs.userId, userId),
          eq(notificationConfigs.channel, channel)
        )
      )
      .limit(1);

    const updateData = {
      enabled: enabled ?? false,
      events: JSON.stringify(events || []),
      config: JSON.stringify(config || {}),
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db
        .update(notificationConfigs)
        .set(updateData)
        .where(eq(notificationConfigs.id, existing[0].id));
    } else {
      await db.insert(notificationConfigs).values({
        userId,
        channel,
        ...updateData,
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error saving notification config:", error);
    res.status(500).json({ error: "Failed to save config" });
  }
});

// POST /api/notifications/test — test notification channel
router.post("/test", requireAuth, async (req: any, res) => {
  try {
    const { channel, config } = req.body;

    if (!channel) {
      return res.status(400).json({ error: "channel required" });
    }

    const registry = getAdapters().notification;

    const event: NotificationEvent = {
      type: "custom",
      title: "Test notifikacija",
      body: "Ovo je testna notifikacija iz Straxor-a. Ako vidite ovo, notifikacije rade!",
      severity: "info",
      timestamp: new Date().toISOString(),
    };

    const result = await registry.send(
      channel as NotificationChannel,
      event,
      config || {}
    );

    res.json(result);
  } catch (error) {
    console.error("Error sending test notification:", error);
    res.status(500).json({ error: "Test notification failed" });
  }
});

// POST /api/notifications/dispatch — dispatch event to all enabled channels
router.post("/dispatch", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { type, title, body, projectId, severity, metadata } = req.body;

    if (!type || !title || !body) {
      return res.status(400).json({ error: "type, title, body required" });
    }

    // Get user's notification configs
    const rows = await db
      .select()
      .from(notificationConfigs)
      .where(
        and(
          eq(notificationConfigs.userId, userId),
          eq(notificationConfigs.enabled, true)
        )
      );

    const configs = rows.map((r) => ({
      channel: r.channel as NotificationChannel,
      enabled: true,
      events: JSON.parse(r.events || "[]") as NotificationEventType[],
      config: JSON.parse(r.config || "{}") as Record<string, string>,
    }));

    const event: NotificationEvent = {
      type: type as NotificationEventType,
      title,
      body,
      projectId,
      severity: severity || "info",
      metadata,
      timestamp: new Date().toISOString(),
    };

    const registry = getAdapters().notification;
    const results = await registry.dispatch(event, configs);

    // Save to history
    for (const result of results) {
      await db.insert(notificationHistory).values({
        userId,
        channel: result.channel,
        eventType: type,
        title,
        body,
        severity: severity || "info",
        success: result.success,
        error: result.error,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
    }

    res.json({ results });
  } catch (error) {
    console.error("Error dispatching notification:", error);
    res.status(500).json({ error: "Dispatch failed" });
  }
});

// GET /api/notifications/history — get notification history
router.get("/history", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { limit: queryLimit } = req.query;
    const limit = Math.min(parseInt(queryLimit as string) || 50, 200);

    const rows = await db
      .select()
      .from(notificationHistory)
      .where(eq(notificationHistory.userId, userId))
      .orderBy(desc(notificationHistory.createdAt))
      .limit(limit);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching notification history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// DELETE /api/notifications/history — clear notification history
router.delete("/history", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    await db
      .delete(notificationHistory)
      .where(eq(notificationHistory.userId, userId));
    res.json({ success: true });
  } catch (error) {
    console.error("Error clearing notification history:", error);
    res.status(500).json({ error: "Failed to clear history" });
  }
});

export default router;
