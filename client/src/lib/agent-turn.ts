import type { Attachment } from "./attachments.js";
import type { ChatMessage, ToolCall } from "../components/workspace/ChatPanel.js";
import type { ThinkingBudget } from "./models.js";
import type { AgentRole } from "./roles.js";
import type { PermissionConfig } from "./permissions.js";
import { streamAgentMessage, startAgentBackground, fetchBackgroundStatus, type BackgroundTimelineEntry } from "./agent.js";
import { getRoleById } from "./roles.js";

export interface AgentTurnCtx {
  role: AgentRole;
  provider: string;
  model: string;
  thinking: ThinkingBudget;
  background: boolean;
  machineId: string | null;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  messages: ChatMessage[];
  setMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  assistantMsgId: string;
  setStreamingId: (id: string | null) => void;
  setLoading: (v: boolean) => void;
  setPrefill: (v: string) => void;
  permissions: PermissionConfig;
  activePromptIds: Set<string>;
  savedPrompts: { id: string; name: string; content: string }[];
  projectId: string;
  dbSessionId: string | null;
  createDbSession: () => Promise<string | null>;
  saveMessage: (sessionId: string, role: "user" | "assistant", content: string, label?: string, toolCalls?: ToolCall[]) => Promise<unknown>;
  updateSession: (sessionId: string, patch: Record<string, unknown>) => Promise<unknown>;
  onToolAllow: (id: string, name: string, args: Record<string, unknown> | string, assistantMsgId: string) => void;
  setPendingTool: (v: { toolId: string; args: Record<string, unknown> | string; onAllow: () => void; onDeny: () => void } | null) => void;
  setSecurityPackageName: (v: string) => void;
  setPendingInstallAllow: (v: (() => void) | null) => void;
  setSecurityVerdict: (v: any) => void;
  checkBeforeInstall: (name: string, version: string, ecosystem: string, machineId?: string) => Promise<unknown>;
  onRefreshTodos?: () => void;
  onErrorFallback?: (error: string) => void;
  signal?: AbortSignal;
}

function buildSystemContext(role: AgentRole, prompts: { id: string; name: string; content: string }[], activeIds: Set<string>): string {
  const roleConfig = getRoleById(role);
  const activePrompts = prompts.filter((p) => activeIds.has(p.id));
  const parts: string[] = [];
  parts.push(`[SISTEMSKA ULOGA: ${roleConfig.label}]\n${roleConfig.systemPrompt}`);
  for (const p of activePrompts) {
    parts.push(`[${p.name}]\n${p.content}`);
  }
  return parts.join("\n\n");
}

export async function runAgentTurn(msg: string, attachments: Attachment[] | undefined, ctx: AgentTurnCtx): Promise<void> {
  const system = buildSystemContext(ctx.role, ctx.savedPrompts, ctx.activePromptIds);
  const fullMsg = msg;

  if (!ctx.machineId) {
    ctx.setLoading(false);
    ctx.setStreamingId(null);
    return;
  }

  // Background mode: fire-and-forget server-side run + polling.
  if (ctx.background) {
    const statusRef = { timeline: [] as BackgroundTimelineEntry[] };
    const applyTimeline = () => {
      ctx.setMessages((prev) =>
        prev.map((m) =>
          m.id === ctx.assistantMsgId
            ? {
                ...m,
                content: statusRef.timeline.filter((e) => e.t === "text").map((e) => e.content || "").join(""),
                toolCalls: statusRef.timeline
                  .filter((e) => e.t === "tool_call")
                  .map((e) => ({
                    id: e.toolId!,
                    name: e.toolName || "tool",
                    args: (() => {
                      try { return JSON.parse(e.content || "{}"); } catch { return e.content || {}; }
                    })(),
                    status: e.toolStatus === "completed" || e.toolStatus === "error" ? e.toolStatus : "running",
                    result: e.content,
                  })),
              }
            : m
        )
      );
    };

    const cancelled = { done: false };
    const onSigAbort = () => {
      cancelled.done = true;
      ctx.setStreamingId(null);
      ctx.setLoading(false);
    };
    ctx.signal?.addEventListener("abort", onSigAbort, { once: true });

    const poll = async (jobId: string) => {
      let attempts = 0;
      const timer = window.setInterval(async () => {
        if (cancelled.done || attempts++ > 2400) {
          window.clearInterval(timer);
          ctx.signal?.removeEventListener("abort", onSigAbort);
          ctx.setStreamingId(null);
          ctx.setLoading(false);
          return;
        }
        try {
          const st = await fetchBackgroundStatus(jobId);
          if (st.timeline.length !== statusRef.timeline.length) {
            statusRef.timeline = st.timeline;
            applyTimeline();
          }
          if (st.finished) {
            window.clearInterval(timer);
            ctx.signal?.removeEventListener("abort", onSigAbort);
            if (st.status === "error" && st.error) {
              ctx.setMessages((prev) =>
                prev.map((m) => (m.id === ctx.assistantMsgId ? { ...m, content: `[Greška: ${st.error}]` } : m))
              );
            }
            ctx.setStreamingId(null);
            ctx.setLoading(false);
          }
        } catch {}
      }, 1500);
    };

    try {
      const started = await startAgentBackground(ctx.machineId, fullMsg, ctx.sessionId, attachments, system);
      ctx.setSessionId(started.sessionId);
      statusRef.timeline = [];
      await poll(started.jobId);
    } catch (err) {
      ctx.signal?.removeEventListener("abort", onSigAbort);
      const message = err instanceof Error ? err.message : "Network error";
      ctx.setMessages((prev) =>
        prev.map((m) => (m.id === ctx.assistantMsgId ? { ...m, content: `[Greška: ${message}]` } : m))
      );
      ctx.setStreamingId(null);
      ctx.setLoading(false);
    }
    return;
  }

  streamAgentMessage(ctx.machineId, fullMsg, ctx.sessionId, {
    onSession: (sessionId) => ctx.setSessionId(sessionId),
    onText: (content) => {
      ctx.setMessages((prev) =>
        prev.map((m) => (m.id === ctx.assistantMsgId ? { ...m, content: m.content + content } : m))
      );
    },
    onToolCall: (id, name, args) => {
      const level = ctx.permissions[name] || "ask";
      if (level === "never") {
        ctx.setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== ctx.assistantMsgId) return m;
            const existing = m.toolCalls || [];
            const tc: ToolCall = { id, name, args, status: "error", result: "⛔ Blokirano dozvolama" };
            return { ...m, toolCalls: [...existing, tc] };
          })
        );
        return;
      }

      if (level === "ask") {
        ctx.setPendingTool({
          toolId: name,
          args,
          onAllow: () => {
            ctx.setPendingTool(null);
            if (name === "install_package") {
              const pkgName = typeof args === "string" ? args : (args.package || args.name || args.packageName || "") as string;
              const pkgVersion = typeof args === "string" ? "latest" : (args.version || "latest") as string;
              const ecosystem = typeof args === "string" ? "npm" : (args.ecosystem || "npm") as string;
              if (pkgName) {
                ctx.setSecurityPackageName(pkgName);
                ctx.setPendingInstallAllow(() => () => ctx.onToolAllow(id, name, args, ctx.assistantMsgId));
                ctx.checkBeforeInstall(pkgName, pkgVersion, ecosystem, ctx.machineId || undefined)
                  .then((verdict) => ctx.setSecurityVerdict(verdict))
                  .catch(() => ctx.onToolAllow(id, name, args, ctx.assistantMsgId));
                return;
              }
            }
            ctx.onToolAllow(id, name, args, ctx.assistantMsgId);
          },
          onDeny: () => {
            ctx.setPendingTool(null);
            ctx.setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== ctx.assistantMsgId) return m;
                const existing = m.toolCalls || [];
                const tc: ToolCall = { id, name, args, status: "error", result: "⛔ Odbijeno od korisnika" };
                return { ...m, toolCalls: [...existing, tc] };
              })
            );
          },
        });
        return;
      }

      ctx.setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== ctx.assistantMsgId) return m;
          const existing = m.toolCalls || [];
          const idx = existing.findIndex((tc) => tc.id === id);
          const tc: ToolCall = { id, name, args, status: "running" };
          const updated = [...existing];
          if (idx >= 0) updated[idx] = { ...updated[idx], status: "running", args };
          else updated.push(tc);
          return { ...m, toolCalls: updated };
        })
      );
    },
    onToolResult: (id, result, status) => {
      ctx.setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== ctx.assistantMsgId) return m;
          const existing = m.toolCalls || [];
          const idx = existing.findIndex((tc) => tc.id === id);
          const updated = [...existing];
          if (idx >= 0) updated[idx] = { ...updated[idx], result, status };
          else updated.push({ id, name: "tool", args: {}, result, status });
          return { ...m, toolCalls: updated };
        })
      );
    },
    onDone: () => {
      ctx.setStreamingId(null);
      ctx.setLoading(false);
      if (ctx.onRefreshTodos) setTimeout(ctx.onRefreshTodos, 300);
      const msgId = ctx.assistantMsgId;
      ctx.setMessages((prev) => {
        const found = prev.find((m) => m.id === msgId);
        if (found && !found.content && !found.toolCalls?.length) {
          return prev.map((m) =>
            m.id === msgId
              ? { ...m, content: "_Agent je završio zadatak bez vidljivog teksta ili alata._" }
              : m
          );
        }
        if (found && found.content) {
          ctx.saveMessage(ctx.dbSessionId!, "assistant", found.content, found.label, found.toolCalls).catch(() => {});
        }
        return prev;
      });
    },
    onError: (error) => {
      if (ctx.onErrorFallback) {
        ctx.onErrorFallback(error);
        return;
      }
      ctx.setMessages((prev) =>
        prev.map((m) => (m.id === ctx.assistantMsgId ? { ...m, content: m.content + `\n\n[Greška: ${error}]` } : m))
      );
      ctx.setStreamingId(null);
      ctx.setLoading(false);
    },
  }, attachments, system, ctx.signal);
}
