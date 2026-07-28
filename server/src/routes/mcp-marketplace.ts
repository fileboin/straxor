import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { mcpServers } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

interface McpServerBody {
  name?: string;
  description?: string;
  icon?: string;
  category?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  tools?: string[];
  isEnabled?: boolean;
}

const MCP_PRESETS = [
  {
    name: "Firecrawl MCP",
    description: "Web scraping i crawling — pretvori URL-ove u Markdown, pretražuj web",
    icon: "🔥",
    category: "web",
    command: "npx",
    args: ["@mendable/firecrawl-mcp"],
    env: {},
    isEnabled: false,
  },
  {
    name: "Database MCP",
    description: "SQL baza podataka — query, schema, migracije preko MCP",
    icon: "🗄",
    category: "data",
    command: "npx",
    args: ["@anthropic/mcp-database"],
    env: {},
    isEnabled: false,
  },
  {
    name: "Documentation MCP",
    description: "Dokumentacija — fetch docs, search API reference, read tutorials",
    icon: "📖",
    category: "docs",
    command: "npx",
    args: ["@anthropic/mcp-docs"],
    env: {},
    isEnabled: false,
  },
  {
    name: "Filesystem MCP",
    description: "Lokalni fajl sistem — read, write, edit, search fajlova",
    icon: "📁",
    category: "system",
    command: "npx",
    args: ["@modelcontextprotocol/server-filesystem"],
    env: {},
    isEnabled: false,
  },
  {
    name: "GitHub MCP",
    description: "GitHub API — repo management, PRs, issues, code search",
    icon: "🐙",
    category: "git",
    command: "npx",
    args: ["@modelcontextprotocol/server-github"],
    env: { GITHUB_TOKEN: "" },
    isEnabled: false,
  },
  {
    name: "Slack MCP",
    description: "Slack integracija — čitanje poruka, slanje obavještenja",
    icon: "💬",
    category: "communication",
    command: "npx",
    args: ["@modelcontextprotocol/server-slack"],
    env: { SLACK_BOT_TOKEN: "", SLACK_TEAM_ID: "" },
    isEnabled: false,
  },
  {
    name: "Playwright MCP",
    description: "Browser automatizacija — screenshot, test, scrape",
    icon: "🎭",
    category: "web",
    command: "npx",
    args: ["@anthropic/mcp-playwright"],
    env: {},
    isEnabled: false,
  },
  {
    name: "Memory MCP",
    description: "Perzistentno pamćenje — knowledge graph, entity memorija",
    icon: "🧠",
    category: "ai",
    command: "npx",
    args: ["@anthropic/mcp-memory"],
    env: {},
    isEnabled: false,
  },
  {
    name: "Sequential Thinking MCP",
    description: "Struktuirano razmišljanje — multi-step reasoning za kompleksne probleme",
    icon: "🔗",
    category: "ai",
    command: "npx",
    args: ["@anthropic/mcp-sequential-thinking"],
    env: {},
    isEnabled: false,
  },
  {
    name: "Puppeteer MCP",
    description: "Headless browser — navigacija, screenshot, JS evaluacija",
    icon: "🕷",
    category: "web",
    command: "npx",
    args: ["@anthropic/mcp-puppeteer"],
    env: {},
    isEnabled: false,
  },
];

// GET /api/mcp-marketplace — list user's MCP servers
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  try {
    const rows = await db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.userId, userId))
      .orderBy(desc(mcpServers.createdAt));

    const parsed = rows.map((r) => ({
      ...r,
      args: tryParseJsonArray(r.args),
      env: tryParseJson(r.env) || {},
      tools: tryParseJsonArray(r.tools),
    }));

    res.json(parsed);
  } catch (error) {
    console.error("MCP marketplace list error:", error);
    res.status(500).json({ error: "Failed to list MCP servers" });
  }
});

// GET /api/mcp-marketplace/presets — get built-in presets
router.get("/presets", requireAuth, (_req: Request, res: Response) => {
  res.json(MCP_PRESETS);
});

// POST /api/mcp-marketplace — add MCP server
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const body = req.body as McpServerBody;

  if (!body.name || !body.command) {
    res.status(400).json({ error: "Name and command are required" });
    return;
  }

  try {
    const [row] = await db
      .insert(mcpServers)
      .values({
        userId,
        name: body.name,
        description: body.description || null,
        icon: body.icon || "🔌",
        category: body.category || "custom",
        command: body.command,
        args: body.args ? JSON.stringify(body.args) : "[]",
        env: body.env ? JSON.stringify(body.env) : "{}",
        tools: body.tools ? JSON.stringify(body.tools) : "[]",
        isEnabled: body.isEnabled !== undefined ? body.isEnabled : true,
      })
      .returning();

    res.json({ ...row, args: tryParseJsonArray(row.args), env: tryParseJson(row.env) || {}, tools: tryParseJsonArray(row.tools) });
  } catch (error) {
    console.error("MCP marketplace add error:", error);
    res.status(500).json({ error: "Failed to add MCP server" });
  }
});

// PUT /api/mcp-marketplace/:id — update MCP server
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  const body = req.body as McpServerBody;

  try {
    const updates: Record<string, any> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.category !== undefined) updates.category = body.category;
    if (body.command !== undefined) updates.command = body.command;
    if (body.args !== undefined) updates.args = JSON.stringify(body.args);
    if (body.env !== undefined) updates.env = JSON.stringify(body.env);
    if (body.tools !== undefined) updates.tools = JSON.stringify(body.tools);
    if (body.isEnabled !== undefined) updates.isEnabled = body.isEnabled;
    updates.updatedAt = new Date();

    const [row] = await db
      .update(mcpServers)
      .set(updates)
      .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)))
      .returning();

    if (!row) { res.status(404).json({ error: "MCP server not found" }); return; }

    res.json({ ...row, args: tryParseJsonArray(row.args), env: tryParseJson(row.env) || {}, tools: tryParseJsonArray(row.tools) });
  } catch (error) {
    console.error("MCP marketplace update error:", error);
    res.status(500).json({ error: "Failed to update MCP server" });
  }
});

// DELETE /api/mcp-marketplace/:id
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { id } = req.params;

  try {
    await db
      .delete(mcpServers)
      .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)));

    res.json({ ok: true });
  } catch (error) {
    console.error("MCP marketplace delete error:", error);
    res.status(500).json({ error: "Failed to delete MCP server" });
  }
});

function tryParseJson(val: string | null | undefined): any {
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}

function tryParseJsonArray(val: string | null | undefined): any[] {
  const parsed = tryParseJson(val);
  return Array.isArray(parsed) ? parsed : [];
}

export default router;
