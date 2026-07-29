import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import {
  featureFlags,
  tariffs,
  walletAccounts,
  walletTransactions,
  subscriptions,
  promoCodes,
  adminRegistry,
  userApiKeys,
  users,
  logs,
} from "../db/schema.js";
import { eq, and, or, like, desc, count, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

// ── All routes use requireAdmin ──

// ── 1. FEATURE FLAGS ──

const DEFAULT_FLAGS = [
  { key: "wallet", name: "Wallet", description: "Digitalni novčanik i kreditni sistem", category: "billing", isEnabled: true },
  { key: "escrow", name: "Escrow", description: "Escrow sistem za sigurne transakcije", category: "billing", isEnabled: false },
  { key: "marketplace", name: "Marketplace", description: "Community marketplace za template-e i plugine", category: "ecosystem", isEnabled: true },
  { key: "team-workspace", name: "Team Workspace", description: "Timski rad i kolaboracija", category: "collaboration", isEnabled: true },
  { key: "ai-review", name: "AI Review", description: "Automatski AI code review", category: "ai", isEnabled: true },
  { key: "voice", name: "Voice", description: "Glasovne komande i voice input", category: "ai", isEnabled: false },
  { key: "deploy", name: "Deploy", description: "Deployment sistema", category: "infra", isEnabled: true },
  { key: "analytics", name: "Analytics", description: "Analitika i metrika korišćenja", category: "monitoring", isEnabled: true },
  { key: "multi-agent", name: "Multi-Agent", description: "Više agenata u paraleli", category: "ai", isEnabled: true },
  { key: "git-remote", name: "Git Remote", description: "Remote git platforme (GitHub, GitLab...)", category: "vcs", isEnabled: true },
  { key: "mcp-marketplace", name: "MCP Marketplace", description: "MCP server marketplace", category: "ecosystem", isEnabled: true },
  { key: "infrastructure", name: "Infrastructure", description: "DNS, SSL, Proxy, Tunnel, Monitoring", category: "infra", isEnabled: true },
  { key: "plugins", name: "Plugins", description: "Plugin sistem i SDK", category: "ecosystem", isEnabled: true },
  { key: "enterprise", name: "Enterprise", description: "Enterprise security i compliance", category: "enterprise", isEnabled: true },
  { key: "resilience", name: "Resilience", description: "Disaster recovery i offline mode", category: "enterprise", isEnabled: true },
  { key: "sso", name: "SSO/SAML", description: "Single Sign-On integracije", category: "enterprise", isEnabled: false },
  { key: "audit-logs", name: "Audit Logs", description: "Imutable audit logging", category: "security", isEnabled: true },
  { key: "encryption", name: "Encryption", description: "Enkripcija podataka u mirovanju", category: "security", isEnabled: true },
  { key: "kanban", name: "Kanban Center", description: "Komandni centar sa kanban pregledom", category: "tools", isEnabled: true },
];

router.get("/feature-flags", requireAdmin, async (_req: Request, res: Response) => {
  try {
    let flags = await db.select().from(featureFlags).orderBy(featureFlags.key);
    if (flags.length === 0) {
      await db.insert(featureFlags).values(DEFAULT_FLAGS);
      flags = await db.select().from(featureFlags).orderBy(featureFlags.key);
    }
    res.json(flags);
  } catch (error) {
    console.error("Feature flags error:", error);
    res.status(500).json({ error: "Failed to list feature flags" });
  }
});

router.put("/feature-flags/:id", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isEnabled } = req.body;
  try {
    const [updated] = await db.update(featureFlags).set({ isEnabled, updatedAt: new Date() }).where(eq(featureFlags.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Flag not found" }); return; }
    res.json(updated);
  } catch (error) {
    console.error("Flag update error:", error);
    res.status(500).json({ error: "Failed to update flag" });
  }
});

// ── 2. TARIFFS ──

const DEFAULT_TARIFFS = [
  { name: "Free", price: 0, maxProjects: 1, maxAgents: 1, maxRuntimes: 1, sortOrder: 0 },
  { name: "Hobby", price: 999, maxProjects: 3, maxAgents: 2, maxRuntimes: 2, maxMembers: 1, storageLimit: 500, sortOrder: 1 },
  { name: "Pro", price: 2999, maxProjects: 10, maxAgents: 5, maxRuntimes: 3, maxMembers: 3, storageLimit: 2000, bandwidthLimit: 10000, sortOrder: 2 },
  { name: "Team", price: 9999, maxProjects: 50, maxAgents: 20, maxRuntimes: 10, maxMembers: 15, storageLimit: 10000, bandwidthLimit: 50000, sortOrder: 3 },
  { name: "Enterprise", price: 49999, maxProjects: 999, maxAgents: 100, maxRuntimes: 50, maxMembers: 999, storageLimit: 100000, bandwidthLimit: 500000, sortOrder: 4 },
  { name: "Lifetime", price: 99999, maxProjects: 999, maxAgents: 100, maxRuntimes: 50, maxMembers: 999, storageLimit: 100000, bandwidthLimit: 999999, sortOrder: 5 },
];

router.get("/tariffs", async (_req: Request, res: Response) => {
  try {
    let list = await db.select().from(tariffs).orderBy(tariffs.sortOrder);
    if (list.length === 0) {
      await db.insert(tariffs).values(DEFAULT_TARIFFS);
      list = await db.select().from(tariffs).orderBy(tariffs.sortOrder);
    }
    res.json(list);
  } catch (error) {
    console.error("Tariffs error:", error);
    res.status(500).json({ error: "Failed to list tariffs" });
  }
});

router.post("/tariffs", requireAdmin, async (req: Request, res: Response) => {
  const { name, price, currency, billingCycle, maxProjects, maxAgents, maxRuntimes, maxMembers, storageLimit, bandwidthLimit, aiLimits, allowedIntegrations, features, isActive, sortOrder } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  try {
    const [tariff] = await db.insert(tariffs).values({
      name, price, currency, billingCycle, maxProjects, maxAgents, maxRuntimes, maxMembers, storageLimit, bandwidthLimit,
      aiLimits: aiLimits ? JSON.stringify(aiLimits) : "{}",
      allowedIntegrations: allowedIntegrations ? JSON.stringify(allowedIntegrations) : "[]",
      features: features ? JSON.stringify(features) : "[]",
      isActive, sortOrder,
    }).returning();
    res.json(tariff);
  } catch (error: any) {
    if (error?.code === "23505") { res.status(409).json({ error: "Tariff with this name exists" }); return; }
    console.error("Tariff create error:", error);
    res.status(500).json({ error: "Failed to create tariff" });
  }
});

router.put("/tariffs/:id", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const fields = ["name","price","currency","billingCycle","maxProjects","maxAgents","maxRuntimes","maxMembers","storageLimit","bandwidthLimit","aiLimits","allowedIntegrations","features","isActive","sortOrder"];
  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (f === "aiLimits" || f === "allowedIntegrations" || f === "features") {
          updateData[f] = JSON.stringify(req.body[f]);
        } else {
          updateData[f] = req.body[f];
        }
      }
    }
    const [updated] = await db.update(tariffs).set(updateData).where(eq(tariffs.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Tariff not found" }); return; }
    res.json(updated);
  } catch (error) {
    console.error("Tariff update error:", error);
    res.status(500).json({ error: "Failed to update tariff" });
  }
});

router.delete("/tariffs/:id", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.delete(tariffs).where(eq(tariffs.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Tariff delete error:", error);
    res.status(500).json({ error: "Failed to delete tariff" });
  }
});

// ── 3. REGISTRY ──

const REGISTRY_PRESETS = [
  { type: "runtime", key: "opencode", name: "OpenCode", icon: "⚡", isBuiltin: true },
  { type: "runtime", key: "claude-code", name: "Free Claude Code", icon: "🤖", isBuiltin: true },
  { type: "runtime", key: "cline", name: "Cline", icon: "🧠", isBuiltin: true },
  { type: "runtime", key: "continue", name: "Continue", icon: "▶", isBuiltin: true },
  { type: "runtime", key: "codex", name: "Codex", icon: "📝", isBuiltin: true },
  { type: "runtime", key: "custom", name: "Custom Runtime", icon: "⚙", isBuiltin: true },
  { type: "ai-provider", key: "openai", name: "OpenAI", icon: "🤖", isBuiltin: true },
  { type: "ai-provider", key: "anthropic", name: "Anthropic", icon: "🔮", isBuiltin: true },
  { type: "ai-provider", key: "openrouter", name: "OpenRouter", icon: "🔀", isBuiltin: true },
  { type: "ai-provider", key: "google", name: "Google Gemini", icon: "🔍", isBuiltin: true },
  { type: "ai-provider", key: "ollama", name: "Ollama", icon: "🦙", isBuiltin: true },
  { type: "ai-provider", key: "deepseek", name: "DeepSeek", icon: "🧊", isBuiltin: true },
  { type: "integration", key: "github", name: "GitHub", icon: "🐙", isBuiltin: true },
  { type: "integration", key: "gitlab", name: "GitLab", icon: "🦊", isBuiltin: true },
  { type: "integration", key: "forgejo", name: "Forgejo", icon: "🔗", isBuiltin: true },
  { type: "integration", key: "telegram", name: "Telegram", icon: "✈", isBuiltin: true },
  { type: "integration", key: "discord", name: "Discord", icon: "💬", isBuiltin: true },
  { type: "integration", key: "slack", name: "Slack", icon: "🔔", isBuiltin: true },
  { type: "integration", key: "x", name: "X (Twitter)", icon: "🐦", isBuiltin: true },
  { type: "integration", key: "cloudflare", name: "Cloudflare", icon: "☁", isBuiltin: true },
  { type: "integration", key: "vercel", name: "Vercel", icon: "▲", isBuiltin: true },
  { type: "integration", key: "netlify", name: "Netlify", icon: "🌐", isBuiltin: true },
  { type: "integration", key: "render", name: "Render", icon: "🖥", isBuiltin: true },
  { type: "integration", key: "railway", name: "Railway", icon: "🚂", isBuiltin: true },
  { type: "integration", key: "coolify", name: "Coolify", icon: "❄", isBuiltin: true },
  { type: "integration", key: "youtube", name: "YouTube", icon: "📺", isBuiltin: true },
  { type: "integration", key: "reddit", name: "Reddit", icon: "🤝", isBuiltin: true },
  { type: "integration", key: "facebook", name: "Facebook", icon: "👍", isBuiltin: true },
  { type: "integration", key: "instagram", name: "Instagram", icon: "📸", isBuiltin: true },
  { type: "integration", key: "tiktok", name: "TikTok", icon: "🎵", isBuiltin: true },
  { type: "template", key: "react-vite", name: "React + Vite", icon: "⚛", isBuiltin: true },
  { type: "template", key: "nextjs", name: "Next.js", icon: "▲", isBuiltin: true },
  { type: "template", key: "vue", name: "Vue", icon: "💚", isBuiltin: true },
  { type: "template", key: "svelte", name: "Svelte", icon: "🧡", isBuiltin: true },
  { type: "template", key: "flutter", name: "Flutter", icon: "📱", isBuiltin: true },
  { type: "template", key: "node", name: "Node.js", icon: "💚", isBuiltin: true },
  { type: "template", key: "laravel", name: "Laravel", icon: "🎯", isBuiltin: true },
  { type: "template", key: "fastapi", name: "FastAPI", icon: "⚡", isBuiltin: true },
];

router.get("/registry", async (req: Request, res: Response) => {
  const { type } = req.query as Record<string, string>;
  try {
    const conditions = type ? [eq(adminRegistry.type, type)] : [];
    let entries = await db.select().from(adminRegistry).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(adminRegistry.sortOrder);

    if (entries.length === 0) {
      await db.insert(adminRegistry).values(REGISTRY_PRESETS);
      entries = await db.select().from(adminRegistry).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(adminRegistry.sortOrder);
    }
    res.json(entries);
  } catch (error) {
    console.error("Registry error:", error);
    res.status(500).json({ error: "Failed to list registry" });
  }
});

router.post("/registry", requireAdmin, async (req: Request, res: Response) => {
  const { type, key, name, description, icon, config, isEnabled, sortOrder } = req.body;
  if (!type || !key || !name) { res.status(400).json({ error: "type, key, name required" }); return; }
  try {
    const [entry] = await db.insert(adminRegistry).values({
      type, key, name, description, icon, config: config ? JSON.stringify(config) : "{}", isEnabled, sortOrder,
    }).returning();
    res.json(entry);
  } catch (error: any) {
    if (error?.code === "23505") { res.status(409).json({ error: "Registry entry exists" }); return; }
    console.error("Registry create error:", error);
    res.status(500).json({ error: "Failed to create registry entry" });
  }
});

router.put("/registry/:id", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, icon, config, isEnabled, sortOrder, type, key } = req.body;
  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const f of ["name","description","icon","type","key","isEnabled","sortOrder"]) {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    }
    if (config !== undefined) updateData.config = typeof config === "string" ? config : JSON.stringify(config);
    const [updated] = await db.update(adminRegistry).set(updateData).where(eq(adminRegistry.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Entry not found" }); return; }
    res.json(updated);
  } catch (error) {
    console.error("Registry update error:", error);
    res.status(500).json({ error: "Failed to update entry" });
  }
});

router.delete("/registry/:id", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.delete(adminRegistry).where(eq(adminRegistry.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Registry delete error:", error);
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

// ── 4. WALLET ──

router.get("/wallet", requireAdmin, async (req: Request, res: Response) => {
  const { userId } = req.query as Record<string, string>;
  try {
    const conditions = userId ? [eq(walletAccounts.userId, userId)] : [];
    const wallets = await db.select().from(walletAccounts).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(walletAccounts.createdAt));
    res.json(wallets);
  } catch (error) {
    console.error("Wallet error:", error);
    res.status(500).json({ error: "Failed to list wallets" });
  }
});

router.post("/wallet/credit", requireAdmin, async (req: Request, res: Response) => {
  const { userId, amount, description } = req.body;
  if (!userId || !amount) { res.status(400).json({ error: "userId and amount required" }); return; }
  try {
    let [wallet] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId));
    if (!wallet) {
      [wallet] = await db.insert(walletAccounts).values({ userId, balance: 0 }).returning();
    }
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;
    await db.update(walletAccounts).set({ balance: balanceAfter, updatedAt: new Date() }).where(eq(walletAccounts.id, wallet.id));
    const [tx] = await db.insert(walletTransactions).values({
      walletId: wallet.id, type: amount > 0 ? "credit" : "debit", amount: Math.abs(amount),
      balanceBefore, balanceAfter, description: description || "Admin adjustment",
    }).returning();
    res.json({ wallet: { ...wallet, balance: balanceAfter }, transaction: tx });
  } catch (error) {
    console.error("Wallet credit error:", error);
    res.status(500).json({ error: "Failed to credit wallet" });
  }
});

router.get("/wallet/transactions", requireAdmin, async (req: Request, res: Response) => {
  const { walletId } = req.query as Record<string, string>;
  try {
    const conditions = walletId ? [eq(walletTransactions.walletId, walletId)] : [];
    const txs = await db.select().from(walletTransactions).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(walletTransactions.createdAt));
    res.json(txs);
  } catch (error) {
    console.error("Wallet tx error:", error);
    res.status(500).json({ error: "Failed to list transactions" });
  }
});

// ── 5. SUBSCRIPTIONS ──

router.get("/subscriptions", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const subs = await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
    res.json(subs);
  } catch (error) {
    console.error("Subscriptions error:", error);
    res.status(500).json({ error: "Failed to list subscriptions" });
  }
});

router.put("/subscriptions/:id", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { tariffId, status, autoRenew, endDate } = req.body;
  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (tariffId !== undefined) updateData.tariffId = tariffId;
    if (status !== undefined) updateData.status = status;
    if (autoRenew !== undefined) updateData.autoRenew = autoRenew;
    if (endDate !== undefined) updateData.endDate = endDate;
    const [updated] = await db.update(subscriptions).set(updateData).where(eq(subscriptions.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Subscription not found" }); return; }
    res.json(updated);
  } catch (error) {
    console.error("Subscription update error:", error);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

// ── 6. PROMO CODES ──

router.get("/promo-codes", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const codes = await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
    res.json(codes);
  } catch (error) {
    console.error("Promo codes error:", error);
    res.status(500).json({ error: "Failed to list promo codes" });
  }
});

router.post("/promo-codes", requireAdmin, async (req: Request, res: Response) => {
  const { code, discountType, discountValue, maxUses, minAmount, appliesToTariffs, expiresAt } = req.body;
  if (!code || discountValue === undefined) { res.status(400).json({ error: "code and discountValue required" }); return; }
  try {
    const [promo] = await db.insert(promoCodes).values({
      code: code.toUpperCase(), discountType, discountValue, maxUses, minAmount,
      appliesToTariffs: appliesToTariffs ? JSON.stringify(appliesToTariffs) : "[]",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();
    res.json(promo);
  } catch (error: any) {
    if (error?.code === "23505") { res.status(409).json({ error: "Promo code exists" }); return; }
    console.error("Promo code error:", error);
    res.status(500).json({ error: "Failed to create promo code" });
  }
});

router.delete("/promo-codes/:id", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.delete(promoCodes).where(eq(promoCodes.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Promo code delete error:", error);
    res.status(500).json({ error: "Failed to delete promo code" });
  }
});

// ── 7. SYSTEM LOGS (aggregated from existing log sources) ──

router.get("/logs", requireAdmin, async (req: Request, res: Response) => {
  const { type, limit, offset } = req.query as Record<string, string>;
  try {
    const numLimit = Math.min(parseInt(limit || "50"), 200);
    const numOffset = parseInt(offset || "0");

    const conditions = type ? [eq(logs.category, type)] : [];

    const logEntries = await db.select()
      .from(logs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(logs.createdAt))
      .limit(numLimit)
      .offset(numOffset);

    const [{ total }] = await db.select({ total: count() })
      .from(logs)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ logs: logEntries, total, limit: numLimit, offset: numOffset });

    res.json({ logs, total, limit: numLimit, offset: numOffset });
  } catch (error) {
    console.error("Admin logs error:", error);
    res.status(500).json({ error: "Failed to list logs" });
  }
});

// ── 8. DASHBOARD STATS ──

router.get("/dashboard", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const totalUsers = (await db.select({ count: count() }).from(users))[0]?.count || 0;
    const totalKeys = (await db.select({ count: count() }).from(userApiKeys))[0]?.count || 0;
    const totalTariffs = (await db.select({ count: count() }).from(tariffs))[0]?.count || 0;
    const totalSubs = (await db.select({ count: count() }).from(subscriptions))[0]?.count || 0;
    const totalWallets = (await db.select({ count: count() }).from(walletAccounts))[0]?.count || 0;
    const activeFlags = (await db.select({ count: count() }).from(featureFlags).where(eq(featureFlags.isEnabled, true)))[0]?.count || 0;
    const totalFlags = (await db.select({ count: count() }).from(featureFlags))[0]?.count || 0;

    res.json({
      users: totalUsers,
      apiKeys: totalKeys,
      tariffs: totalTariffs,
      subscriptions: totalSubs,
      wallets: totalWallets,
      featureFlags: { active: activeFlags, total: totalFlags },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard stats" });
  }
});

// ── 9. USERS LIST ──

router.get("/users", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const userList = await db.select({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt));
    res.json(userList);
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ error: "Failed to list users" });
  }
});

router.put("/users/:id/role", requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!role || !["user", "admin", "super_admin"].includes(role)) {
    res.status(400).json({ error: "Invalid role. Must be user, admin, or super_admin" });
    return;
  }
  try {
    const [updated] = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, id)).returning({ id: users.id, email: users.email, role: users.role });
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }
    res.json(updated);
  } catch (error) {
    console.error("User role update error:", error);
    res.status(500).json({ error: "Failed to update user role" });
  }
});

export default router;
