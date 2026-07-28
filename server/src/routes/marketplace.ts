import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import {
  marketplaceItems,
  marketplaceReviews,
  marketplaceInstallations,
} from "../db/schema.js";
import { eq, and, or, like, desc, sql, count, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// ── Seed presets ──

const PRESET_TEMPLATES = [
  {
    name: "React + Vite Starter",
    type: "template",
    version: "2.0.0",
    description: "Brzi start sa React 19, Vite 6, TypeScript, Tailwind v4 i React Router v7",
    longDescription: "Kompletan setup za modernu React aplikaciju. Uključuje ESLint, Prettier, vitest, i optimizovanu Vite konfiguraciju za produkciju.",
    icon: "⚛️",
    authorName: "Straxor",
    tags: JSON.stringify(["react", "vite", "typescript", "tailwind", "spa"]),
    category: "web",
    isPublic: true,
    isBuiltin: true,
    content: JSON.stringify({ type: "npm-create", template: "react-vite" }),
    installCount: 1284,
    rating: 48,
    reviewCount: 42,
  },
  {
    name: "Next.js Fullstack",
    type: "template",
    version: "1.2.0",
    description: "Next.js 15 App Router, Prisma ORM, Postgres, Auth.js, tRPC",
    longDescription: "Full-stack Next.js template sa server actions, middleware autentifikacijom, Prisma ORM + Postgres šemom, tRPC rutama i Tailwind stylingom.",
    icon: "▲",
    authorName: "Straxor",
    tags: JSON.stringify(["nextjs", "react", "prisma", "postgres", "trpc", "auth"]),
    category: "web",
    isPublic: true,
    isBuiltin: true,
    content: JSON.stringify({ type: "npm-create", template: "nextjs-fullstack" }),
    installCount: 956,
    rating: 45,
    reviewCount: 38,
  },
  {
    name: "Express REST API",
    type: "template",
    version: "1.5.0",
    description: "Express + Drizzle ORM + Postgres + JWT auth + Zod validacija",
    longDescription: "Robusan REST API backend sa Drizzle ORM migracijama, JWT autentifikacijom, Zod šemama za validaciju, i Swagger dokumentacijom.",
    icon: "🚀",
    authorName: "Straxor",
    tags: JSON.stringify(["express", "api", "drizzle", "postgres", "jwt", "zod"]),
    category: "backend",
    isPublic: true,
    isBuiltin: true,
    content: JSON.stringify({ type: "github", repo: "straxor/express-api-template" }),
    installCount: 723,
    rating: 44,
    reviewCount: 31,
  },
  {
    name: "AI Agent Starter",
    type: "agent",
    version: "1.0.0",
    description: "Custom agent s ulogom 'Senior Engineer' — full toolset, code review, deploy",
    longDescription: "Napredni agent sa potpunim setom alata — code review, git operacije, deploy na VPS, security scanning, i automatsko testiranje. Podesiv sistem prompt i dozvole.",
    icon: "🤖",
    authorName: "Straxor",
    tags: JSON.stringify(["agent", "code-review", "deploy", "senior", "fullstack"]),
    category: "agent",
    isPublic: true,
    isBuiltin: true,
    content: JSON.stringify({ role: "senior-engineer", tools: ["code-review", "git", "deploy", "security-scan", "test"], model: "claude-sonnet-4" }),
    installCount: 534,
    rating: 49,
    reviewCount: 27,
  },
  {
    name: "Code Review Expert",
    type: "agent",
    version: "1.1.0",
    description: "Agent specijalizovan za code review — lint, typecheck, security, best practices",
    longDescription: "Agent fokusiran isključivo na code review. Koristi ESLint, TypeScript compiler, i security scanere. Automatski komentariše PR-ove i predlaže fixove.",
    icon: "🔍",
    authorName: "Straxor",
    tags: JSON.stringify(["agent", "code-review", "lint", "security", "pr"]),
    category: "agent",
    isPublic: true,
    isBuiltin: true,
    content: JSON.stringify({ role: "code-reviewer", tools: ["lint", "typecheck", "security-scan", "git"], model: "claude-sonnet-4" }),
    installCount: 389,
    rating: 46,
    reviewCount: 22,
  },
  {
    name: "Senior Developer System Prompt",
    type: "prompt",
    version: "2.0.0",
    description: "Detaljan system prompt za agenta kao senior developera — kod, arhitektura, review",
    longDescription: "Sveobuhvatan system prompt koji transformiše agenta u senior developera sa 15+ godina iskustva. Uključuje uputstva za pisanje koda, arhitekturu, code review, i najbolje prakse.",
    icon: "📝",
    authorName: "Straxor",
    tags: JSON.stringify(["prompt", "system", "senior", "developer", "coding"]),
    category: "prompt",
    isPublic: true,
    isBuiltin: true,
    content: JSON.stringify({ prompt: "You are a senior software engineer with 15+ years of experience..." }),
    installCount: 2104,
    rating: 50,
    reviewCount: 67,
  },
  {
    name: "Architect Agent Prompt",
    type: "prompt",
    version: "1.0.0",
    description: "System prompt za arhitekturu sistema — dizajn, skaliranje, tehnologije",
    longDescription: "Prompt koji agenta pretvara u solution architect-a. Fokus na dizajn sistema, izbor tehnologija, skaliranje, trade-off analize, i dokumentaciju arhitekture.",
    icon: "🏗️",
    authorName: "Straxor",
    tags: JSON.stringify(["prompt", "architecture", "system-design", "scaling"]),
    category: "prompt",
    isPublic: true,
    isBuiltin: true,
    content: JSON.stringify({ prompt: "You are a systems architect..." }),
    installCount: 876,
    rating: 47,
    reviewCount: 42,
  },
  {
    name: "Firecrawl MCP Server",
    type: "mcp",
    version: "1.0.0",
    description: "Firecrawl MCP server za web scraping i pretragu — sa template konfiguracijom",
    longDescription: "MCP server integracija sa Firecrawl-om. Omogućava agentu da pretražuje web, scrapuje stranice, i ekstrahuje podatke. Uključuje primer konfiguracije i .env template.",
    icon: "🔥",
    authorName: "Straxor",
    tags: JSON.stringify(["mcp", "firecrawl", "web", "scraping", "search"]),
    category: "mcp",
    isPublic: true,
    isBuiltin: true,
    content: JSON.stringify({ mcpConfig: { server: "firecrawl-mcp", command: "npx", args: ["@anthropic/firecrawl-mcp"] } }),
    installCount: 1567,
    rating: 48,
    reviewCount: 53,
  },
  {
    name: "GitHub MCP Server",
    type: "mcp",
    version: "1.0.0",
    description: "GitHub MCP server — PR review, issues, commits, repo management",
    longDescription: "Potpuni GitHub MCP server za upravljanje repozitorijumima — pull request review, issue management, commit history, branch management, i GitHub Actions monitoring.",
    icon: "🐙",
    authorName: "Straxor",
    tags: JSON.stringify(["mcp", "github", "git", "pr", "issues"]),
    category: "mcp",
    isPublic: true,
    isBuiltin: true,
    content: JSON.stringify({ mcpConfig: { server: "github-mcp", command: "npx", args: ["@anthropic/github-mcp"] } }),
    installCount: 1234,
    rating: 46,
    reviewCount: 44,
  },
  {
    name: "CI/CD Pipeline",
    type: "workflow",
    version: "1.0.0",
    description: "GitHub Actions CI/CD — test, lint, build, deploy na VPS",
    longDescription: "Kompletan CI/CD pipeline sa GitHub Actions. Uključuje automatsko testiranje, linting, build, security scan, i deploy na VPS preko SSH. Podržava i Docker deploy.",
    icon: "🔄",
    authorName: "Straxor",
    tags: JSON.stringify(["workflow", "cicd", "github-actions", "deploy", "docker"]),
    category: "cicd",
    isPublic: true,
    isBuiltin: true,
    content: JSON.stringify({ workflow: { name: "CI/CD Pipeline", on: ["push", "pull_request"], jobs: ["test", "lint", "build", "deploy"] } }),
    installCount: 678,
    rating: 45,
    reviewCount: 34,
  },
  {
    name: "Docker Compose Stack",
    type: "workflow",
    version: "1.2.0",
    description: "Docker Compose za dev okruženje — Postgres, Redis, Nginx, app",
    longDescription: "Docker Compose konfiguracija za development okruženje sa Postgres bazom, Redis kešom, Nginx reverse proxy-jem, i samom aplikacijom. Uključuje Dockerfile-ove i health check-ove.",
    icon: "🐳",
    authorName: "Straxor",
    tags: JSON.stringify(["workflow", "docker", "compose", "dev", "postgres", "redis"]),
    category: "infra",
    isPublic: true,
    isBuiltin: true,
    content: JSON.stringify({ dockerCompose: { version: "3.9", services: ["postgres", "redis", "nginx", "app"] } }),
    installCount: 543,
    rating: 44,
    reviewCount: 29,
  },
  {
    name: "MCP Server Collection",
    type: "mcp",
    version: "1.0.0",
    description: "Paket MCP servera — Database, Docs, Filesystem, Slack, Playwright, Memory",
    longDescription: "Kolekcija najkorisnijih MCP servera za svakodnevni rad — baza podataka, dokumentacija, fajl sistem, Slack integracija, browser automatizacija, i memorija.",
    icon: "📦",
    authorName: "Straxor",
    tags: JSON.stringify(["mcp", "collection", "database", "docs", "slack", "playwright"]),
    category: "mcp",
    isPublic: true,
    isBuiltin: true,
    content: JSON.stringify({ mcpServers: ["database-mcp", "docs-mcp", "filesystem-mcp", "slack-mcp", "playwright-mcp", "memory-mcp"] }),
    installCount: 892,
    rating: 47,
    reviewCount: 39,
  },
];

// GET /api/marketplace — list items with search/filter
router.get("/", async (req: Request, res: Response) => {
  const { type, category, search, sort, limit, offset, public: isPublic } = req.query as Record<string, string>;

  try {
    const conditions = [eq(marketplaceItems.isPublic, true)];

    if (type) conditions.push(eq(marketplaceItems.type, type));
    if (category) conditions.push(eq(marketplaceItems.category, category));
    if (search) {
      conditions.push(
        or(
          like(marketplaceItems.name, `%${search}%`),
          like(marketplaceItems.description, `%${search}%`),
          like(marketplaceItems.tags, `%${search}%`),
        )
      );
    }

    const numLimit = Math.min(parseInt(limit || "50"), 100);
    const numOffset = parseInt(offset || "0");

    let orderBy = desc(marketplaceItems.installCount);
    if (sort === "newest") orderBy = desc(marketplaceItems.createdAt);
    if (sort === "rating") orderBy = desc(marketplaceItems.rating);
    if (sort === "name") orderBy = marketplaceItems.name;

    const items = await db
      .select()
      .from(marketplaceItems)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(numLimit)
      .offset(numOffset);

    const [{ total }] = await db
      .select({ total: count() })
      .from(marketplaceItems)
      .where(and(...conditions));

    const categories = await db
      .select({ category: marketplaceItems.category, count: count() })
      .from(marketplaceItems)
      .where(eq(marketplaceItems.isPublic, true))
      .groupBy(marketplaceItems.category);

    res.json({ items, total, limit: numLimit, offset: numOffset, categories: categories.filter((c) => c.category) });
  } catch (error) {
    console.error("Marketplace list error:", error);
    res.status(500).json({ error: "Failed to list marketplace items" });
  }
});

// POST /api/marketplace/seed — seed presets
router.post("/seed", requireAuth, async (_req: Request, res: Response) => {
  try {
    const existing = await db.select({ name: marketplaceItems.name }).from(marketplaceItems);
    const existingNames = new Set(existing.map((p) => p.name));

    const toInsert = PRESET_TEMPLATES.filter((p) => !existingNames.has(p.name));
    if (toInsert.length === 0) {
      res.json({ message: "All presets already seeded" });
      return;
    }

    const inserted = await db.insert(marketplaceItems).values(toInsert).returning();
    res.json({ message: `Seeded ${inserted.length} items`, items: inserted });
  } catch (error) {
    console.error("Marketplace seed error:", error);
    res.status(500).json({ error: "Failed to seed marketplace" });
  }
});

// POST /api/marketplace — publish new item
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { name, type, version, description, longDescription, icon, tags, category, content, configSchema, isPublic, orgId } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: "name and type required" });
    return;
  }

  const validTypes = ["template", "agent", "prompt", "mcp", "workflow", "plugin"];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `Invalid type. Valid: ${validTypes.join(", ")}` });
    return;
  }

  try {
    const [item] = await db
      .insert(marketplaceItems)
      .values({
        name, type, version, description, longDescription, icon, authorId: userId,
        tags: Array.isArray(tags) ? JSON.stringify(tags) : tags,
        category, content: content || "{}", configSchema: configSchema || "{}",
        isPublic: isPublic !== false, orgId,
      })
      .returning();
    res.json(item);
  } catch (error) {
    console.error("Marketplace publish error:", error);
    res.status(500).json({ error: "Failed to publish item" });
  }
});

// GET /api/marketplace/types — get valid types
router.get("/types", (_req: Request, res: Response) => {
  res.json({
    types: [
      { id: "template", name: "Template", icon: "📦", description: "Project templates and starters" },
      { id: "agent", name: "Agent", icon: "🤖", description: "Custom agent configurations and roles" },
      { id: "prompt", name: "System Prompt", icon: "📝", description: "System prompts and agent instructions" },
      { id: "mcp", name: "MCP Server", icon: "🔌", description: "MCP server configurations and collections" },
      { id: "workflow", name: "Workflow", icon: "🔄", description: "CI/CD pipelines, Docker stacks, automation" },
      { id: "plugin", name: "Plugin", icon: "🧩", description: "Straxor plugins published by community" },
    ],
  });
});

// GET /api/marketplace/:id — get item detail
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [item] = await db.select().from(marketplaceItems).where(eq(marketplaceItems.id, id));
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    const reviews = await db
      .select()
      .from(marketplaceReviews)
      .where(eq(marketplaceReviews.itemId, id))
      .orderBy(desc(marketplaceReviews.createdAt));

    const installCount = await db
      .select({ count: count() })
      .from(marketplaceInstallations)
      .where(eq(marketplaceInstallations.itemId, id));

    res.json({ ...item, reviews, totalInstallations: installCount[0]?.count || 0 });
  } catch (error) {
    console.error("Marketplace item error:", error);
    res.status(500).json({ error: "Failed to get item" });
  }
});

// PUT /api/marketplace/:id — update item
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, longDescription, icon, tags, category, content, isPublic, version } = req.body;

  try {
    const [item] = await db.select().from(marketplaceItems).where(eq(marketplaceItems.id, id));
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (longDescription !== undefined) updateData.longDescription = longDescription;
    if (icon !== undefined) updateData.icon = icon;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? JSON.stringify(tags) : tags;
    if (category !== undefined) updateData.category = category;
    if (content !== undefined) updateData.content = content;
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (version !== undefined) updateData.version = version;

    const [updated] = await db.update(marketplaceItems).set(updateData).where(eq(marketplaceItems.id, id)).returning();
    res.json(updated);
  } catch (error) {
    console.error("Marketplace update error:", error);
    res.status(500).json({ error: "Failed to update item" });
  }
});

// DELETE /api/marketplace/:id — delete item
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.delete(marketplaceItems).where(eq(marketplaceItems.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Marketplace delete error:", error);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// ── Install ──

// POST /api/marketplace/:id/install
router.post("/:id/install", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  const { projectId, config } = req.body;

  try {
    const [item] = await db.select().from(marketplaceItems).where(eq(marketplaceItems.id, id));
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    await db.insert(marketplaceInstallations).values({ itemId: id, userId, projectId, config: config || "{}" });
    await db.update(marketplaceItems).set({ installCount: (item.installCount || 0) + 1 }).where(eq(marketplaceItems.id, id));

    res.json({ success: true, item: { ...item, installCount: (item.installCount || 0) + 1 } });
  } catch (error) {
    console.error("Marketplace install error:", error);
    res.status(500).json({ error: "Failed to install item" });
  }
});

// ── Reviews ──

// POST /api/marketplace/:id/reviews
router.post("/:id/reviews", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be 1-5" });
    return;
  }

  try {
    const [item] = await db.select().from(marketplaceItems).where(eq(marketplaceItems.id, id));
    if (!item) { res.status(404).json({ error: "Item not found" }); return; }

    const [review] = await db.insert(marketplaceReviews).values({ itemId: id, userId, rating, comment }).returning();

    const stats = await db
      .select({ avg: sql<number>`ROUND(AVG(rating))`, cnt: count() })
      .from(marketplaceReviews)
      .where(eq(marketplaceReviews.itemId, id));

    await db.update(marketplaceItems).set({ rating: stats[0]?.avg || 0, reviewCount: (stats[0]?.cnt || 0) }).where(eq(marketplaceItems.id, id));

    res.json(review);
  } catch (error) {
    console.error("Marketplace review error:", error);
    res.status(500).json({ error: "Failed to add review" });
  }
});

// GET /api/marketplace/my — get user's published items
router.get("/my", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const items = await db
      .select()
      .from(marketplaceItems)
      .where(eq(marketplaceItems.authorId, userId))
      .orderBy(desc(marketplaceItems.createdAt));
    res.json(items);
  } catch (error) {
    console.error("My items error:", error);
    res.status(500).json({ error: "Failed to get my items" });
  }
});

export default router;
