import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { agentBusEvents, handshakeSelfTests } from "../db/schema.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/history/:sessionId", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const sessionId = String(req.params.sessionId);
    const rows = await db
      .select()
      .from(handshakeSelfTests)
      .where(and(eq(handshakeSelfTests.userId, userId), eq(handshakeSelfTests.sessionId, sessionId)))
      .orderBy(desc(handshakeSelfTests.createdAt));
    res.json(rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.post("/run", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const {
      sessionId,
      projectId,
      askRepo,
      agentRepo,
      askMachineId,
      agentMachineId,
      busEventId,
      chainId,
      result,
    } = req.body as {
      sessionId?: string;
      projectId?: string | null;
      askRepo?: string | null;
      agentRepo?: string | null;
      askMachineId?: string | null;
      agentMachineId?: string | null;
      busEventId?: string | null;
      chainId?: string | null;
      result?: Record<string, unknown>;
    };

    if (!sessionId) {
      res.status(400).json({ error: "sessionId required" });
      return;
    }

    const resolvedChainId = chainId || `handshake-${Date.now()}`;
    const [row] = await db
      .insert(handshakeSelfTests)
      .values({
        sessionId,
        userId,
        projectId: projectId || null,
        chainId: resolvedChainId,
        status: typeof result?.ok === "boolean" ? (result.ok ? "passed" : "failed") : "pending",
        askRepo: askRepo || null,
        agentRepo: agentRepo || null,
        askMachineId: askMachineId || null,
        agentMachineId: agentMachineId || null,
        busEventId: busEventId || null,
        result: result || {},
        updatedAt: new Date(),
      })
      .returning();

    const event = busEventId
      ? await db
          .select()
          .from(agentBusEvents)
          .where(and(eq(agentBusEvents.userId, userId), eq(agentBusEvents.id, busEventId)))
          .limit(1)
      : [];

    res.json({ test: row, busEvent: event[0] || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = String(req.params.id);
    const { result, status, busEventId } = req.body as {
      result?: Record<string, unknown>;
      status?: string;
      busEventId?: string | null;
    };

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (result !== undefined) patch.result = result;
    if (status !== undefined) patch.status = status;
    if (busEventId !== undefined) patch.busEventId = busEventId;

    const [row] = await db
      .update(handshakeSelfTests)
      .set(patch)
      .where(and(eq(handshakeSelfTests.userId, userId), eq(handshakeSelfTests.id, id)))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Handshake self-test not found" });
      return;
    }

    res.json(row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
