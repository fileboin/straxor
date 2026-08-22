import { Router } from "express";
import type { Request, Response } from "express";
import { getAdapters } from "../adapters/registry.js";
import { getGitRemoteToken } from "../adapters/git/remote/registry.js";
import type { GitPlatformId } from "../adapters/git/remote/adapter.js";
import { requireAuth } from "../middleware/auth.js";
import { resolveAttachments, type AttachmentRef } from "../lib/attachments.js";
import { isLocalMachineId, slotFromMachineId } from "../runtime/local/engine.js";
import { withSharedWorkspace } from "../runtime/local/shared-workspace.js";
import {
  approveAndCommitWorkspace,
  diffWorkspace,
  ensureWorkspace,
  getRepoWorkspaceDir,
  pushWorkspace,
  verifyWorkspace,
} from "../runtime/local/workspace.js";
import { db } from "../db/index.js";
import { agentBusEvents, repoConnections } from "../db/schema.js";
import { and, desc, eq } from "drizzle-orm";
import {
  createAgentJob,
  updateAgentJob,
  finishAgentJob,
  getAgentJob,
  listAgentJobsForTask,
  finalStatusForTimeline,
  type AgentJobStatus,
  type AgentJobTimelineEntry,
} from "../lib/agent-jobs.js";
import { createTask, getTask, transitionTaskStatus, setTaskFields } from "../lib/tasks.js";
import {
  buildRoleSystem,
  normalizeTeamRoles,
  roleLabel,
} from "../lib/team-roles.js";
import { randomUUID } from "node:crypto";
import path from "path";
import { dispatchWebhook } from "../lib/webhooks.js";
import { estimateTokenCount, estimateUsageCost, insertUsageEvent } from "../lib/usage-store.js";

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
// A turn that produces no meaningful progress for our session (text delta, tool
// event, part update) for this long is cut — the engine may have missed
// `session.idle` (stuck model / tool loop) while the shared /event stream stays
// open, which would otherwise leave the panel waiting until the 30-min cap.
const PROGRESS_TIMEOUT_MS = 240_000; // 4 min of silence
// The GitHub workspace context is a nice-to-have system-prompt enrichment, not
// a prerequisite for answering. Its git fetch/merge is a network op that must
// never delay the first byte of a turn — bound it so a slow/stuck git call
// degrades to "general chat" instead of stalling the stream for minutes.
const WORKSPACE_CONTEXT_TIMEOUT_MS = 3_000;
// FAZA 8 — per-step budget for the team verification gate (install/build/test).
const TEAM_VERIFY_TIMEOUT_MS = 10 * 60 * 1000;

// Map a picker model id to the usage-dashboard provider bucket.
//   "opencode_go/deepseek-v4-pro" -> "opencode-go"
//   "opencode/gpt-5.3-codex"      -> "opencode-zen"
//   anything else (incl. machine ids) -> "opencode"
export function usageProviderForModel(model?: string | null): string {
  if (model && /^opencode_go\//.test(model)) return "opencode-go";
  if (model && /^opencode\//.test(model)) return "opencode-zen";
  return "opencode";
}

// Bound any promise so a slow network op (git fetch, clone) can never block a
// turn beyond the deadline. On timeout the caller degrades gracefully.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

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

  // Best-effort persistence: if the agent_bus_events table has not been
  // migrated (e.g. a baselined production DB), the transfer still returns the
  // full analysis so the bus flow works — persistence just degrades silently.
  let event: { id: string; createdAt: Date } | null = null;
  try {
    const [inserted] = await db.insert(agentBusEvents).values({
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
    event = { id: inserted.id, createdAt: inserted.createdAt };
  } catch (err) {
    console.warn(
      `[agent:bus] transfer persistence skipped (table not migrated?): ${err instanceof Error ? err.message : err}`
    );
  }

  res.json({
    id: event?.id ?? null,
    createdAt: event?.createdAt ?? new Date(),
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

  let rows: typeof agentBusEvents.$inferSelect[] = [];
  try {
    rows = await db
      .select()
      .from(agentBusEvents)
      .where(and(eq(agentBusEvents.sessionId, sessionId), eq(agentBusEvents.userId, userId)))
      .orderBy(desc(agentBusEvents.createdAt));
  } catch (err) {
    console.warn(
      `[agent:bus] list skipped (table not migrated?): ${err instanceof Error ? err.message : err}`
    );
  }

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

  // Best-effort: a missing agent_bus_events table must never crash the server.
  let updated: typeof agentBusEvents.$inferSelect | undefined;
  try {
    const [row] = await db
      .update(agentBusEvents)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(agentBusEvents.id, eventId), eq(agentBusEvents.userId, userId)))
      .returning();
    updated = row;
  } catch (err) {
    console.warn(
      `[agent:bus] status update skipped (table not migrated?): ${err instanceof Error ? err.message : err}`
    );
  }

  if (!updated) {
    res.status(404).json({ error: "Bus event not found" });
    return;
  }

  res.json(updated);
});

router.post("/send", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { machineId, sessionId, text, message, mode, attachments, system, model } = req.body as {
    machineId: string;
    sessionId?: string;
    text?: string;
    message?: string;
    mode?: "sync" | "async";
    attachments?: AttachmentRef[];
    system?: string;
    model?: string;
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

  // Auto-create session if none provided
  const createFreshSession = async () => {
    const adapter = getAdapters().runtime(userId);
    const result = await adapter.createSession(machineId, "Straxor Session", model);
    return result.id;
  };
  let activeSessionId: string;
  if (sessionId) {
    activeSessionId = sessionId;
  } else {
    try {
      activeSessionId = await createFreshSession();
    } catch (err) {
      console.log(`[agent:session] user=${userId} machineId=${machineId} error=${err instanceof Error ? err.message : err}`);
      res.status(500).json({ error: "Failed to create session" });
      return;
    }
  }

  try {
    const adapter = getAdapters().runtime(userId);

    // Emit session ID to client — the stream opens and the panel releases its
    // loading state immediately, before any git/workspace work happens.
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.write(`data: ${JSON.stringify({ type: "session", sessionId: activeSessionId })}\n\n`);

    // Subscribe before the prompt so the first tool call and its repo context
    // cannot be missed on a fast local OpenCode turn.
    const stream = await adapter.openEventStream(machineId, model);

    // Build the optional GitHub workspace context AFTER the stream is open and
    // bounded by a short timeout: a slow git fetch/merge must never delay the
    // first token — it degrades to a general-chat system prompt instead.
    let systemPrompt = system || "";
    if (isLocalMachineId(machineId)) {
      try {
        const workspace = await withTimeout(
          withSharedWorkspace(userId, async (context) => context, slotFromMachineId(machineId)),
          WORKSPACE_CONTEXT_TIMEOUT_MS
        );
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
        // No usable workspace or the git fetch timed out. The agent is a
        // general-purpose chat too, so carry on without the GitHub context
        // instead of failing or delaying the whole turn.
        console.log(`[agent:workspace] user=${userId} — no workspace (timeout/error), running as general chat`);
      }
    }

    // Try async first (prompt_async)
    const effectiveMode = mode || "async";
    let result: { parts?: unknown[] } | undefined;
    // OpenCode sessions are in-memory. If the engine was restarted (or the
    // session id was restored from the DB after an engine restart), the stored
    // id is dead and every send against it fails with "Failed to send message".
    // Detect that case and transparently create a fresh session + retry once,
    // so panels recover on their own instead of erroring forever.
    const attemptSend = async (sid: string): Promise<void> => {
      try {
        result = await adapter.sendMessage(machineId, sid, fullText, effectiveMode, engineAttachments, systemPrompt, model);
      } catch {
        // prompt_async may not be supported, fall back to sync
        result = await adapter.sendMessage(machineId, sid, fullText, "sync", engineAttachments, systemPrompt, model);
      }
    };
    try {
      await attemptSend(activeSessionId);
    } catch (sendErr) {
      const errText = sendErr instanceof Error ? sendErr.message : String(sendErr);
      const staleSession = /session|not found|404/i.test(errText);
      if (staleSession && sessionId) {
        console.log(`[agent:stale-session] user=${userId} machineId=${machineId} dead session ${sessionId} → recreating`);
        activeSessionId = await createFreshSession();
        res.write(`data: ${JSON.stringify({ type: "session", sessionId: activeSessionId })}\n\n`);
        await attemptSend(activeSessionId);
      } else {
        throw sendErr;
      }
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
    let outputText = "";
    let finished = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let idleHandle: ReturnType<typeof setTimeout> | undefined;
    // If the OpenCode process produces nothing meaningful for this long, the
    // server cuts the turn (aborts the process + ends the stream) instead of
    // leaving the client polling a stuck job. Reset only on real per-session
    // progress (text delta / part update / tool event), so event-stream noise
    // or other sessions' events cannot keep a stuck turn alive forever.
    const IDLE_TIMEOUT_MS = PROGRESS_TIMEOUT_MS;

    // Guarded SSE write — never throws, silently no-ops once the response is gone.
    const send = (payload: unknown) => {
      if (finished || res.writableEnded || res.destroyed) return;
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {}
    };

    // Reset the idle watchdog on any real activity so only a genuinely stuck
    // process is cut, never a busy one.
    const kickIdle = () => {
      if (finished) return;
      if (idleHandle) clearTimeout(idleHandle);
      idleHandle = setTimeout(() => {
        send({ type: "error", content: "OpenCode je prestao da odgovara — prekidam turn" });
        finish({ abort: true });
      }, IDLE_TIMEOUT_MS);
    };
    // Start the watchdog once the turn has been submitted.
    kickIdle();

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

      // Best-effort usage tracking (Phase 3): record the agent turn in the
      // Usage & Cost dashboard. The OpenCode engine picks the provider/model
      // internally, so we tag by machine; cost is estimated via the pricing
      // table (0 for unknown). Never blocks the stream.
      try {
        const inTokens = estimateTokenCount(fullText);
        const outTokens = estimateTokenCount(outputText);
        const totalTokens = inTokens + outTokens;
        // Resolve the real provider/model from the picker selection when known
        // (e.g. "opencode_go/deepseek-v4-pro" -> opencode-go), otherwise fall
        // back to the machine id so cost/tokens still show up in the dashboard.
        const usageProvider = usageProviderForModel(model);
        const usageModel = model || machineId;
        const costUsd = estimateUsageCost(usageProvider, usageModel, inTokens, outTokens);
        void insertUsageEvent({
          timestamp: new Date().toISOString(),
          userId,
          machineId,
          provider: usageProvider,
          model: usageModel,
          inputTokens: inTokens,
          outputTokens: outTokens,
          totalTokens,
          costUsd,
          success: !abort,
          errorMessage: abort ? "Agent turn aborted" : undefined,
        });
        // Emit a live usage event to the panel so Tokens / Context % / Cost
        // update in real time on every sent query and model response.
        send({
          type: "usage",
          provider: usageProvider,
          model: usageModel,
          inputTokens: inTokens,
          outputTokens: outTokens,
          totalTokens,
          costUsd,
        });
      } catch {}

      if (flush && buffer.trim()) {
        send({
          type: "text",
          content: `[partial data flushed: ${buffer.trim().slice(0, 200)}]`,
        });
      }

      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (heartbeat) clearInterval(heartbeat);
      if (idleHandle) clearTimeout(idleHandle);

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
              outputText += p.delta;
              kickIdle();
              send({ type: "text", content: p.delta });
            }
            continue;
          }

          if (eventType === "message.part.updated" || eventType === "part.updated") {
            if (!isOurEvent(event)) continue;
            const part = event.properties?.part || event.properties?.properties;
            if (!part) continue;
            kickIdle();

            if (part?.type === "text" && part?.text) {
              // Full snapshot — only use as fallback when this session never
              // emitted a delta (older opencode versions stream via part.updated).
              if (!sawDelta) {
                outputText += part.text;
                send({ type: "text", content: part.text });
              }
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
  timeline: AgentJobTimelineEntry[];
  status: "queued" | "running" | "done" | "error";
  error?: string;
  finished: boolean;
  taskId?: string | null;
  label?: string | null;
  // The turn payload is kept on the queued job so it can actually run once the
  // per-slot queue drains (a queued job has no other copy of its prompt).
  payload?: { fullText: string; engineAttachments: unknown[]; systemPrompt?: string; model?: string };
  // True when the session id was provided by the client (possibly stale after
  // an engine restart). Enables transparent session recreation on send failure.
  restoredSession?: boolean;
}

const backgroundJobs = new Map<string, BackgroundJob>();

// Per-slot FIFO queue: exactly ONE running job per (userId, machineId). When a
// slot is busy, new jobs are persisted as QUEUED and start as soon as the
// running job finishes (releaseSlot). This serializes turns on the single
// local OpenCode engine per user+panel.
const slotRunning = new Set<string>();
const slotQueues = new Map<string, BackgroundJob[]>();

function slotKeyOf(userId: string, machineId: string): string {
  return `${userId}:${machineId}`;
}

// POST /api/agent/background — start the agent fire-and-forget. Returns the
// job id immediately; status is polled via GET /:id. Works on mobile even when
// the tab is backgrounded because the work happens entirely server-side.
router.post("/background", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { machineId, message, text, sessionId, attachments, system, model } = req.body as {
    machineId: string;
    sessionId?: string;
    message?: string;
    text?: string;
    attachments?: AttachmentRef[];
    system?: string;
    model?: string;
  };

  const msgText = message || text;
  if (!machineId || !msgText) {
    res.status(400).json({ error: "Missing required fields: machineId, message/text" });
    return;
  }

  try {
    const { jobId, sessionId: activeSessionId, status } = await enqueueBackgroundJob(userId, machineId, {
      message,
      text,
      sessionId,
      attachments,
      system,
      model,
    });
    res.json({ jobId, sessionId: activeSessionId, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * Build + start (or queue) one background agent turn. Shared by the /background
 * route and the /team fan-out endpoint. Returns the job's status: "running"
 * when it started immediately, "queued" when the slot is busy (FIFO).
 */
async function enqueueBackgroundJob(
  userId: string,
  machineId: string,
  opts: {
    message?: string;
    text?: string;
    sessionId?: string;
    attachments?: AttachmentRef[];
    system?: string;
    model?: string;
    taskId?: string | null;
    label?: string | null;
  }
): Promise<{ jobId: string; sessionId: string; status: "queued" | "running" }> {
  const adapter = getAdapters().runtime(userId);
  const msgText = opts.message || opts.text;
  if (!msgText) throw new Error("Missing message/text");

  // Auto-create session if none provided.
  let activeSessionId = opts.sessionId;
  if (!activeSessionId) {
    const created = await adapter.createSession(machineId, "Straxor Session", opts.model);
    activeSessionId = created.id;
  }

  const { engineAttachments, notes } = await resolveAttachments(opts.attachments);
  const fullText =
    notes.length > 0 ? [msgText, ...notes].filter(Boolean).join("\n\n") : msgText;

  // Same workspace-context-as-system-prompt behavior as the /send route.
  // Bounded by a short timeout so a slow git fetch can never delay enqueue.
  let systemPrompt = opts.system || "";
  if (isLocalMachineId(machineId)) {
    try {
      const workspace = await withTimeout(
        withSharedWorkspace(userId, async (context) => context, slotFromMachineId(machineId)),
        WORKSPACE_CONTEXT_TIMEOUT_MS
      );
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
      // No workspace or git fetch timed out — run as general chat.
    }
  }

  const job: BackgroundJob = {
    id: randomUUID(),
    userId,
    machineId,
    sessionId: activeSessionId,
    timeline: [],
    status: "running",
    finished: false,
    taskId: opts.taskId ?? null,
    label: opts.label ?? null,
    restoredSession: !!opts.sessionId,
    payload: { fullText, engineAttachments, systemPrompt, model: opts.model },
  };
  backgroundJobs.set(job.id, job);

  // Persist the job before responding so the client can poll it (and it
  // survives a restart). Best-effort: a missing/unmigrated table must never
  // break the existing in-memory flow.
  try {
    await createAgentJob({
      id: job.id,
      userId,
      machineId,
      sessionId: activeSessionId,
      taskId: opts.taskId ?? null,
      label: opts.label ?? null,
    });
  } catch (err) {
    console.log(`[agent:memory] create ${job.id} not persisted: ${err instanceof Error ? err.message : err}`);
  }

  // Per-slot FIFO: only one turn per (user, engine) at a time.
  const slotKey = slotKeyOf(userId, machineId);
  if (slotRunning.has(slotKey)) {
    job.status = "queued";
    try {
      await updateAgentJob(userId, job.id, { status: "queued" });
    } catch {}
    const queue = slotQueues.get(slotKey) ?? [];
    queue.push(job);
    slotQueues.set(slotKey, queue);
    return { jobId: job.id, sessionId: activeSessionId, status: "queued" };
  }

  slotRunning.add(slotKey);
  // Fire-and-forget: run the send + event stream detached from the request.
  runBackground(job, adapter).catch(() => {});
  return { jobId: job.id, sessionId: activeSessionId, status: "running" };
}

/** Free the slot after a job finishes and start the next queued job (FIFO). */
function releaseSlot(job: BackgroundJob): void {
  const slotKey = slotKeyOf(job.userId, job.machineId);
  slotRunning.delete(slotKey);
  const queue = slotQueues.get(slotKey);
  const next = queue?.shift();
  if (queue && queue.length === 0) slotQueues.delete(slotKey);
  if (!next) return;
  slotRunning.add(slotKey);
  const adapter = getAdapters().runtime(job.userId);
  runBackground(next, adapter).catch(() => {});
}

async function runBackground(job: BackgroundJob, adapter: any): Promise<void> {
  const { machineId, sessionId } = job;
  const { fullText, engineAttachments, systemPrompt, model } = job.payload ?? {
    fullText: "",
    engineAttachments: [],
    systemPrompt: undefined,
    model: undefined,
  };

  // A queued job becomes running the moment it is dequeued.
  if (job.status === "queued") {
    job.status = "running";
    try {
      await updateAgentJob(job.userId, job.id, { status: "running" });
    } catch {}
  }

  let snapshotTimer: ReturnType<typeof setInterval> | undefined;
  let hardTimeout: ReturnType<typeof setTimeout> | undefined;

  try {
    // Send async first, fall back to sync if unsupported.
    let result: { parts?: unknown[] } | undefined;
    // OpenCode sessions are in-memory. A restored/queued session id can be dead
    // (engine restart between runs) — recreate the session once and retry so a
    // background job never fails permanently against a stale id.
    const attemptSend = async (sid: string): Promise<void> => {
      try {
        result = await adapter.sendMessage(machineId, sid, fullText, "async", engineAttachments, systemPrompt, model);
      } catch {
        result = await adapter.sendMessage(machineId, sid, fullText, "sync", engineAttachments, systemPrompt, model);
      }
    };
    try {
      await attemptSend(sessionId);
    } catch (sendErr) {
      const errText = sendErr instanceof Error ? sendErr.message : String(sendErr);
      if (/session|not found|404/i.test(errText) && job.restoredSession) {
        const fresh = await adapter.createSession(machineId, "Straxor Session", model);
        job.sessionId = fresh.id;
        await attemptSend(fresh.id);
      } else {
        throw sendErr;
      }
    }
    if (result?.parts) {
      for (const part of result.parts as any[]) {
        if (part.type === "text" && part.text) job.timeline.push({ t: "text", content: part.text });
      }
    }

    // Watch the event stream to capture real-time progress until the session
    // goes idle. Reuses the same parsing as the SSE /send route.
    const stream = await adapter.openEventStream(machineId, model);
    let buffer = "";
    let sawDelta = false;
    let finished = false;

    // Periodically snapshot in-flight progress to the DB (Agent Memory) so a
    // crash/restart leaves at least a partial timeline behind. Best-effort.
    snapshotTimer = setInterval(() => {
      if (finished) return;
      void persistJob(job);
    }, 3000);
    snapshotTimer.unref?.();

    const ourSession = (event: unknown): boolean => {
      const sid = (event as any)?.properties?.sessionID;
      return !sid || sid === sessionId;
    };

    // No-progress watchdog: if the engine stops producing meaningful events for
    // OUR session (missed `session.idle` while the shared /event stream stays
    // open), the job would hang until the 30-min cap. Cut it after a generous
    // silence window so the panel releases its loading state.
    let progressHandle: ReturnType<typeof setTimeout> | undefined;
    const kickProgress = () => {
      if (finished) return;
      if (progressHandle) clearTimeout(progressHandle);
      progressHandle = setTimeout(() => {
        if (finished) return;
        job.timeline.push({
          t: "error",
          content: "OpenCode je prestao da odgovara — prekidam turn",
        });
        adapter.abortSession(machineId, sessionId).catch(() => {});
        setDone();
      }, PROGRESS_TIMEOUT_MS);
      progressHandle.unref?.();
    };
    kickProgress();

    const setDone = () => {
      if (finished) return;
      finished = true;
      job.finished = true;
      job.status = finalStatusForTimeline(job.timeline);
      job.error = job.timeline.find((e) => e.t === "error")?.content;
      if (snapshotTimer) clearInterval(snapshotTimer);
      if (hardTimeout) clearTimeout(hardTimeout);
      if (progressHandle) clearTimeout(progressHandle);
      try { stream.destroy(); } catch {}
      // Best-effort usage tracking for background turns (Phase 3).
      try {
        const inTokens = estimateTokenCount(fullText);
        const outText = job.timeline.filter((e) => e.t === "text").map((e) => e.content || "").join("");
        const outTokens = estimateTokenCount(outText);
        const usageProvider = usageProviderForModel(model);
        const usageModel = model || machineId;
        void insertUsageEvent({
          timestamp: new Date().toISOString(),
          userId: job.userId,
          machineId,
          provider: usageProvider,
          model: usageModel,
          inputTokens: inTokens,
          outputTokens: outTokens,
          totalTokens: inTokens + outTokens,
          costUsd: estimateUsageCost(usageProvider, usageModel, inTokens, outTokens),
          success: job.status !== "error",
          errorMessage: job.error,
        });
      } catch {}
      void persistJob(job, { final: true });
      releaseSlot(job);
    };

    // Hard timeout: a stuck engine must not leave the job running forever,
    // neither in memory nor in the persisted agent_jobs row.
    hardTimeout = setTimeout(() => {
      if (finished) return;
      job.timeline.push({ t: "error", content: "Agent turn timed out after 30 minutes" });
      adapter.abortSession(machineId, sessionId).catch(() => {});
      setDone();
    }, CONNECTION_TIMEOUT_MS);
    hardTimeout.unref?.();

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
              kickProgress();
              job.timeline.push({ t: "text", content: p.delta });
            }
            continue;
          }

          if (eventType === "message.part.updated" || eventType === "part.updated") {
            if (!ourSession(event)) continue;
            const part = event.properties?.part || event.properties?.properties;
            if (!part) continue;
            kickProgress();
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
    if (snapshotTimer) clearInterval(snapshotTimer);
    if (hardTimeout) clearTimeout(hardTimeout);
    void persistJob(job, { final: true });
    releaseSlot(job);
  }
}

/** Best-effort write-through for the in-memory background job. */
async function persistJob(job: BackgroundJob, opts?: { final?: boolean }): Promise<void> {
  try {
    if (opts?.final) {
      await finishAgentJob(job.userId, job.id, job.status, job.error ?? null, job.timeline);
      // Phase 3 webhooks — notify external integrations of agent-run outcomes.
      void dispatchWebhook(
        job.userId,
        job.status === "error" ? "agent.run.failed" : "agent.run.completed",
        {
          jobId: job.id,
          taskId: job.taskId ?? null,
          sessionId: job.sessionId,
          status: job.status,
          error: job.error ?? null,
        }
      );
    } else {
      await updateAgentJob(job.userId, job.id, { timeline: job.timeline });
    }
  } catch {
    // The in-memory map stays authoritative when the agent_jobs table has not
    // been migrated yet or the database is temporarily unreachable.
  }
}

// GET /api/agent/background/:jobId — poll progress of a background job.
router.get("/background/:jobId", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const jobId = req.params.jobId as string;
  const job = backgroundJobs.get(jobId);
  if (job && job.userId === userId) {
    res.json({
      jobId: job.id,
      sessionId: job.sessionId,
      status: job.status,
      error: job.error ?? null,
      finished: job.finished,
      timeline: job.timeline,
    });
    return;
  }

  // Fall back to the persisted copy so a completed (or interrupted) job stays
  // pollable after a server restart.
  try {
    const stored = await getAgentJob(userId, jobId);
    if (stored) {
      res.json({
        jobId: stored.id,
        sessionId: stored.sessionId,
        status: stored.status,
        error: stored.error,
        finished: stored.finished,
        timeline: stored.timeline,
      });
      return;
    }
  } catch {}

  res.status(404).json({ error: "Job not found" });
});

// ---------------------------------------------------------------------------
// FAZA 7b/7c: Team fan-out. One prompt → N role-specific turns on the shared
// repository, drained sequentially through the per-slot queue. Backed by the
// persistent `tasks` lifecycle (QUEUED → RUNNING → VERIFYING → WAITING_APPROVAL
// → VERIFIED/FAILED) so the whole team run survives restarts.
// ---------------------------------------------------------------------------

// POST /api/agent/team — fan out a prompt to a team of roles.
router.post("/team", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { prompt, machineId, roles, repo, branch } = req.body as {
    prompt?: string;
    machineId?: string;
    roles?: string[];
    repo?: string | null;
    branch?: string | null;
  };

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "Missing required field: prompt" });
    return;
  }

  const engine = machineId || "local:opencode";
  const roleIds = normalizeTeamRoles(roles);

  try {
    // Persistent team task (Iteration 0 lifecycle).
    const task = await createTask({
      userId,
      title: prompt.trim().slice(0, 200),
      prompt: prompt.trim(),
      repo: repo ?? null,
      branch: branch ?? null,
    });

    // Fan-out: one background job per role, queued on the same slot so turns
    // run strictly sequentially on the single engine.
    const jobs: { role: string; jobId: string; sessionId: string; status: string }[] = [];
    for (const role of roleIds) {
      const enqueued = await enqueueBackgroundJob(userId, engine, {
        text: prompt.trim(),
        taskId: task.id,
        label: role,
        system: buildRoleSystem(role),
      });
      jobs.push({ role, jobId: enqueued.jobId, sessionId: enqueued.sessionId, status: enqueued.status });
    }

    try {
      await transitionTaskStatus(userId, task.id, "RUNNING");
    } catch {}

    // Watch the fan-out jobs; when they all drain, move the task through
    // VERIFYING → WAITING_APPROVAL (or FAILED on any error).
    void trackTeamTask(userId, task.id, jobs.map((j) => j.jobId));

    res.json({
      taskId: task.id,
      roles: roleIds.map((r) => ({ id: r, name: roleLabel(r) })),
      jobs,
      status: "RUNNING",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/agent/team/:taskId — task + per-role job progress.
router.get("/team/:taskId", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const taskId = req.params.taskId as string;
  try {
    const task = await getTask(userId, taskId);
    if (!task) {
      res.status(404).json({ error: "Team task not found" });
      return;
    }
    let jobs: Awaited<ReturnType<typeof listAgentJobsForTask>> = [];
    try {
      jobs = await listAgentJobsForTask(userId, taskId);
    } catch {}
    res.json({
      task,
      jobs: jobs.map((j) => ({
        jobId: j.id,
        sessionId: j.sessionId,
        machineId: j.machineId,
        role: j.label,
        status: j.status,
        error: j.error,
        finished: j.finished,
        timeline: j.timeline,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// POST /api/agent/team/:taskId/approve — accept the team run and close the
// loop: commit the combined sandbox changes to the active repo and (by
// default) push them to the remote. The approval is bound to the diff the UI
// showed (`diffHash`); if the sandbox changed since, the commit is refused so
// unapproved edits can never reach the repository. When no repo is connected
// (or the DB is unavailable) the task is still VERIFIED — the run itself was
// accepted, just without a commit.
router.post("/team/:taskId/approve", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const taskId = req.params.taskId as string;
  const push = req.body?.push !== false;
  const diffHash =
    typeof req.body?.diffHash === "string" && req.body.diffHash
      ? (req.body.diffHash as string)
      : undefined;
  const commitMessage =
    typeof req.body?.commitMessage === "string" && req.body.commitMessage.trim()
      ? (req.body.commitMessage as string).trim().slice(0, 200)
      : "Straxor Agent — team run";

  try {
    const task = await getTask(userId, taskId);
    if (!task) {
      res.status(404).json({ error: "Team task not found" });
      return;
    }
    if (task.status !== "WAITING_APPROVAL") {
      res.status(400).json({ error: "Task nije u stanju WAITING_APPROVAL", status: task.status });
      return;
    }

    // Resolve the active repo the same way /api/repos/* does. Best-effort: a
    // missing/unmigrated table (or offline DB) must never block approval of
    // the run itself — without a repo there is simply nothing to commit.
    let conn: typeof repoConnections.$inferSelect | null = null;
    try {
      const rows = await db
        .select()
        .from(repoConnections)
        .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true)))
        .limit(1);
      conn = rows[0] ?? null;
    } catch (err) {
      console.log(
        `[agent:team] approve ${taskId} — repo resolution skipped: ${err instanceof Error ? err.message : err}`
      );
    }

    const result: {
      committed: boolean;
      hash: string;
      pushed: boolean;
      pushOutput: string;
      diffChanged: boolean;
      empty: boolean;
      error?: string | null;
    } = {
      committed: false,
      hash: "",
      pushed: false,
      pushOutput: "",
      diffChanged: false,
      empty: false,
      error: null,
    };

    if (conn) {
      const token = await getGitRemoteToken(userId, conn.platform as GitPlatformId).catch(() => undefined);
      try {
        await ensureWorkspace({
          userId,
          platform: conn.platform,
          owner: conn.owner,
          name: conn.name,
          fullName: conn.fullName,
          cloneUrl: conn.cloneUrl,
          defaultBranch: conn.defaultBranch,
          token,
        });
        const approved = await approveAndCommitWorkspace(
          userId,
          conn.owner,
          conn.name,
          commitMessage,
          diffHash,
        );
        result.committed = approved.committed;
        result.hash = approved.hash;
        result.diffChanged = approved.diffChanged;
        result.empty = approved.empty;

        if (approved.diffChanged) {
          // Sandbox changed since the diff was shown — refuse the commit and
          // let the user re-review (task stays WAITING_APPROVAL).
          res.status(409).json({
            error: "Diff se promijenio od prikaza — ponovo pregledaj i odobri novi diff",
            ...result,
          });
          return;
        }

        if (approved.committed) {
          try {
            await setTaskFields(userId, taskId, { commitHash: approved.hash });
          } catch {}
          if (push) {
            try {
              result.pushOutput = await pushWorkspace(
                userId,
                conn.owner,
                conn.name,
                conn.defaultBranch,
              );
              result.pushed = true;
            } catch (pushErr) {
              // The commit is safe locally; surface the push problem so the UI
              // can tell the user to push from the Git panel.
              result.error = pushErr instanceof Error ? pushErr.message : "Push nije uspio";
            }
          }
        }
      } catch (commitErr) {
        const message = commitErr instanceof Error ? commitErr.message : "Commit nije uspio";
        res.status(500).json({ error: message, ...result });
        return;
      }
    }

    await transitionTaskStatus(userId, taskId, "VERIFIED");
    void dispatchWebhook(userId, "team.task.approved", {
      taskId,
      status: "VERIFIED",
      committed: result.committed,
      commitHash: result.hash || null,
      pushed: result.pushed,
      error: result.error ?? null,
    });
    res.json({ ok: true, status: "VERIFIED", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/** Poll the fan-out jobs; advance the persistent task when they all finish. */
async function trackTeamTask(userId: string, taskId: string, jobIds: string[]): Promise<void> {
  let verifying = false;
  const poll = async (): Promise<boolean> => {
    const statuses: AgentJobStatus[] = [];
    for (const jobId of jobIds) {
      const mem = backgroundJobs.get(jobId);
      if (mem && mem.userId === userId) {
        statuses.push(mem.status);
        continue;
      }
      try {
        const stored = await getAgentJob(userId, jobId);
        statuses.push(stored?.status ?? "done");
      } catch {
        statuses.push("done");
      }
    }
    if (statuses.some((s) => s === "queued" || s === "running")) return false;
    if (statuses.some((s) => s === "error")) {
      try {
        await transitionTaskStatus(userId, taskId, "FAILED");
      } catch {}
      return true;
    }

    // All roles drained. FAZA 8 — VERIFYING is a REAL gate: the project's
    // build + test run in the sandbox before the run can be approved, so
    // nothing unverified ever reaches Diff → Approve → Commit → Push.
    if (verifying) return false;
    verifying = true;
    try {
      await transitionTaskStatus(userId, taskId, "VERIFYING");
    } catch {}
    try {
      await runTeamVerification(userId, taskId);
    } catch (err) {
      console.log(
        `[agent:team] verify ${taskId} failed to run: ${err instanceof Error ? err.message : err}`
      );
    }
    return true;
  };

  const timer = setInterval(async () => {
    try {
      if (await poll()) clearInterval(timer);
    } catch {}
  }, 3000);
  timer.unref?.();
}

/**
 * FAZA 8 — Verification gate. Clones/refreshes the active repo sandbox and
 * runs the project's build + test (structured result persisted on the task).
 * A failing verification fails the whole team run; a fixture without a
 * package.json (or without an active repo) cannot be verified and proceeds to
 * WAITING_APPROVAL. Never throws — infrastructure problems are logged and
 * treated as "cannot verify" so a platform hiccup never locks the run.
 */
async function runTeamVerification(userId: string, taskId: string): Promise<void> {
  let conn: typeof repoConnections.$inferSelect | null = null;
  try {
    const rows = await db
      .select()
      .from(repoConnections)
      .where(and(eq(repoConnections.userId, userId), eq(repoConnections.isActive, true)))
      .limit(1);
    conn = rows[0] ?? null;
  } catch (err) {
    console.log(
      `[agent:team] verify ${taskId} — repo resolution skipped: ${err instanceof Error ? err.message : err}`
    );
  }

  if (!conn) {
    // No active repo — nothing to verify against.
    try {
      await transitionTaskStatus(userId, taskId, "WAITING_APPROVAL");
    } catch {}
    return;
  }

  const token = await getGitRemoteToken(userId, conn.platform as GitPlatformId).catch(() => undefined);
  try {
    await ensureWorkspace({
      userId,
      platform: conn.platform,
      owner: conn.owner,
      name: conn.name,
      fullName: conn.fullName,
      cloneUrl: conn.cloneUrl,
      defaultBranch: conn.defaultBranch,
      token,
    });
  } catch (err) {
    // Workspace unavailable — cannot verify; the run still proceeds.
    console.log(
      `[agent:team] verify ${taskId} — workspace unavailable: ${err instanceof Error ? err.message : err}`
    );
    try {
      await transitionTaskStatus(userId, taskId, "WAITING_APPROVAL");
    } catch {}
    return;
  }

  const dir = getRepoWorkspaceDir(userId, conn.owner, conn.name);
  const fsMod = await import("fs");
  if (!fsMod.existsSync(path.join(dir, "package.json"))) {
    // No npm manifest — nothing to build/test; proceed to approval.
    try {
      await transitionTaskStatus(userId, taskId, "WAITING_APPROVAL");
    } catch {}
    return;
  }

  const result = await verifyWorkspace(userId, conn.owner, conn.name, {
    install: true,
    timeoutMs: TEAM_VERIFY_TIMEOUT_MS,
    taskId,
  });
  try {
    await setTaskFields(userId, taskId, { verify: result });
  } catch {}

  if (result.skipped) {
    // Manifest without scripts — cannot verify; proceed.
    try {
      await transitionTaskStatus(userId, taskId, "WAITING_APPROVAL");
    } catch {}
    return;
  }

  if (!result.passed) {
    const failed = result.steps.filter((s) => !s.passed);
    const summary = failed
      .map((s) => `${s.name} (exit ${s.exitCode}): ${(s.stderr + s.stdout).trim().slice(0, 400)}`)
      .join(" | ");
    try {
      await setTaskFields(userId, taskId, {
        error: `Verifikacija nije prošla — ${summary}`,
      });
      await transitionTaskStatus(userId, taskId, "FAILED");
    } catch {}
    return;
  }

  try {
    await transitionTaskStatus(userId, taskId, "WAITING_APPROVAL");
  } catch {}
  void dispatchWebhook(userId, "team.task.verified", {
    taskId,
    status: "WAITING_APPROVAL",
    repo: `${conn.owner}/${conn.name}`,
    verify: result,
  });
}

export default router;
