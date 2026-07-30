import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import {
  organizations,
  organizationMembers,
  organizationApiKeys,
  organizationPolicies,
  budgetLimits,
  users,
} from "../db/schema.js";
import { eq, and, inArray, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── Organizations ──

// GET /api/organizations — list user's orgs
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const owned = await db.select().from(organizations).where(eq(organizations.ownerId, userId));

    const memberRows = await db
      .select({ orgId: organizationMembers.orgId, role: organizationMembers.role })
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId));

    const memberOrgIds = memberRows.map((r) => r.orgId);
    const memberRoleMap = new Map(memberRows.map((r) => [r.orgId, r.role]));
    const memberOrgs = memberOrgIds.length > 0
      ? await db.select().from(organizations).where(inArray(organizations.id, memberOrgIds))
      : [];

    const all = [...owned, ...memberOrgs.filter((o) => !owned.some((ow) => ow.id === o.id))];
    const result = all.map((org) => ({
      ...org,
      role: org.ownerId === userId ? "owner" : memberRoleMap.get(org.id) || "member",
    }));

    res.json(result);
  } catch (error) {
    console.error("Org list error:", error);
    res.status(500).json({ error: "Failed to list organizations" });
  }
});

// POST /api/organizations — create org
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { name, billingEmail, plan } = req.body as { name: string; billingEmail?: string; plan?: string };

  if (!name?.trim()) {
    res.status(400).json({ error: "Organization name required" });
    return;
  }

  try {
    const [org] = await db
      .insert(organizations)
      .values({ name: name.trim(), ownerId: userId, billingEmail: billingEmail || null, plan: plan || "free" })
      .returning();

    await db.insert(organizationMembers).values({ orgId: org.id, userId, role: "admin" });

    res.json(org);
  } catch (error) {
    console.error("Org create error:", error);
    res.status(500).json({ error: "Failed to create organization" });
  }
});

// GET /api/organizations/:id — org details with members
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;

  try {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!org) { res.status(404).json({ error: "Organization not found" }); return; }

    const members = await db
      .select({ id: organizationMembers.id, userId: organizationMembers.userId, role: organizationMembers.role, joinedAt: organizationMembers.joinedAt, email: users.email })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.orgId, id));

    const userRole = org.ownerId === userId ? "owner" : members.find((m) => m.userId === userId)?.role || null;
    if (!userRole) { res.status(403).json({ error: "Not a member" }); return; }

    const [apiKeys, policies, budgets] = await Promise.all([
      db.select().from(organizationApiKeys).where(eq(organizationApiKeys.orgId, id)).orderBy(desc(organizationApiKeys.createdAt)),
      db.select().from(organizationPolicies).where(eq(organizationPolicies.orgId, id)).orderBy(desc(organizationPolicies.createdAt)),
      db.select().from(budgetLimits).where(eq(budgetLimits.orgId, id)).orderBy(desc(budgetLimits.createdAt)),
    ]);

    res.json({ ...org, members, apiKeys, policies, budgets, userRole });
  } catch (error) {
    console.error("Org detail error:", error);
    res.status(500).json({ error: "Failed to get organization" });
  }
});

// PUT /api/organizations/:id
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const { name, billingEmail, plan } = req.body as Record<string, any>;

  try {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!org) { res.status(404).json({ error: "Not found" }); return; }
    if (org.ownerId !== userId) { res.status(403).json({ error: "Only owner can edit" }); return; }

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (billingEmail !== undefined) updates.billingEmail = billingEmail;
    if (plan !== undefined) updates.plan = plan;

    const [updated] = await db.update(organizations).set(updates).where(eq(organizations.id, id)).returning();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update" });
  }
});

// DELETE /api/organizations/:id
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;

  try {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!org) { res.status(404).json({ error: "Not found" }); return; }
    if (org.ownerId !== userId) { res.status(403).json({ error: "Only owner can delete" }); return; }

    await db.delete(organizations).where(eq(organizations.id, id));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

// ── Members ──

router.post("/:id/members", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const { email, role } = req.body as { email: string; role?: string };

  try {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!org) { res.status(404).json({ error: "Not found" }); return; }
    if (org.ownerId !== userId) { res.status(403).json({ error: "Only owner can add" }); return; }

    const [invited] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!invited) { res.status(404).json({ error: "User not found" }); return; }

    const existing = await db.select().from(organizationMembers).where(and(eq(organizationMembers.orgId, id), eq(organizationMembers.userId, invited.id))).limit(1);
    if (existing.length > 0) { res.status(409).json({ error: "Already a member" }); return; }

    const [member] = await db.insert(organizationMembers).values({ orgId: id, userId: invited.id, role: role || "member" }).returning();
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: "Failed to add member" });
  }
});

router.delete("/:id/members/:memberId", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string; const memberId = req.params.memberId as string;

  try {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!org) { res.status(404).json({ error: "Not found" }); return; }
    if (org.ownerId !== userId) { res.status(403).json({ error: "Only owner" }); return; }

    await db.delete(organizationMembers).where(eq(organizationMembers.id, memberId));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// ── API Keys ──

router.get("/:id/api-keys", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const keys = await db.select().from(organizationApiKeys).where(eq(organizationApiKeys.orgId, id)).orderBy(desc(organizationApiKeys.createdAt));
  res.json(keys);
});

router.post("/:id/api-keys", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = req.params.id as string;
  const { provider, label, key } = req.body as { provider: string; label?: string; key: string };

  if (!provider || !key) { res.status(400).json({ error: "provider and key required" }); return; }

  try {
    const [created] = await db
      .insert(organizationApiKeys)
      .values({ orgId: id, provider, label: label || null, encryptedKey: key, createdBy: userId })
      .returning();

    res.json(created);
  } catch (error) {
    res.status(500).json({ error: "Failed to save key" });
  }
});

router.delete("/:id/api-keys/:keyId", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string; const keyId = req.params.keyId as string;
  await db.delete(organizationApiKeys).where(and(eq(organizationApiKeys.id, keyId), eq(organizationApiKeys.orgId, id)));
  res.json({ ok: true });
});

// ── Policies ──

router.get("/:id/policies", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const policies = await db.select().from(organizationPolicies).where(eq(organizationPolicies.orgId, id)).orderBy(desc(organizationPolicies.createdAt));
  res.json(policies);
});

router.post("/:id/policies", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { type, name, description, config, isEnabled } = req.body as Record<string, any>;

  if (!type || !name) { res.status(400).json({ error: "type and name required" }); return; }

  try {
    const [policy] = await db
      .insert(organizationPolicies)
      .values({ orgId: id, type, name, description: description || null, config: config ? JSON.stringify(config) : "{}", isEnabled: isEnabled !== undefined ? isEnabled : true })
      .returning();

    res.json({ ...policy, config: tryParseJson(policy.config) });
  } catch (error) {
    res.status(500).json({ error: "Failed to create policy" });
  }
});

router.put("/:id/policies/:policyId", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string; const policyId = req.params.policyId as string;
  const { name, description, config, isEnabled } = req.body as Record<string, any>;

  try {
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (config !== undefined) updates.config = JSON.stringify(config);
    if (isEnabled !== undefined) updates.isEnabled = isEnabled;

    const [updated] = await db.update(organizationPolicies).set(updates).where(and(eq(organizationPolicies.id, policyId), eq(organizationPolicies.orgId, id))).returning();
    if (!updated) { res.status(404).json({ error: "Policy not found" }); return; }
    res.json({ ...updated, config: tryParseJson(updated.config) });
  } catch (error) {
    res.status(500).json({ error: "Failed to update policy" });
  }
});

router.delete("/:id/policies/:policyId", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string; const policyId = req.params.policyId as string;
  await db.delete(organizationPolicies).where(and(eq(organizationPolicies.id, policyId), eq(organizationPolicies.orgId, id)));
  res.json({ ok: true });
});

// ── Budget ──

router.get("/:id/budgets", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const budgets = await db.select().from(budgetLimits).where(eq(budgetLimits.orgId, id)).orderBy(desc(budgetLimits.createdAt));
  res.json(budgets);
});

router.post("/:id/budgets", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { projectId, monthlyLimit, currency, alertAtPercent } = req.body as Record<string, any>;

  try {
    const [budget] = await db
      .insert(budgetLimits)
      .values({ orgId: id, projectId: projectId || null, monthlyLimit: monthlyLimit || 0, currency: currency || "USD", alertAtPercent: alertAtPercent ?? 80 })
      .returning();

    res.json(budget);
  } catch (error) {
    res.status(500).json({ error: "Failed to create budget" });
  }
});

router.put("/:id/budgets/:budgetId", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string; const budgetId = req.params.budgetId as string;
  const { monthlyLimit, currency, alertAtPercent, currentUsage } = req.body as Record<string, any>;

  try {
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (monthlyLimit !== undefined) updates.monthlyLimit = monthlyLimit;
    if (currency !== undefined) updates.currency = currency;
    if (alertAtPercent !== undefined) updates.alertAtPercent = alertAtPercent;
    if (currentUsage !== undefined) updates.currentUsage = currentUsage;

    const [updated] = await db.update(budgetLimits).set(updates).where(and(eq(budgetLimits.id, budgetId), eq(budgetLimits.orgId, id))).returning();
    if (!updated) { res.status(404).json({ error: "Budget not found" }); return; }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update budget" });
  }
});

router.delete("/:id/budgets/:budgetId", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string; const budgetId = req.params.budgetId as string;
  await db.delete(budgetLimits).where(and(eq(budgetLimits.id, budgetId), eq(budgetLimits.orgId, id)));
  res.json({ ok: true });
});

// ── Usage / Stats ──

router.get("/:id/usage", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as string;

  try {
    const budgets = await db.select().from(budgetLimits).where(eq(budgetLimits.orgId, id));
    const totalBudget = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
    const totalUsage = budgets.reduce((s, b) => s + b.currentUsage, 0);

    const apiKeys = await db.select().from(organizationApiKeys).where(eq(organizationApiKeys.orgId, id));
    const providers = [...new Set(apiKeys.map((k) => k.provider))];

    res.json({
      totalMonthlyBudget: totalBudget,
      totalCurrentUsage: totalUsage,
      usagePercent: totalBudget > 0 ? Math.round((totalUsage / totalBudget) * 100) : 0,
      providerCount: providers.length,
      apiKeyCount: apiKeys.length,
      budgetCount: budgets.length,
      providers,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get usage" });
  }
});

function tryParseJson(val: string | null | undefined): any {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

export default router;
