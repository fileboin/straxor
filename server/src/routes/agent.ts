import { Router } from "express";
import type { Request, Response } from "express";
import { getAdapters } from "../adapters/registry.js";
import { requireAuth } from "../middleware/auth.js";
import { resolveAttachments, type AttachmentRef } from "../lib/attachments.js";
import { isLocalMachineId, slotFromMachineId } from "../runtime/local/engine.js";
import { withSharedWorkspace } from "../runtime/local/shared-workspace.js";
import { db } from "../db/index.js";
import { agentBusEvents } from "../db/schema.js";
import { and, desc, eq } from "drizzle-orm";

type AgentBusAction = "help" | "review" | "warn";
type PanelSlot = "ask" | "agent";

function buildAgentBusPrompt(input: {
  from: PanelSlot;
  to: PanelSlot;
  action: AgentBusAction;
  content: string;
  sourceRepo?: string | null;
  targetRepo?: string | null;
  hopCount?: number;
  chainId?: string;
}) {
  const crossRepo = input.sourceRepo && input.targetRepo && input.sourceRepo !== input.targetRepo;
  const sourceRepoLabel = input.sourceRepo || "unknown";
  const targetRepoLabel = input.targetRepo || "unknown";
  const warning = crossRepo
    ? `Panels are currently bound to different repositories (${sourceRepoLabel} → ${targetRepoLabel}). Treat this as cross-repo collaboration and call out any path, dependency, branch, or architectural mismatch explicitly.`
    : undefined;

  const actionLine =
    input.action === "review"
      ? "Perform a strict code review. Focus on bugs, regressions, security risks, missing tests, broken assumptions, and unsafe edits."
      : input.action === "warn"
        ? "Produce a concise warning with concrete risks, failure modes, and the most urgent next checks."
        : "Help the other panel solve its task. Keep advice implementation-focused and repo-aware.";

  const hopCount = Number.isFinite(input.hopCount) ? Math.max(0, Number(input.hopCount)) : 0;
  const chainId = input.chainId || `chain-${Date.now()}`;

  const prompt = [
    `[STRAXOR AGENT BUS]`,
    `Chain ID: ${chainId}`,
    `Hop Count: ${hopCount}`,
    `From panel: ${input.from}`,
    `To panel: ${input.to}`,
    `Action: ${input.action}`,
    `Source repository: ${sourceRepoLabel}`,
    `Target repository: ${targetRepoLabel}`,
    warning || "Panels appear to target the same repository or one repo is not set.",
    actionLine,
    "When repository context differs, never assume files, branches, or runtime state are shared. State uncertainty clearly.",
    "---",
    input.content,
    `[/STRAXOR AGENT BUS]`,
  ].join("\n");

  return { prompt, warning };
}

const CONNECTION_TIMEOUT_MS = 30 * 60 * 1000; // 30 min hard timeout
const router = Router();

router.use(requireAuth);

router.post("/bus/analyze", async (req: Request, res: Response) => {
  const { from, to, action, content, sourceRepo, targetRepo, hopCount, chainId } = req.body as {
    from: PanelSlot;
    to: PanelSlot;
    action: AgentBusAction;
    content: string;
    sourceRepo?: string | null;
    targetRepo?: string | null;
    hopCount?: number;
    chainId?: string;
  };

  if (!from || !to || !action || !content) {
    res.status(400).json({ error: "Missing required fields: from, to, action, content" });
    return;
  }

  const analysis = buildAgentBusPrompt({ from, to, action, content, sourceRepo, targetRepo, hopCount, chainId });
  res.json(analysis);
});

router.post("/bus/transfer", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const {
    sessionId,
    from,
    to,
    action,
    content,
    sourceMachineId,
    targetMachineId,
    sourceSessionId,
    targetSessionId,
    sourceRepo,
    targetRepo,
    hopCount,
    chainId,
  } = req.body as {
    sessionId?: string;
    from: PanelSlot;
    to: PanelSlot;
    action: AgentBusAction;
    content: string;
    sourceMachineId?: string | null;
    targetMachineId?: string | null;
    sourceSessionId?: string | null;
    targetSessionId?: string | null;
    sourceRepo?: string | null;
    targetRepo?: string | null;
    hopCount?: number;
    chainId?: string;
  };

  if (!sessionId || !from || !to || !action || !content) {
    res.status(400).json({ error: "Missing required fields: sessionId, from, to, action, content" });
    return;
  }

  const resolvedHopCount = Number.isFinite(hopCount) ? Math.max(0, Number(hopCount)) : 0;
  const resolvedChainId = chainId || `chain-${Date.now()}`;
  const analysis = buildAgentBusPrompt({ from, to, action, content, sourceRepo, targetRepo, hopCount: resolvedHopCount, chainId: resolvedChainId });
  const status = resolvedHopCount > 0 ? "loop_guarded" : action === "warn" ? "warning_received" : "review_pending";
  const metadata = {
    sourceMachineId: sourceMachineId || null,
    targetMachineId: targetMachineId || null,
    sourceSessionId: sourceSessionId || null,
    targetSessionId: targetSessionId || null,
    sourceRepo: sourceRepo || null,
    targetRepo: targetRepo || null,
  };

  const [event] = await db.insert(agentBusEvents).values({
    sessionId,
    userId,
    chainId: resolvedChainId,
    fromPanel: from,
    toPanel: to,
    action,
    status,
    hopCount: resolvedHopCount,
    warning: analysis.warning || null,
    prompt: analysis.prompt,
    content,
    metadata: JSON.stringify(metadata),
    updatedAt: new Date(),
  }).returning();

  res.json({
    id: event.id,
    createdAt: event.createdAt,
    from,
    to,
    action,
    content,
    sourceMachineId: sourceMachineId || null,
    targetMachineId: targetMachineId || null,
    sourceSessionId: sourceSessionId || null,
    targetSessionId: targetSessionId || null,
    sourceRepo: sourceRepo || null,
    targetRepo: targetRepo || null,
    hopCount: resolvedHopCount,
    chainId: resolvedChainId,
    prompt: analysis.prompt,
    warning: analysis.warning,
    status,
  });
});

// POST /api/agent/send — send message to OpenCode via adapter
router.get("/bus/:sessionId", async (req: Request, res: Response) => {
  const userId = String(req.user!.userId);
  const sessionId = String(req.params.sessionId);

  const rows = await db
    .select()
    .from(agentBusEvents)
    .where(and(eq(agentBusEvents.sessionId, sessionId), eq(agentBusEvents.userId, userId)))
    .orderBy(desc(agentBusEvents.createdAt));

  res.json(rows.map((row) => ({
    id: row.id,
    sessionId: row.sessionId,
    chainId: row.chainId,
    from: row.fromPanel,
    to: row.toPanel,
    action: row.action,
    status: row.status,
    hopCount: row.hopCount,
    warning: row.warning,
    prompt: row.prompt,
    content: row.content,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })));
});

router.post("/bus/:eventId/status", async (req: Request, res: Response) => {
  const userId = String(req.user!.userId);
  const eventId = String(req.params.eventId);
  const { status } = req.body as { status?: string };

  if (!status) {
    res.status(400).json({ error: "status required" });
    return;
  }

  const [updated] = await db
    .update(agentBusEvents)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(agentBusEvents.id, eventId), eq(agentBusEvents.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Bus event not found" });
    return;
  }

  res.json(updated);
});

router.post("/send", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { machineId, sessionId, text, message, mode, attachments, system } = req.body as {
    machineId: string;
    sessionId?: string;
    text?: string;
    message?: string;
    mode?: "sync" | "async";
    attachments?: AttachmentRef[];
    system?: string;
  };

  // Support both `text` and `message` field names
  const msgText = text || message;

  if (!machineId || !msgText) {
    res.status(400).json({ error: "Missing required fields: machineId, text/message" });
    return;
  }

  // Resolve attached files (images → base64 file parts, other → text note).
  const { engineAttachments, notes } = await resolveAttachments(attachments);
  let fullText =
    notes.length > 0 ? [msgText, ...notes].filter(Boolean).join("\n\n") : msgText;
  if (engineAttachments.length > 0) {
    console.log(
      `[agent:debug] machineId=${machineId} attachments=${attachments?.length ?? 0} imageParts=${engineAttachments.length}`
    );
  }

  // Every OpenCode-facing surface (Agent panel, Ask panel when bound to an
  // active runtime, GitHub-assisted turns, and remote/mobile PWA clients)
  // must go through this same server-side path so context sharing stays
  // consistent. Explicit workspace context prevents OpenCode from answering as
  // if it were in an empty directory, while the registry serializes workspace
  // preparation with any other active agent. This context is added to the
  // session's SYSTEM prompt (not the visible user message), so the role and
  // repo context stay active in the background without spamming the chat.
  let systemPrompt = system || "";
  if (isLocalMachineId(machineId)) {
    try {
      const workspace = await withSharedWorkspace(userId, async (context) => context, slotFromMachineId(machineId));
      const githubContext = [
        "[STRAXOR GITHUB CONTEXT]",
        `Active repository: ${workspace.repo}`,
        `Active branch: ${workspace.branch}`,
        `Workspace directory: ${workspace.dir}`,
        `Panel slot: ${slotFromMachineId(machineId)}`,
        `Workspace mode: ${workspace.readOnly ? "read-only" : "read-write"}`,
        "This context is shared across Straxor OpenCode agents and GitHub integration for the active panel.",
        "You are already running inside this workspace. Inspect its files before answering. Use this repository for all reads, edits, tests, and git operations; never use /tmp or another clone. Do not claim a repository is unavailable unless a tool call proves it.",
        "[/STRAXOR GITHUB CONTEXT]",
      ].join("\n");
      systemPrompt = systemPrompt ? `${githubContext}\n\n${systemPrompt}` : githubContext;
      console.log(`[agent:workspace] user=${userId} repo=${workspace.repo} branch=${workspace.branch}`);
    } catch {
      // No usable workspace (no active repo, or the repo token can't be
      // decrypted locally). The agent is a general-purpose chat too, so carry
      // on without the GitHub context instead of failing the whole turn.
      console.log(`[agent:workspace] user=${userId} — no workspace, running as general chat`);
    }
  }

  // Auto-create session if none provided
  let activeSessionId = sessionId;
  if (!activeSessionId) {
    try {
      const adapter = getAdapters().runtime(userId);
      const result = await adapter.createSession(machineId, "Straxor Session");
      activeSessionId = result.id;
    } catch (err) {
      console.log(`[agent:session] user=${userId} machineId=${machineId} error=${err instanceof Error ? err.message : err}`);
      res.status(500).json({ error: "Failed to create session" });
      return;
    }
  }

  try {
    const adapter = getAdapters().runtime(userId);

    // Emit session ID to client
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.write(`data: ${JSON.stringify({ type: "session", sessionId: activeSessionId })}\n\n`);

    // Subscribe before the prompt so the first tool call and its repo context
    // cannot be missed on a fast local OpenCode turn.
    const stream = await adapter.openEventStream(machineId);

    // Try async first (prompt_async)
    const effectiveMode = mode || "async";
    let result;
    try {
      result = await adapter.sendMessage(machineId, activeSessionId, fullText, effectiveMode, engineAttachments, systemPrompt);
    } catch {
      // prompt_async may not be supported, fall back to sync
      result = await adapter.sendMessage(machineId, activeSessionId, fullText, "sync", engineAttachments, systemPrompt);
    }

    // If we got parts back from sync, forward them as events
    if (result?.parts) {
      for (const part of result.parts as any[]) {
        if (part.type === "text" && part.text) {
          res.write(`data: ${JSON.stringify({ type: "text", content: part.text })}\n\n`);
        }
      }
    }

    let buffer = "";
    let sawDelta = false;
    let finished = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;

    // Guarded SSE write — never throws, silently no-ops once the response is gone.
    const send = (payload: unknown) => {
      if (finished || res.writableEnded || res.destroyed) return;
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {}
    };

    // Only react to events for OUR session. The shared /event stream emits
    // events for every session on the machine, so an unrelated session going
    // idle must not cut this response short.
    const isOurEvent = (event: unknown): boolean => {
      const sid = (event as any)?.properties?.sessionID;
      return !sid || sid === activeSessionId;
    };

    const finish = (opts: { flush?: boolean; abort?: boolean } = {}) => {
      if (finished) return;
      finished = true;

      const flush = opts.flush !== false;
      const abort = opts.abort === true;

      if (flush && buffer.trim()) {
        send({
          type: "text",
          content: `[partial data flushed: ${buffer.trim().slice(0, 200)}]`,
        });
      }

      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (heartbeat) clearInterval(heartbeat);

      // Abort the remote opencode process so it stops consuming resources —
      // only on interrupted flows (timeout, error, disconnect), never on clean idle.
      // Aborting an already-idle session is harmless (opencode errors are swallowed).
      if (abort) {
        adapter.abortSession(machineId, activeSessionId).catch(() => {});
      }

      try { stream.destroy(); } catch {}
      try {
        res.write("data: [DONE]\n\n");
        res.end();
      } catch {}
    };

    timeoutHandle = setTimeout(() => {
      send({ type: "error", content: "Connection timed out after 30 minutes" });
      finish({ abort: true });
    }, CONNECTION_TIMEOUT_MS);

    // SSE comment heartbeat — keeps the stream alive through proxies/load
    // balancers that close idle connections.
    heartbeat = setInterval(() => {
      if (finished || res.writableEnded || res.destroyed) return;
      try { res.write(": ping\n\n"); } catch {}
    }, 15_000);

    stream.on("data", (chunk: Buffer) => {
      if (finished) return;
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const data = trimmed.slice(6);
        try {
          const event = JSON.parse(data);
          const eventType = event.type || event.properties?.type;

          if (eventType === "session.error" && isOurEvent(event)) {
            const err =
              event.properties?.properties?.error ||
              event.properties?.error?.message ||
              event.properties?.error ||
              "Agent error";
            send({ type: "error", content: typeof err === "string" ? err : JSON.stringify(err) });
            finish({ abort: true });
            return;
          }

          // Current opencode (>=1.16): streaming text arrives as message.part.delta
          // with properties.{ field: "text", delta }. Send each chunk as-is.
          if (eventType === "message.part.delta") {
            if (!isOurEvent(event)) continue;
            const p = event.properties || {};
            if (p.field === "text" && typeof p.delta === "string" && p.delta.length > 0) {
              sawDelta = true;
              send({ type: "text", content: p.delta });
            }
            continue;
          }

          if (eventType === "message.part.updated" || eventType === "part.updated") {
            if (!isOurEvent(event)) continue;
            const part = event.properties?.part || event.properties?.properties;
            if (!part) continue;

            if (part?.type === "text" && part?.text) {
              // Full snapshot — only use as fallback when this session never
              // emitted a delta (older opencode versions stream via part.updated).
              if (!sawDelta) send({ type: "text", content: part.text });
            } else if (part?.type === "tool-call") {
              send({
                type: "tool_call",
                id: part.callID,
                name: part.state?.tool || part.name,
                args: part.state?.params,
              });
            } else if (part?.type === "tool-result") {
              send({
                type: "tool_result",
                id: part.callID,
                content: part.content,
              });
            } else if (part?.type === "tool") {
              // Current opencode (>=1.16): tool parts are `type: "tool"` with
              // state.status pending|running|completed|error, state.input args,
              // state.output result. Forward state transitions as call/result.
              const status = part.state?.status;
              if (status === "pending" || status === "running") {
                send({
                  type: "tool_call",
                  id: part.callID,
                  name: part.tool,
                  args: part.state?.input || {},
                });
              } else if (status === "completed" || status === "error") {
                send({
                  type: "tool_result",
                  id: part.callID,
                  result:
                    part.state?.output ||
                    part.state?.error ||
                    (status === "error" ? "Alat nije uspio" : ""),
                  status: status === "completed" ? "completed" : "error",
                });
              }
            }
          }

          // The engine emits exactly one session.idle per turn (after the
          // model finishes), so end the response on the first one for our session.
          if (eventType === "session.idle" && isOurEvent(event)) {
            finish({ flush: false });
            return;
          }
        } catch {}
      }
    });

    stream.on("error", () => finish({ abort: true }));
    stream.on("close", () => finish({ abort: true }));

    // Client disconnect → stop streaming and abort remote process
    req.on("close", () => {
      if (!finished) {
        finish({ abort: true });
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write(`data: ${JSON.stringify({ type: "error", content: message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// POST /api/agent/steer — send mid-task instruction to an active session
router.post("/steer", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const { machineId, sessionId, text, message } = req.body as {
    machineId: string;
    sessionId: string;
    text?: string;
    message?: string;
  };

  const msgText = text || message;

  if (!machineId || !sessionId || !msgText) {
    res.status(400).json({ error: "Missing required fields: machineId, sessionId, text/message" });
    return;
  }

  try {
    const adapter = getAdapters().runtime(userId);
    // Send as async — the response arrives on the existing event stream
    await adapter.sendMessage(machineId, sessionId, msgText, "async");
    res.json({ ok: true, sessionId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/agent/sessions/:machineId — list OpenCode sessions
router.get("/sessions/:machineId", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const machineId = req.params.machineId as string;

  try {
    const adapter = getAdapters().runtime(userId);
    const sessions = await adapter.listSessions(machineId);
    res.json(sessions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/agent/todos/:machineId/:sessionId — get session todos
router.get("/todos/:machineId/:sessionId", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const machineId = req.params.machineId as string;
  const sessionId = req.params.sessionId as string;

  try {
    const adapter = getAdapters().runtime(userId);
    const todos = await adapter.getTodos(machineId, sessionId);
    res.json(todos);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/agent/diff/:machineId/:sessionId — get session file changes
router.get("/diff/:machineId/:sessionId", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const machineId = req.params.machineId as string;
  const sessionId = req.params.sessionId as string;

  try {
    const adapter = getAdapters().runtime(userId);
    const diff = await adapter.getDiff(machineId, sessionId);
    res.json(diff);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/agent/approve — approve selected file changes
router.post("/approve", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const { machineId, sessionId, paths } = req.body as {
    machineId: string;
    sessionId: string;
    paths: string[];
  };

  if (!machineId || !sessionId || !paths?.length) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const adapter = getAdapters().runtime(userId);
    // Send approval message to agent session
    const message = `Korisnik je odobrio promjene na datotekama: ${paths.join(", ")}. Nastavi.`;
    await adapter.sendMessage(machineId, sessionId, message, "async");
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/agent/reject — reject selected file changes
router.post("/reject", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const { machineId, sessionId, paths } = req.body as {
    machineId: string;
    sessionId: string;
    paths: string[];
  };

  if (!machineId || !sessionId || !paths?.length) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const adapter = getAdapters().runtime(userId);
    // Send rejection message — ask agent to revert
    const message = `Korisnik je ODBIO promjene na datotekama: ${paths.join(", ")}. Vrati te promjene.`;
    await adapter.sendMessage(machineId, sessionId, message, "async");
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/agent/file/:machineId/:sessionId/:path — get file content (before/after)
router.get("/file/:machineId/:sessionId/:encodedPath", async (req: Request, res: Response) => {
  const userId = req.user!.userId as string;
  const machineId = req.params.machineId as string;
  const path = decodeURIComponent(req.params.encodedPath as string);
  const side = (req.query.side as string) || "after";

  // The runtime executes these commands in the active workspace. Keep the
  // requested path repository-relative so it cannot escape that workspace or
  // become shell syntax.
  if (
    !path ||
    path.includes("\0") ||
    path.split(/[\\/]+/).includes("..") ||
    !/^[A-Za-z0-9._/@%+=, -]+$/.test(path)
  ) {
    res.status(400).json({ error: "Invalid repository-relative path" });
    return;
  }

  try {
    const adapter = getAdapters().runtime(userId);
    // Execute git show or cat to get file content
    let command: string;
    if (side === "before") {
      // Get file content before agent changes — use git show HEAD:path
      command = `git show HEAD:${JSON.stringify(path)} 2>/dev/null || echo ""`;
    } else {
      // Get current file content
      command = `cat -- ${JSON.stringify(path)} 2>/dev/null || echo ""`;
    }

    const result = await adapter.executeCommand(machineId, command);
    res.json({ content: result });
  } catch (error) {
    // Fallback — return empty content
    res.json({ content: "" });
  }
});

// ---------------------------------------------------------------------------
// FAZA 6: Background execution.
// The agent already runs server-side (opencode serve). "Radi u pozadini" lets
// mobile clients start a turn without holding an SSE connection open: we fire
// the message async in the background, persist real-time progress in an
// in-memory job, and the client polls GET /api/agent/background/:jobId.
// ---------------------------------------------------------------------------

interface BackgroundJob {
  id: string;
  userId: string;
  machineId: string;
  sessionId: string;
  timeline: BackgroundTimelineEntry[];
  status: "running" | "done" | "error";
  error?: string;
  finished: boolean;
}

interface BackgroundTimelineEntry {
  t: string; // message type forwarded to client (text/tool_call/...)
  content?: string;
  toolId?: string;
  toolName?: string;
  toolStatus?: "running" | "completed" | "error";
}

const backgroundJobs = new Map<string, BackgroundJob>();

// POST /api/agent/background — start the agent fire-and-forget. Returns the
// job id immediately; status is polled via GET /:id. Works on mobile even when
// the tab is backgrounded because the work happens entirely server-side.
router.post("/background", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { machineId, message, text, sessionId, attachments, system } = req.body as {
    machineId: string;
    sessionId?: string;
    message?: string;
    text?: string;
    attachments?: AttachmentRef[];
    system?: string;
  };

  const msgText = message || text;
  if (!machineId || !msgText) {
    res.status(400).json({ error: "Missing required fields: machineId, message/text" });
    return;
  }

  let job: BackgroundJob;
  try {
    const adapter = getAdapters().runtime(userId);

    // Auto-create session if none provided.
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const created = await adapter.createSession(machineId, "Straxor Session");
      activeSessionId = created.id;
    }

    const { engineAttachments, notes } = await resolveAttachments(attachments);
    const fullText =
      notes.length > 0 ? [msgText, ...notes].filter(Boolean).join("\n\n") : msgText;

    // Same workspace-context-as-system-prompt behavior as the /send route.
    let systemPrompt = system || "";
    if (isLocalMachineId(machineId)) {
      try {
        const workspace = await withSharedWorkspace(userId, async (context) => context, slotFromMachineId(machineId));
        const githubContext = [
          "[STRAXOR GITHUB CONTEXT]",
          `Active repository: ${workspace.repo}`,
          `Active branch: ${workspace.branch}`,
          `Workspace directory: ${workspace.dir}`,
          `Panel slot: ${slotFromMachineId(machineId)}`,
          `Workspace mode: ${workspace.readOnly ? "read-only" : "read-write"}`,
          "This context is shared across Straxor OpenCode agents and GitHub integration for the active panel.",
          "You are already running inside this workspace. Inspect its files before answering. Use this repository for all reads, edits, tests, and git operations; never use /tmp or another clone. Do not claim a repository is unavailable unless a tool call proves it.",
          "[/STRAXOR GITHUB CONTEXT]",
        ].join("\n");
        systemPrompt = systemPrompt ? `${githubContext}\n\n${systemPrompt}` : githubContext;
      } catch {
        // No workspace — run as general chat.
      }
    }

    job = {
      id: `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      machineId,
      sessionId: activeSessionId,
      timeline: [],
      status: "running",
      finished: false,
    };
    backgroundJobs.set(job.id, job);

    res.json({ jobId: job.id, sessionId: activeSessionId, status: "running" });

    // Fire-and-forget: run the send + event stream detached from the request.
    runBackground(job.id, adapter, activeSessionId, fullText, engineAttachments, systemPrompt).catch(() => {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

async function runBackground(
  jobId: string,
  adapter: any,
  sessionId: string,
  fullText: string,
  engineAttachments: unknown[],
  systemPrompt?: string
): Promise<void> {
  const job = backgroundJobs.get(jobId);
  if (!job) return;
  const { machineId } = job;

  try {
    // Send async first, fall back to sync if unsupported.
    let result;
    try {
      result = await adapter.sendMessage(machineId, sessionId, fullText, "async", engineAttachments, systemPrompt);
    } catch {
      result = await adapter.sendMessage(machineId, sessionId, fullText, "sync", engineAttachments, systemPrompt);
    }
    if (result?.parts) {
      for (const part of result.parts as any[]) {
        if (part.type === "text" && part.text) job.timeline.push({ t: "text", content: part.text });
      }
    }

    // Watch the event stream to capture real-time progress until the session
    // goes idle. Reuses the same parsing as the SSE /send route.
    const stream = await adapter.openEventStream(machineId);
    let buffer = "";
    let sawDelta = false;
    let finished = false;

    const ourSession = (event: unknown): boolean => {
      const sid = (event as any)?.properties?.sessionID;
      return !sid || sid === sessionId;
    };

    const setDone = () => {
      if (finished) return;
      finished = true;
      job.finished = true;
      job.status = job.timeline.some((e) => e.t === "error") ? "error" : "done";
      try { stream.destroy(); } catch {}
    };

    stream.on("data", (chunk: Buffer) => {
      if (finished) return;
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        try {
          const event = JSON.parse(data);
          const eventType = event.type || event.properties?.type;

          if (eventType === "session.error" && ourSession(event)) {
            const err =
              event.properties?.properties?.error ||
              event.properties?.error?.message ||
              event.properties?.error ||
              "Agent error";
            job.timeline.push({
              t: "error",
              content: typeof err === "string" ? err : JSON.stringify(err),
            });
            job.error = typeof err === "string" ? err : JSON.stringify(err);
            setDone();
            return;
          }

          if (eventType === "message.part.delta") {
            if (!ourSession(event)) continue;
            const p = event.properties || {};
            if (p.field === "text" && typeof p.delta === "string" && p.delta.length > 0) {
              sawDelta = true;
              job.timeline.push({ t: "text", content: p.delta });
            }
            continue;
          }

          if (eventType === "message.part.updated" || eventType === "part.updated") {
            if (!ourSession(event)) continue;
            const part = event.properties?.part || event.properties?.properties;
            if (!part) continue;
            if (part?.type === "text" && part?.text && !sawDelta) {
              job.timeline.push({ t: "text", content: part.text });
            } else if (part?.type === "tool-call") {
              job.timeline.push({
                t: "tool_call",
                toolId: part.callID,
                toolName: part.state?.tool || part.name,
                content: typeof part.state?.params === "string" ? part.state.params : JSON.stringify(part.state?.params || {}),
              });
            } else if (part?.type === "tool-result") {
              job.timeline.push({ t: "tool_result", toolId: part.callID, content: part.content });
            } else if (part?.type === "tool") {
              const status = part.state?.status;
              job.timeline.push({
                t: status === "pending" || status === "running" ? "tool_call" : "tool_result",
                toolId: part.callID,
                toolName: status === "pending" || status === "running" ? part.tool : undefined,
                toolStatus: status,
                content:
                  status === "completed"
                    ? part.state?.output || ""
                    : status === "error"
                    ? part.state?.error || "Alat nije uspio"
                    : typeof part.state?.input === "string"
                    ? part.state.input
                    : JSON.stringify(part.state?.input || {}),
              });
            }
            continue;
          }

          if (eventType === "session.idle" && ourSession(event)) {
            setDone();
            return;
          }
        } catch {}
      }
    });

    stream.on("error", () => setDone());
    stream.on("close", () => setDone());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    job.timeline.push({ t: "error", content: message });
    job.error = message;
    job.finished = true;
    job.status = "error";
  }
}

// GET /api/agent/background/:jobId — poll progress of a background job.
router.get("/background/:jobId", (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const jobId = req.params.jobId as string;
  const job = backgroundJobs.get(jobId);
  if (!job || job.userId !== userId) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({
    jobId: job.id,
    sessionId: job.sessionId,
    status: job.status,
    error: job.error,
    finished: job.finished,
    timeline: job.timeline,
  });
});

export default router;
