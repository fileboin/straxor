import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";
import { createContextEngine } from "../adapters/context/engine.js";
import { createWebResearchAdapter } from "../adapters/context/web-research.js";

const router = Router();

// ── Project Rules ──

// GET /api/context/rules — list rules for project
router.get("/rules", requireAuth, async (req: any, res) => {
  try {
    const { db } = await import("../db/index.js");
    const { projectRules } = await import("../db/schema.js");
    const { eq, and } = await import("drizzle-orm");

    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: "projectId required" });

    const rules = await db.select().from(projectRules)
      .where(and(eq(projectRules.projectId, projectId), eq(projectRules.userId, req.userId)));
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to list rules" });
  }
});

// POST /api/context/rules — create rule
router.post("/rules", requireAuth, async (req: any, res) => {
  try {
    const { db } = await import("../db/index.js");
    const { projectRules } = await import("../db/schema.js");

    const { projectId, name, content, category } = req.body;
    if (!projectId || !name || !content) {
      return res.status(400).json({ error: "projectId, name, and content required" });
    }

    const [rule] = await db.insert(projectRules).values({
      projectId,
      userId: req.userId,
      name,
      content,
      category: category || "general",
    }).returning();
    res.json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create rule" });
  }
});

// PUT /api/context/rules/:id — update rule
router.put("/rules/:id", requireAuth, async (req: any, res) => {
  try {
    const { db } = await import("../db/index.js");
    const { projectRules } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");

    const { id } = req.params;
    const { name, content, category, isActive, priority } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (content !== undefined) updates.content = content;
    if (category !== undefined) updates.category = category;
    if (isActive !== undefined) updates.isActive = isActive;
    if (priority !== undefined) updates.priority = priority;

    const [rule] = await db.update(projectRules)
      .set(updates)
      .where(eq(projectRules.id, id))
      .returning();
    res.json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update rule" });
  }
});

// DELETE /api/context/rules/:id — delete rule
router.delete("/rules/:id", requireAuth, async (req: any, res) => {
  try {
    const { db } = await import("../db/index.js");
    const { projectRules } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");

    await db.delete(projectRules).where(eq(projectRules.id, req.params.id));
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete rule" });
  }
});

// ── Memories ──

// GET /api/context/memories — list memories
router.get("/memories", requireAuth, async (req: any, res) => {
  try {
    const { db } = await import("../db/index.js");
    const { memories } = await import("../db/schema.js");
    const { eq, or, isNull } = await import("drizzle-orm");

    const { projectId } = req.query;
    const rows = await db.select().from(memories)
      .where(
        eq(memories.userId, req.userId)
      );
    // Filter: global memories OR project-specific
    const filtered = rows.filter((m) => m.isGlobal || (projectId && m.projectId === projectId));
    res.json(filtered);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to list memories" });
  }
});

// POST /api/context/memories — create memory
router.post("/memories", requireAuth, async (req: any, res) => {
  try {
    const { db } = await import("../db/index.js");
    const { memories } = await import("../db/schema.js");

    const { projectId, key, content, category, isGlobal, expiresAt } = req.body;
    if (!key || !content) {
      return res.status(400).json({ error: "key and content required" });
    }

    const [mem] = await db.insert(memories).values({
      userId: req.userId,
      projectId: projectId || null,
      key,
      content,
      category: category || "general",
      source: "manual",
      isGlobal: isGlobal || false,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();
    res.json(mem);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create memory" });
  }
});

// PUT /api/context/memories/:id — update memory
router.put("/memories/:id", requireAuth, async (req: any, res) => {
  try {
    const { db } = await import("../db/index.js");
    const { memories } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");

    const { id } = req.params;
    const { key, content, category, isGlobal } = req.body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (key !== undefined) updates.key = key;
    if (content !== undefined) updates.content = content;
    if (category !== undefined) updates.category = category;
    if (isGlobal !== undefined) updates.isGlobal = isGlobal;

    const [mem] = await db.update(memories)
      .set(updates)
      .where(eq(memories.id, id))
      .returning();
    res.json(mem);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update memory" });
  }
});

// DELETE /api/context/memories/:id — delete memory
router.delete("/memories/:id", requireAuth, async (req: any, res) => {
  try {
    const { db } = await import("../db/index.js");
    const { memories } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");

    await db.delete(memories).where(eq(memories.id, req.params.id));
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete memory" });
  }
});

// ── Web Research ──

// POST /api/context/web/fetch — fetch URL content
router.post("/web/fetch", requireAuth, async (req: any, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url required" });

    const web = createWebResearchAdapter();
    const result = await web.fetchUrl(url);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch URL" });
  }
});

// POST /api/context/web/search — search web
router.post("/web/search", requireAuth, async (req: any, res) => {
  try {
    const { query, maxResults } = req.body;
    if (!query) return res.status(400).json({ error: "query required" });

    const web = createWebResearchAdapter();
    const results = await web.search(query, maxResults || 5);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to search web" });
  }
});

// POST /api/context/web/save — save web research to DB
router.post("/web/save", requireAuth, async (req: any, res) => {
  try {
    const { db } = await import("../db/index.js");
    const { webResearch } = await import("../db/schema.js");

    const { url, title, content, summary } = req.body;
    if (!url) return res.status(400).json({ error: "url required" });

    const tokenCount = Math.ceil((content || "").length / 4);
    const [saved] = await db.insert(webResearch).values({
      userId: req.userId,
      url,
      title: title || "",
      content: content || "",
      summary: summary || "",
      tokenCount,
    }).returning();
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save web research" });
  }
});

// GET /api/context/web/history — list saved web research
router.get("/web/history", requireAuth, async (req: any, res) => {
  try {
    const { db } = await import("../db/index.js");
    const { webResearch } = await import("../db/schema.js");
    const { eq } = await import("drizzle-orm");

    const rows = await db.select().from(webResearch)
      .where(eq(webResearch.userId, req.userId));
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to list web history" });
  }
});

// ── Context Assembly ──

// POST /api/context/assemble — assemble context for a prompt
router.post("/assemble", requireAuth, async (req: any, res) => {
  try {
    const { db } = await import("../db/index.js");
    const { projectRules, memories } = await import("../db/schema.js");
    const { eq, and } = await import("drizzle-orm");

    const { prompt, projectId, machineId, projectPath, maxTokens } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt required" });

    // Load rules
    let rules: { name: string; content: string; category: string }[] = [];
    if (projectId) {
      const rows = await db.select().from(projectRules)
        .where(and(eq(projectRules.projectId, projectId), eq(projectRules.userId, req.userId)));
      rules = rows.filter((r) => r.isActive !== false).map((r) => ({ name: r.name, content: r.content, category: r.category }));
    }

    // Load memories
    let mems: { key: string; content: string; category: string }[] = [];
    const allMems = await db.select().from(memories).where(eq(memories.userId, req.userId));
    mems = allMems
      .filter((m) => m.isGlobal || (projectId && m.projectId === projectId))
      .filter((m) => !m.expiresAt || new Date(m.expiresAt) > new Date())
      .map((m) => ({ key: m.key, content: m.content, category: m.category }));

    // Find relevant files if machineId + projectPath provided
    let relevantFiles: { path: string; content: string }[] = [];
    if (machineId && projectPath) {
      try {
        const search = getAdapters().search(req.userId);
        const searchResults = await search.search({ query: prompt, machineId, rootPath: projectPath, mode: "text", maxResults: 10 });
        relevantFiles = searchResults.results.map((r) => ({ path: r.path, content: r.content || "" }));
      } catch { /* ok */ }
    }

    const engine = createContextEngine();
    const assembled = await engine.assemble({
      prompt,
      rules,
      memories: mems,
      relevantFiles,
      maxTokens: maxTokens || 8000,
    });

    res.json(assembled);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to assemble context" });
  }
});

// POST /api/context/summarize — summarize text
router.post("/summarize", requireAuth, async (req: any, res) => {
  try {
    const { text, maxTokens } = req.body;
    if (!text) return res.status(400).json({ error: "text required" });

    const engine = createContextEngine();
    const summarized = await engine.summarize(text, maxTokens || 2000);
    const tokenCount = engine.countTokens(summarized);

    res.json({ summarized, tokenCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to summarize" });
  }
});

// POST /api/context/count-tokens — count tokens
router.post("/count-tokens", requireAuth, async (req: any, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text required" });

    const engine = createContextEngine();
    const count = engine.countTokens(text);
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to count tokens" });
  }
});

export default router;
