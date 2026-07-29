import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import {
  supportTickets, supportMessages, feedback, featureRequests, featureVotes, users,
} from "../db/schema.js";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── Tickets (user) ──

router.get("/tickets", requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await db.select().from(supportTickets).where(eq(supportTickets.userId, req.user!.userId)).orderBy(desc(supportTickets.createdAt));
    res.json(list);
  } catch (error) {
    console.error("Tickets error:", error);
    res.status(500).json({ error: "Failed to list tickets" });
  }
});

router.post("/tickets", requireAuth, async (req: Request, res: Response) => {
  const { subject, description, category, priority, logData } = req.body;
  if (!subject || !description) { res.status(400).json({ error: "subject and description required" }); return; }
  try {
    const [ticket] = await db.insert(supportTickets).values({ userId: req.user!.userId, subject, description, category, priority, logData }).returning();
    res.json(ticket);
  } catch (error) {
    console.error("Ticket create error:", error);
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

router.get("/tickets/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const [ticket] = await db.select().from(supportTickets).where(and(eq(supportTickets.id, req.params.id), eq(supportTickets.userId, req.user!.userId)));
    if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
    const messages = await db.select().from(supportMessages).where(eq(supportMessages.ticketId, ticket.id)).orderBy(supportMessages.createdAt);
    const [userData] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, ticket.userId));
    res.json({ ...ticket, messages, user: userData });
  } catch (error) {
    console.error("Ticket get error:", error);
    res.status(500).json({ error: "Failed to get ticket" });
  }
});

router.post("/tickets/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const { message } = req.body;
  if (!message) { res.status(400).json({ error: "message required" }); return; }
  try {
    const [ticket] = await db.select().from(supportTickets).where(and(eq(supportTickets.id, req.params.id), eq(supportTickets.userId, req.user!.userId)));
    if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
    const [msg] = await db.insert(supportMessages).values({ ticketId: ticket.id, userId: req.user!.userId, message }).returning();
    await db.update(supportTickets).set({ updatedAt: new Date() }).where(eq(supportTickets.id, ticket.id));
    res.json(msg);
  } catch (error) {
    console.error("Message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ── Feedback ──

router.post("/feedback", requireAuth, async (req: Request, res: Response) => {
  const { type, subject, description, screenshot, logData } = req.body;
  if (!type || !subject) { res.status(400).json({ error: "type and subject required" }); return; }
  try {
    const [entry] = await db.insert(feedback).values({ userId: req.user!.userId, type, subject, description, screenshot, logData }).returning();
    res.json(entry);
  } catch (error) {
    console.error("Feedback error:", error);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

// ── Feature Requests ──

router.get("/feature-requests", async (_req: Request, res: Response) => {
  try {
    const list = await db.select().from(featureRequests).orderBy(desc(featureRequests.voteCount));
    res.json(list);
  } catch (error) {
    console.error("Feature requests error:", error);
    res.status(500).json({ error: "Failed to list feature requests" });
  }
});

router.post("/feature-requests", requireAuth, async (req: Request, res: Response) => {
  const { title, description, category } = req.body;
  if (!title) { res.status(400).json({ error: "title required" }); return; }
  try {
    const [fr] = await db.insert(featureRequests).values({ userId: req.user!.userId, title, description, category }).returning();
    res.json(fr);
  } catch (error) {
    console.error("Feature request error:", error);
    res.status(500).json({ error: "Failed to create feature request" });
  }
});

router.post("/feature-requests/:id/vote", requireAuth, async (req: Request, res: Response) => {
  try {
    const existing = await db.select().from(featureVotes).where(and(eq(featureVotes.featureRequestId, req.params.id), eq(featureVotes.userId, req.user!.userId)));
    if (existing.length > 0) {
      await db.delete(featureVotes).where(eq(featureVotes.id, existing[0].id));
      await db.update(featureRequests).set({ voteCount: sql`vote_count - 1` }).where(eq(featureRequests.id, req.params.id));
      res.json({ voted: false });
    } else {
      await db.insert(featureVotes).values({ featureRequestId: req.params.id, userId: req.user!.userId });
      await db.update(featureRequests).set({ voteCount: sql`vote_count + 1` }).where(eq(featureRequests.id, req.params.id));
      res.json({ voted: true });
    }
  } catch (error) {
    console.error("Vote error:", error);
    res.status(500).json({ error: "Failed to vote" });
  }
});

export default router;
