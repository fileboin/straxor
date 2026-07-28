import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getRuntimeManager } from "../runtime/manager.js";
import { createOpenCodeUniversalAdapter } from "../runtime/opencode-universal.js";
import { createCrushAdapter } from "../runtime/crush/adapter.js";
import { createFreeClaudeCodeAdapter } from "../runtime/free-claude-code/adapter.js";
import { createAgentRuntimeAdapter } from "../runtime/agent-runtime/adapter.js";
import { AGENT_RUNTIME_META } from "../runtime/agent-runtime/types.js";
import type {
  RuntimeId, RuntimeDefinition, RuntimeHealth, RuntimeChannel,
  ProviderConfig, MCPServerConfig,
} from "../runtime/types.js";

const router = Router();

// ── Initialize runtimes on first request ──
let initialized = false;

function ensureInit(userId: string) {
  if (initialized) return;
  initialized = true;

  const mgr = getRuntimeManager();

  // Register OpenCode
  mgr.register(
    {
      id: "opencode",
      name: "OpenCode",
      description: "Open-source AI coding agent — SSH-based, local or remote VPS",
      icon: "◇",
      color: "text-blue-400",
      repoUrl: "https://github.com/opencode-ai/opencode",
      isInstalled: true,
      isEnabled: true,
    },
    createOpenCodeUniversalAdapter(userId)
  );

  // Register Crush
  mgr.register(
    {
      id: "crush",
      name: "Crush",
      description: "Modern AI coding runtime — MCP support, multi-provider, fast",
      icon: "💎",
      color: "text-purple-400",
      repoUrl: "https://github.com/anthropics/crush",
      isInstalled: false,
      isEnabled: true,
    },
    createCrushAdapter()
  );

  // Register Free Claude Code
  mgr.register(
    {
      id: "free-claude-code",
      name: "Free Claude Code",
      description: "Python-based AI coding proxy — 29 providers, Claude Code/Codex/Pi support",
      icon: "🆓",
      color: "text-yellow-400",
      repoUrl: "https://github.com/Alishahryar1/free-claude-code",
      isInstalled: false,
      isEnabled: true,
    },
    createFreeClaudeCodeAdapter()
  );

  // Register Agent Runtimes (Faza 4 — Advanced Adapter Ecosystem)
  const agentRuntimes = ["openhands", "deerflow", "voltagent", "langgraph", "crewai", "autogen", "agentarius"] as const;
  for (const agentId of agentRuntimes) {
    const meta = AGENT_RUNTIME_META[agentId];
    mgr.register(
      {
        id: agentId as RuntimeId,
        name: meta.name,
        description: meta.description,
        icon: meta.icon,
        color: meta.color,
        repoUrl: meta.repoUrl,
        isInstalled: false,
        isEnabled: true,
      },
      createAgentRuntimeAdapter(agentId)
    );
  }

  // Future placeholders
  const futureRuntimes: RuntimeDefinition[] = [
    { id: "claude-code", name: "Claude Code", description: "Anthropic's official CLI agent", icon: "◆", color: "text-orange-400", isInstalled: false, isEnabled: false },
    { id: "codex", name: "Codex CLI", description: "OpenAI's coding agent CLI", icon: "◉", color: "text-green-400", isInstalled: false, isEnabled: false },
    { id: "gemini-cli", name: "Gemini CLI", description: "Google's Gemini coding agent", icon: "◇", color: "text-blue-400", isInstalled: false, isEnabled: false },
    { id: "cline", name: "Cline", description: "VS Code AI coding extension", icon: "⚡", color: "text-cyan-400", isInstalled: false, isEnabled: false },
    { id: "continue", name: "Continue", description: "Open-source AI code assistant", icon: "▶", color: "text-emerald-400", isInstalled: false, isEnabled: false },
    { id: "goose", name: "Goose", description: "Block's AI coding agent", icon: "🪿", color: "text-amber-400", isInstalled: false, isEnabled: false },
  ];

  for (const def of futureRuntimes) {
    // Only register definition, no adapter yet
    mgr.register(def, {
      id: def.id,
      name: def.name,
      async install() { throw new Error("Not implemented"); },
      async isInstalled() { return false; },
      async createSession() { throw new Error("Not implemented"); },
      async resumeSession() { throw new Error("Not implemented"); },
      async listSessions() { return []; },
      async sendMessage() { throw new Error("Not implemented"); },
      async openEventStream() { throw new Error("Not implemented"); },
      async getTodos() { return []; },
      async getDiff() { return []; },
      async abortSession() { return false; },
      async healthCheck() { return { status: "unknown", running: false, sshConnected: false, port: null }; },
      async restart() { return { status: "unknown", running: false, sshConnected: false, port: null }; },
      async reconnect() { return { status: "unknown", running: false, sshConnected: false, port: null }; },
      async updateRuntime() { return { status: "unknown", running: false, sshConnected: false, port: null }; },
      async executeCommand() { throw new Error("Not implemented"); },
    });
  }
}

// GET /api/runtimes — list all registered runtimes
router.get("/", requireAuth, (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const runtimes = mgr.listAll().map((d) => ({
    ...d,
    isActive: d.id === mgr.getActiveId(),
    health: mgr.getCachedHealth(d.id),
  }));
  res.json(runtimes);
});

// GET /api/runtimes/active — get active runtime
router.get("/active", requireAuth, (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const activeId = mgr.getActiveId();
  const def = mgr.getDefinition(activeId);
  const health = mgr.getCachedHealth(activeId);
  res.json({ id: activeId, definition: def, health });
});

// POST /api/runtimes/switch — switch active runtime
router.post("/switch", requireAuth, (req, res) => {
  ensureInit((req as any).userId);
  const { runtimeId } = req.body as { runtimeId: RuntimeId };
  const mgr = getRuntimeManager();
  try {
    mgr.setActive(runtimeId);
    const def = mgr.getDefinition(runtimeId);
    res.json({ ok: true, runtime: def });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/runtimes/:id/health — check health of a specific runtime
router.get("/:id/health", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const { id } = req.params;
  const { machineId } = req.query;
  const mgr = getRuntimeManager();
  try {
    const health = await mgr.checkHealth(String(machineId || ""), id as RuntimeId);
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/runtimes/:id/restart — restart a runtime
router.post("/:id/restart", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const { id } = req.params;
  const { machineId } = req.body;
  const mgr = getRuntimeManager();
  try {
    const health = await mgr.restart(machineId, id as RuntimeId);
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/runtimes/:id/reconnect — reconnect a runtime
router.post("/:id/reconnect", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const { id } = req.params;
  const { machineId } = req.body;
  const mgr = getRuntimeManager();
  try {
    const health = await mgr.reconnect(machineId, id as RuntimeId);
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/runtimes/:id/update — update runtime
router.post("/:id/update", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const { id } = req.params;
  const { machineId, channel, version } = req.body as {
    machineId: string; channel: RuntimeChannel; version?: string;
  };
  const mgr = getRuntimeManager();
  try {
    const health = await mgr.updateRuntime(machineId, channel, version, id as RuntimeId);
    res.json(health);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/runtimes/:id/install — install runtime on machine
router.post("/:id/install", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const { id } = req.params;
  const { machineId } = req.body;
  const mgr = getRuntimeManager();
  try {
    const adapter = mgr.getAdapter(id as RuntimeId);
    await adapter.install(machineId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Session routes (delegate to active runtime) ──

// POST /api/runtimes/sessions — create session
router.post("/sessions", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const { machineId, title, runtimeId } = req.body;
  try {
    const adapter = mgr.getAdapter(runtimeId);
    const session = await adapter.createSession(machineId, title);
    res.json(session);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runtimes/sessions — list sessions
router.get("/sessions", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const { machineId, runtimeId } = req.query;
  try {
    const adapter = mgr.getAdapter(runtimeId as RuntimeId | undefined);
    const sessions = await adapter.listSessions(String(machineId || ""));
    res.json(sessions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/runtimes/sessions/:id/send — send message
router.post("/sessions/:id/send", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const { id } = req.params;
  const { machineId, text, mode, systemPrompt, runtimeId } = req.body;
  try {
    const adapter = mgr.getAdapter(runtimeId);
    const result = await adapter.sendMessage(machineId, String(id), text, { mode, systemPrompt });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runtimes/sessions/:id/todos
router.get("/sessions/:id/todos", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const { id } = req.params;
  const { machineId, runtimeId } = req.query;
  try {
    const adapter = mgr.getAdapter(runtimeId as RuntimeId | undefined);
    const todos = await adapter.getTodos(String(machineId || ""), String(id));
    res.json(todos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runtimes/sessions/:id/diff
router.get("/sessions/:id/diff", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const { id } = req.params;
  const { machineId, runtimeId } = req.query;
  try {
    const adapter = mgr.getAdapter(runtimeId as RuntimeId | undefined);
    const diff = await adapter.getDiff(String(machineId || ""), String(id));
    res.json(diff);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/runtimes/sessions/:id/abort
router.post("/sessions/:id/abort", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const { id } = req.params;
  const { machineId, runtimeId } = req.body;
  try {
    const adapter = mgr.getAdapter(runtimeId);
    const ok = await adapter.abortSession(machineId, String(id));
    res.json({ ok });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Provider routes ──

// POST /api/runtimes/providers — set provider for runtime
router.post("/providers", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const { machineId, runtimeId, ...config } = req.body as {
    machineId: string; runtimeId: RuntimeId;
  } & ProviderConfig;
  try {
    const adapter = mgr.getAdapter(runtimeId);
    if (adapter.setProvider) {
      await adapter.setProvider(machineId, config as ProviderConfig);
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/runtimes/providers — get active provider
router.get("/providers", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const { machineId, runtimeId } = req.query;
  try {
    const adapter = mgr.getAdapter(runtimeId as RuntimeId | undefined);
    const provider = adapter.getActiveProvider
      ? await adapter.getActiveProvider(String(machineId || ""))
      : null;
    res.json(provider);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── MCP routes ──

// GET /api/runtimes/mcp — list MCP servers
router.get("/mcp", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const { machineId, runtimeId } = req.query;
  try {
    const adapter = mgr.getAdapter(runtimeId as RuntimeId | undefined);
    const servers = adapter.listMCPServers
      ? await adapter.listMCPServers(String(machineId || ""))
      : [];
    res.json(servers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/runtimes/mcp — add MCP server
router.post("/mcp", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const { machineId, runtimeId, ...config } = req.body as {
    machineId: string; runtimeId: RuntimeId;
  } & MCPServerConfig;
  try {
    const adapter = mgr.getAdapter(runtimeId);
    if (adapter.addMCPServer) {
      await adapter.addMCPServer(machineId, config as MCPServerConfig);
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/runtimes/mcp/:serverId
router.delete("/mcp/:serverId", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const { serverId } = req.params;
  const { machineId, runtimeId } = req.query;
  try {
    const adapter = mgr.getAdapter(runtimeId as RuntimeId | undefined);
    if (adapter.removeMCPServer) {
      await adapter.removeMCPServer(String(machineId || ""), String(serverId));
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Shell (execute command via active runtime) ──

// POST /api/runtimes/exec — execute shell command
router.post("/exec", requireAuth, async (req, res) => {
  ensureInit((req as any).userId);
  const mgr = getRuntimeManager();
  const { machineId, command, runtimeId } = req.body;
  try {
    const adapter = mgr.getAdapter(runtimeId);
    const stdout = await adapter.executeCommand(machineId, command);
    res.json({ stdout });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
