import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { userApiKeys } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../lib/crypto.js";

const router = Router();

// GET /api/api-keys — listaj sve API key-ove korisnika (maskirani)
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const result = await db
      .select()
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, userId));

    // Mask keys for display
    const masked = result.map((row) => {
      let decrypted: string;
      try {
        decrypted = decrypt(row.encryptedKey);
      } catch {
        // Undecryptable row → skip it rather than failing the whole list.
        return null;
      }
      const maskedKey = decrypted.slice(0, 8) + "••••••••" + decrypted.slice(-4);
      return {
        id: row.id,
        providerId: row.providerId,
        maskedKey,
        createdAt: row.createdAt,
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    res.json(masked);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/api-keys/:providerId — dohvati key za specifični provider (dekriptovan)
router.get("/:providerId", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const providerId = req.params.providerId as string;

    const result = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.providerId, providerId)))
      .limit(1);

    if (result.length === 0) {
      res.status(404).json({ error: "API key not found" });
      return;
    }

    let decrypted: string;
    try {
      decrypted = decrypt(result[0].encryptedKey);
    } catch {
      // A stored key that can't be decrypted (e.g. encrypted under a
      // different ENCRYPTION_KEY) is not usable — treat it as "not
      // configured" so the client asks the user to re-enter it instead of
      // surfacing an opaque server error.
      res.status(404).json({ error: "API key not found" });
      return;
    }
    res.json({ key: decrypted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/api-keys — spremi ili ažuriraj API key
router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { providerId, key } = req.body;

    if (!providerId || !key) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const encryptedKey = encrypt(key);

    // Check if key already exists for this provider
    const existing = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.providerId, providerId)))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      const result = await db
        .update(userApiKeys)
        .set({ encryptedKey, updatedAt: new Date() })
        .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.providerId, providerId)))
        .returning();

      res.json({ id: result[0].id, providerId, success: true });
    } else {
      // Insert new
      const result = await db
        .insert(userApiKeys)
        .values({ userId, providerId, encryptedKey })
        .returning();

      res.json({ id: result[0].id, providerId, success: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// DELETE /api/api-keys/:providerId — obriši API key
router.delete("/:providerId", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const providerId = req.params.providerId as string;

    const result = await db
      .delete(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.providerId, providerId)))
      .returning();

    if (result.length === 0) {
      res.status(404).json({ error: "API key not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
