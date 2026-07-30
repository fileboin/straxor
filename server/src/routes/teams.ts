import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { teams, teamMembers, users } from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/teams — list user's teams
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const owned = await db.select().from(teams).where(eq(teams.ownerId, userId));

    const memberRows = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    const memberTeamIds = memberRows.map((r) => r.teamId);
    const memberTeams = memberTeamIds.length > 0
      ? await db.select().from(teams).where(inArray(teams.id, memberTeamIds))
      : [];

    const all = [...owned, ...memberTeams.filter((t) => !owned.some((o) => o.id === t.id))];
    res.json(all);
  } catch (error) {
    console.error("Team list error:", error);
    res.status(500).json({ error: "Failed to list teams" });
  }
});

// POST /api/teams — create team
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { name } = req.body as { name: string };

  if (!name?.trim()) {
    res.status(400).json({ error: "Team name required" });
    return;
  }

  try {
    const [team] = await db
      .insert(teams)
      .values({ name: name.trim(), ownerId: userId })
      .returning();

    // Add owner as member with admin role
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId,
      role: "admin",
      invitedBy: userId,
    });

    res.json(team);
  } catch (error) {
    console.error("Team create error:", error);
    res.status(500).json({ error: "Failed to create team" });
  }
});

// GET /api/teams/:id — team details with members
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;

  try {
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }

    const members = await db
      .select({
        id: teamMembers.id,
        userId: teamMembers.userId,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
        email: users.email,
      })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, id));

    const isOwner = team.ownerId === userId;
    const isMember = members.some((m) => m.userId === userId);

    if (!isOwner && !isMember) {
      res.status(403).json({ error: "Not a team member" });
      return;
    }

    res.json({ ...team, members, isOwner });
  } catch (error) {
    console.error("Team detail error:", error);
    res.status(500).json({ error: "Failed to get team" });
  }
});

// PUT /api/teams/:id — update team
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const { name } = req.body as { name?: string };

  try {
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }
    if (team.ownerId !== userId) { res.status(403).json({ error: "Only owner can edit" }); return; }

    const [updated] = await db
      .update(teams)
      .set({ name: name?.trim() || team.name, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update team" });
  }
});

// DELETE /api/teams/:id
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;

  try {
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }
    if (team.ownerId !== userId) { res.status(403).json({ error: "Only owner can delete" }); return; }

    await db.delete(teams).where(eq(teams.id, id));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete team" });
  }
});

// POST /api/teams/:id/members — add member
router.post("/:id/members", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const { email, role } = req.body as { email: string; role?: string };

  try {
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }
    if (team.ownerId !== userId) { res.status(403).json({ error: "Only owner can add members" }); return; }

    const [invitedUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!invitedUser) {
      res.status(404).json({ error: "User not found with that email" });
      return;
    }

    // Check if already member
    const existing = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, id), eq(teamMembers.userId, invitedUser.id)))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "User is already a team member" });
      return;
    }

    const [member] = await db
      .insert(teamMembers)
      .values({ teamId: id, userId: invitedUser.id, role: role || "member", invitedBy: userId })
      .returning();

    res.json(member);
  } catch (error) {
    console.error("Add member error:", error);
    res.status(500).json({ error: "Failed to add member" });
  }
});

// DELETE /api/teams/:id/members/:memberId — remove member
router.delete("/:id/members/:memberId", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const memberId = req.params.memberId as string;

  try {
    const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }
    if (team.ownerId !== userId) { res.status(403).json({ error: "Only owner can remove members" }); return; }

    await db.delete(teamMembers).where(eq(teamMembers.id, memberId));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove member" });
  }
});

export default router;
