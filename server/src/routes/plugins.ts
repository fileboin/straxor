import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { plugins, pluginEvents } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const BUILTIN_PLUGINS = [
  {
    name: "vps-deploy",
    type: "adapter",
    version: "1.0.0",
    description: "Custom VPS deployment adapter — deploy na bilo koji VPS provider",
    author: "Straxor",
    icon: "🖥",
    configSchema: JSON.stringify({ type: "object", properties: { host: { type: "string" }, port: { type: "number" }, username: { type: "string" }, keyFile: { type: "string" } } }),
    permissions: JSON.stringify(["deployment:create", "ssh:connect"]),
    entryPoint: "plugins/vps-deploy/index.js",
    isBuiltin: true,
    isInstalled: true,
  },
  {
    name: "slack-notifier",
    type: "integration",
    version: "2.1.0",
    description: "Šalje notifikacije o deployovima i greškama u Slack kanal",
    author: "Straxor",
    icon: "💬",
    configSchema: JSON.stringify({ type: "object", properties: { webhookUrl: { type: "string" }, channel: { type: "string" }, events: { type: "array", items: { type: "string" } } } }),
    permissions: JSON.stringify(["notifications:send"]),
    entryPoint: "plugins/slack-notifier/index.js",
    isBuiltin: true,
    isInstalled: true,
  },
  {
    name: "discord-bot",
    type: "integration",
    version: "1.2.0",
    description: "Discord bot za remote kontrolu — pokreni deploy, vidi logove, status",
    author: "Straxor",
    icon: "🎮",
    configSchema: JSON.stringify({ type: "object", properties: { token: { type: "string" }, guildId: { type: "string" }, channelId: { type: "string" } } }),
    permissions: JSON.stringify(["chat:read", "chat:write", "deployment:read", "logs:read"]),
    entryPoint: "plugins/discord-bot/index.js",
    isBuiltin: true,
    isInstalled: true,
  },
  {
    name: "code-review-agent",
    type: "tool",
    version: "1.0.0",
    description: "Automatski code review agent — lint, typecheck, security scan prije svakog commita",
    author: "Straxor",
    icon: "🔍",
    configSchema: JSON.stringify({ type: "object", properties: { autoReview: { type: "boolean" }, strictMode: { type: "boolean" }, excludedPaths: { type: "array", items: { type: "string" } } } }),
    permissions: JSON.stringify(["files:read", "files:write", "agent:tools"]),
    entryPoint: "plugins/code-review-agent/index.js",
    isBuiltin: true,
    isInstalled: true,
  },
  {
    name: "webhook-gateway",
    type: "integration",
    version: "1.0.0",
    description: "Webhook gateway — integriši Straxor sa bilo kojim eksternim sistemom",
    author: "Straxor",
    icon: "🔗",
    configSchema: JSON.stringify({ type: "object", properties: { url: { type: "string" }, secret: { type: "string" }, retryCount: { type: "number" }, headers: { type: "object" } } }),
    permissions: JSON.stringify(["webhooks:manage"]),
    entryPoint: "plugins/webhook-gateway/index.js",
    isBuiltin: true,
    isInstalled: true,
  },
  {
    name: "terminal-plus",
    type: "ui",
    version: "2.0.0",
    description: "Napredni terminal panel — multi-tab, tmux integracija, teme",
    author: "Straxor",
    icon: "💻",
    configSchema: JSON.stringify({ type: "object", properties: { shellPath: { type: "string" }, theme: { type: "string" }, fontSize: { type: "number" } } }),
    permissions: JSON.stringify(["terminal:open", "terminal:exec"]),
    entryPoint: "plugins/terminal-plus/index.js",
    isBuiltin: true,
    isInstalled: true,
  },
  {
    name: "grafana-metrics",
    type: "adapter",
    version: "1.0.0",
    description: "Grafana adapter — prikazuj metrike i grafikone direktno u Straxor-u",
    author: "Straxor",
    icon: "📈",
    configSchema: JSON.stringify({ type: "object", properties: { grafanaUrl: { type: "string" }, apiKey: { type: "string" }, dashboards: { type: "array", items: { type: "string" } } } }),
    permissions: JSON.stringify(["api:fetch"]),
    entryPoint: "plugins/grafana-metrics/index.js",
    isBuiltin: true,
    isInstalled: true,
  },
  {
    name: "jira-connector",
    type: "integration",
    version: "1.0.0",
    description: "Jira integracija — taskovi, bug tracking, automatski status update-i",
    author: "Straxor",
    icon: "📋",
    configSchema: JSON.stringify({ type: "object", properties: { jiraUrl: { type: "string" }, email: { type: "string" }, apiToken: { type: "string" }, projectKey: { type: "string" } } }),
    permissions: JSON.stringify(["api:fetch", "task:create", "task:update"]),
    entryPoint: "plugins/jira-connector/index.js",
    isBuiltin: true,
    isInstalled: true,
  },
  {
    name: "db-manager",
    type: "tool",
    version: "1.0.0",
    description: "SQL editor i database manager — pokreći upite direktno iz agenta",
    author: "Straxor",
    icon: "🗄",
    configSchema: JSON.stringify({ type: "object", properties: { connectionString: { type: "string" }, maxRows: { type: "number" }, readOnly: { type: "boolean" } } }),
    permissions: JSON.stringify(["database:query", "database:schema"]),
    entryPoint: "plugins/db-manager/index.js",
    isBuiltin: true,
    isInstalled: true,
  },
  {
    name: "custom-adapter-starter",
    type: "adapter",
    version: "1.0.0",
    description: "Starter template za pravljenje custom adaptera — deployment, infra, git",
    author: "Straxor",
    icon: "🚀",
    configSchema: JSON.stringify({ type: "object", properties: { providerName: { type: "string" }, providerType: { type: "string", enum: ["deployment", "infrastructure", "git"] }, baseUrl: { type: "string" } } }),
    permissions: JSON.stringify([]),
    entryPoint: "plugins/custom-adapter-starter/index.js",
    isBuiltin: true,
    isInstalled: true,
  },
  {
    name: "custom-panel-starter",
    type: "ui",
    version: "1.0.0",
    description: "Starter template za UI dodatke — kreiraj custom panel za Workspace",
    author: "Straxor",
    icon: "🖼",
    configSchema: JSON.stringify({ type: "object", properties: { panelName: { type: "string" }, panelIcon: { type: "string" }, routePath: { type: "string" } } }),
    permissions: JSON.stringify(["ui:panel"]),
    entryPoint: "plugins/custom-panel-starter/index.js",
    isBuiltin: true,
    isInstalled: true,
  },
  {
    name: "custom-tool-starter",
    type: "tool",
    version: "1.0.0",
    description: "Starter template za custom agent tool — proširi agentove mogućnosti",
    author: "Straxor",
    icon: "🧰",
    configSchema: JSON.stringify({ type: "object", properties: { toolName: { type: "string" }, toolDescription: { type: "string" }, parameters: { type: "object" } } }),
    permissions: JSON.stringify(["agent:tools", "api:fetch"]),
    entryPoint: "plugins/custom-tool-starter/index.js",
    isBuiltin: true,
    isInstalled: true,
  },
  {
    name: "custom-integration-starter",
    type: "integration",
    version: "1.0.0",
    description: "Starter template za integracije — poveži Straxor sa bilo kojim API-jem",
    author: "Straxor",
    icon: "🔌",
    configSchema: JSON.stringify({ type: "object", properties: { integrationName: { type: "string" }, baseUrl: { type: "string" }, authType: { type: "string", enum: ["api-key", "oauth2", "basic", "none"] } } }),
    permissions: JSON.stringify(["api:fetch", "webhooks:manage"]),
    entryPoint: "plugins/custom-integration-starter/index.js",
    isBuiltin: true,
    isInstalled: true,
  },
];

// GET /api/plugins — list all plugins
router.get("/", requireAuth, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(plugins).orderBy(desc(plugins.createdAt));
    res.json(rows);
  } catch (error) {
    console.error("Plugin list error:", error);
    res.status(500).json({ error: "Failed to list plugins" });
  }
});

// POST /api/plugins/seed — seed built-in plugins
router.post("/seed", requireAuth, async (_req: Request, res: Response) => {
  try {
    const existing = await db.select({ name: plugins.name }).from(plugins);
    const existingNames = new Set(existing.map((p) => p.name));

    const toInsert = BUILTIN_PLUGINS.filter((p) => !existingNames.has(p.name));
    if (toInsert.length === 0) {
      res.json({ message: "All built-in plugins already seeded" });
      return;
    }

    const inserted = await db.insert(plugins).values(toInsert).returning();
    res.json({ message: `Seeded ${inserted.length} plugins`, plugins: inserted });
  } catch (error) {
    console.error("Plugin seed error:", error);
    res.status(500).json({ error: "Failed to seed plugins" });
  }
});

// POST /api/plugins — install a custom plugin
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { name, type, version, description, author, icon, configSchema, permissions, entryPoint, settings } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: "name and type required" });
    return;
  }

  const validTypes = ["adapter", "ui", "tool", "integration", "custom"];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `Invalid type. Valid: ${validTypes.join(", ")}` });
    return;
  }

  try {
    const [plugin] = await db
      .insert(plugins)
      .values({ name, type, version, description, author, icon, configSchema, permissions, entryPoint, settings, isInstalled: true, isBuiltin: false, isEnabled: true })
      .returning();
    res.json(plugin);
  } catch (error: any) {
    if (error?.code === "23505") {
      res.status(409).json({ error: "Plugin with this name already exists" });
      return;
    }
    console.error("Plugin install error:", error);
    res.status(500).json({ error: "Failed to install plugin" });
  }
});

// GET /api/plugins/:id — get plugin details
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [plugin] = await db.select().from(plugins).where(eq(plugins.id, id));
    if (!plugin) { res.status(404).json({ error: "Plugin not found" }); return; }

    const events = await db.select().from(pluginEvents).where(eq(pluginEvents.pluginId, id));
    res.json({ ...plugin, events });
  } catch (error) {
    console.error("Plugin get error:", error);
    res.status(500).json({ error: "Failed to get plugin" });
  }
});

// PUT /api/plugins/:id — update plugin (enable/disable, settings)
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isEnabled, settings, config } = req.body;

  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
    if (settings !== undefined) updateData.settings = typeof settings === "string" ? settings : JSON.stringify(settings);
    if (config !== undefined) updateData.configSchema = typeof config === "string" ? config : JSON.stringify(config);

    const [updated] = await db.update(plugins).set(updateData).where(eq(plugins.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Plugin not found" }); return; }
    res.json(updated);
  } catch (error) {
    console.error("Plugin update error:", error);
    res.status(500).json({ error: "Failed to update plugin" });
  }
});

// DELETE /api/plugins/:id — uninstall plugin
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const [plugin] = await db.select().from(plugins).where(eq(plugins.id, id));
    if (!plugin) { res.status(404).json({ error: "Plugin not found" }); return; }
    if (plugin.isBuiltin) { res.status(403).json({ error: "Cannot uninstall built-in plugin" }); return; }

    await db.delete(pluginEvents).where(eq(pluginEvents.pluginId, id));
    await db.delete(plugins).where(eq(plugins.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Plugin uninstall error:", error);
    res.status(500).json({ error: "Failed to uninstall plugin" });
  }
});

// ── Plugin Events ──

// POST /api/plugins/:id/events — register event handler
router.post("/:id/events", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { event, handler } = req.body;

  if (!event || !handler) {
    res.status(400).json({ error: "event and handler required" });
    return;
  }

  try {
    const [row] = await db.insert(pluginEvents).values({ pluginId: id, event, handler }).returning();
    res.json(row);
  } catch (error) {
    console.error("Plugin event register error:", error);
    res.status(500).json({ error: "Failed to register event" });
  }
});

// DELETE /api/plugins/:id/events/:eventId — remove event handler
router.delete("/:id/events/:eventId", requireAuth, async (req: Request, res: Response) => {
  const { eventId } = req.params;
  try {
    await db.delete(pluginEvents).where(eq(pluginEvents.id, eventId));
    res.json({ success: true });
  } catch (error) {
    console.error("Plugin event delete error:", error);
    res.status(500).json({ error: "Failed to delete event handler" });
  }
});

// GET /api/plugins/browse/marketplace — get available presets
router.get("/browse/marketplace", (_req: Request, res: Response) => {
  res.json({
    plugins: BUILTIN_PLUGINS,
    categories: [
      { id: "adapter", name: "Adapteri", icon: "🔌", description: "Custom deployment, infrastructure i git provideri" },
      { id: "ui", name: "UI Dodaci", icon: "🖼", description: "Custom paneli, tile-ovi i teme" },
      { id: "tool", name: "Agent Alati", icon: "🧰", description: "Custom toolovi za agente" },
      { id: "integration", name: "Integracije", icon: "🔗", description: "Webhookovi, botovi, eksterni API-ji" },
      { id: "custom", name: "Custom", icon: "⚙", description: "Sve ostalo — nema ograničenja" },
    ],
  });
});

export default router;
