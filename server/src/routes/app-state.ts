import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { userAppState } from "../db/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const result = await db
      .select({ state: userAppState.state })
      .from(userAppState)
      .where(eq(userAppState.userId, userId))
      .limit(1);

    res.json({ state: result[0]?.state ?? {} });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.put("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const state = req.body?.state;

    if (typeof state !== "object" || state === null || Array.isArray(state)) {
      res.status(400).json({ error: "state must be a JSON object" });
      return;
    }

    const existing = await db
      .select({ id: userAppState.id })
      .from(userAppState)
      .where(eq(userAppState.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(userAppState).values({ userId, state });
    } else {
      await db
        .update(userAppState)
        .set({ state, updatedAt: new Date() })
        .where(eq(userAppState.userId, userId));
    }

    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
