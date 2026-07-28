import { useState, useCallback, useEffect, useMemo } from "react";
import WorkspaceTopbar from "../components/workspace/WorkspaceTopbar.js";
import { useTheme } from "../lib/theme.js";
import ChatPanel from "../components/workspace/ChatPanel.js";
import TodoList, { type TodoStep } from "../components/workspace/TodoList.js";
import BottomBar from "../components/workspace/BottomBar.js";
import SshInput from "../components/workspace/SshInput.js";
import EnvEditor from "../components/workspace/EnvEditor.js";
import DeploymentPanel from "../components/workspace/DeploymentPanel.js";
import DiffReview, { type DiffFile } from "../components/workspace/DiffReview.js";
import PermissionsPanel from "../components/workspace/PermissionsPanel.js";
import ToolConfirmDialog from "../components/workspace/ToolConfirmDialog.js";
import type { ChatMessage, ToolCall } from "../components/workspace/ChatPanel.js";
import type { PlanActMode } from "../components/workspace/PlanActToggle.js";
import type { ThinkingBudget } from "../lib/models.js";
import { streamChat, hasApiKey } from "../lib/chat.js";
import { streamAgentMessage, fetchTodos, fetchDiff, approveChanges, rejectChanges } from "../lib/agent.js";
import { fetchPermissions, type PermissionConfig } from "../lib/permissions.js";
import { type AgentRole, getRoleById, fetchPrompts, type SavedPrompt } from "../lib/roles.js";
import { checkBeforeInstall, type ScanVerdict } from "../lib/security.js";
import RoleSelector from "../components/workspace/RoleSelector.js";
import PromptLibrary from "../components/workspace/PromptLibrary.js";
import SecurityScanResult from "../components/workspace/SecurityScanResult.js";
import ExportPanel from "../components/workspace/ExportPanel.js";
import NotificationSettings from "../components/workspace/NotificationSettings.js";
import CommandPalette from "../components/workspace/CommandPalette.js";
import WorktreeManager from "../components/workspace/WorktreeManager.js";
import BrowserVerifier from "../components/workspace/BrowserVerifier.js";
import SessionPicker from "../components/workspace/SessionPicker.js";
import SearchPanel from "../components/workspace/SearchPanel.js";
import RollbackPanel from "../components/workspace/RollbackPanel.js";
import ContextPanel from "../components/workspace/ContextPanel.js";
import GatewayPanel from "../components/workspace/GatewayPanel.js";
import ProvidersPanel from "../components/workspace/ProvidersPanel.js";
import MultiAgentPanel from "../components/workspace/MultiAgentPanel.js";
import HomeCenter from "../components/workspace/HomeCenter.js";
import DesignAssetsPanel from "../components/workspace/DesignAssetsPanel.js";
import DesignStudio from "../components/workspace/DesignStudio.js";
import WebResearchPanel from "../components/workspace/WebResearchPanel.js";
import UsagePanel from "../components/workspace/UsagePanel.js";
import RuntimeSelector from "../components/workspace/RuntimeSelector.js";
import QuickStartPanel from "../components/workspace/QuickStartPanel.js";
import type { VerificationResult } from "../lib/verify.js";
import {
  fetchSessions,
  fetchSession,
  createSession,
  updateSession,
  saveMessage,
  restoreMessages,
  type Session,
} from "../lib/sessions.js";
import type { Command } from "../lib/commands.js";

const INITIAL_ASK_MESSAGES: ChatMessage[] = [
  {
    id: "a1",
    role: "user",
    content: "Koji je najbolji način da napravim responsive navbar sa Tailwind-om?",
  },
  {
    id: "a2",
    role: "assistant",
    label: "Claude Sonnet 4",
    content: 'Za responsive navbar koristi hidden md:flex za desktop linkove i hamburger meni za mobile.\n\nZa kompleksniji meni, razmotri @headlessui/react za accessible dropdown-ove.',
  },
];

export default function Workspace() {
  const { toggleTheme } = useTheme();
  const [orchestrator, setOrchestrator] = useState(false);

  const [askProvider, setAskProvider] = useState("anthropic");
  const [askModel, setAskModel] = useState("claude-sonnet-4");
  const [askThinking, setAskThinking] = useState<ThinkingBudget>("medium");
  const [askPlanAct, setAskPlanAct] = useState<PlanActMode>("plan");

  const [agentProvider, setAgentProvider] = useState("anthropic");
  const [agentModel, setAgentModel] = useState("claude-opus-4-6");
  const [agentThinking, setAgentThinking] = useState<ThinkingBudget>("high");
  const [agentPlanAct, setAgentPlanAct] = useState<PlanActMode>("act");

  const [askMessages, setAskMessages] = useState<ChatMessage[]>(INITIAL_ASK_MESSAGES);
  const [agentMessages, setAgentMessages] = useState<ChatMessage[]>([]);
  const [mobileTab, setMobileTab] = useState<"ask" | "agent">("ask");

  const [askStreamingId, setAskStreamingId] = useState<string | null>(null);
  const [agentStreamingId, setAgentStreamingId] = useState<string | null>(null);

  const [askLoading, setAskLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);

  // VPS state
  const [showSshModal, setShowSshModal] = useState(false);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showWorktrees, setShowWorktrees] = useState(false);
  const [showBrowserVerify, setShowBrowserVerify] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showRollback, setShowRollback] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [showGateway, setShowGateway] = useState(false);
  const [showProviders, setShowProviders] = useState(false);
  const [showMultiAgent, setShowMultiAgent] = useState(false);
  const [showHomeCenter, setShowHomeCenter] = useState(false);
  const [showDesignAssets, setShowDesignAssets] = useState(false);
  const [showDesignStudio, setShowDesignStudio] = useState(false);
  const [showWebResearch, setShowWebResearch] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [showRuntimeManager, setShowRuntimeManager] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [vpsStatus, setVpsStatus] = useState<"disconnected" | "connecting" | "provisioning" | "ready" | "error">("disconnected");

  // Permissions state
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissions, setPermissions] = useState<PermissionConfig>({});
  const [pendingTool, setPendingTool] = useState<{
    toolId: string;
    args: Record<string, unknown> | string;
    onAllow: () => void;
    onDeny: () => void;
  } | null>(null);

  // Agent role & prompts state
  const [agentRole, setAgentRole] = useState<AgentRole>("developer");
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [activePromptIds, setActivePromptIds] = useState<Set<string>>(new Set());
  const [showPromptLibrary, setShowPromptLibrary] = useState(false);

  // Security scan state
  const [securityVerdict, setSecurityVerdict] = useState<ScanVerdict | null>(null);
  const [securityPackageName, setSecurityPackageName] = useState<string>("");
  const [pendingInstallAllow, setPendingInstallAllow] = useState<(() => void) | null>(null);

  // Agent session state
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const [agentMachineId, setAgentMachineId] = useState<string | null>(null);

  // Resume system state
  const [dbSessionId, setDbSessionId] = useState<string | null>(null);
  const [dbSessions, setDbSessions] = useState<Session[]>([]);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Agent todo state
  const [agentTodos, setAgentTodos] = useState<TodoStep[]>([]);
  const [confirmedSteps, setConfirmedSteps] = useState<Set<string>>(new Set());
  const [diffCache, setDiffCache] = useState<Record<string, string>>({});

  // API key status
  const [askHasKey, setAskHasKey] = useState(false);

  // Panel-to-panel copy
  const [askPrefill, setAskPrefill] = useState("");
  const [agentPrefill, setAgentPrefill] = useState("");

  // Panel mode: split | ask-full | agent-full
  const [panelMode, setPanelMode] = useState<"split" | "ask-full" | "agent-full">("split");

  // Diff review modal
  const [showDiffReview, setShowDiffReview] = useState(false);
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);

  // Check API key status when provider changes
  useEffect(() => {
    hasApiKey(askProvider).then(setAskHasKey);
  }, [askProvider]);

  // Load permissions and saved prompts on mount
  useEffect(() => {
    fetchPermissions().then(setPermissions);
    fetchPrompts().then(setSavedPrompts);
  }, []);

  // Resume system — load sessions on mount
  useEffect(() => {
    const PROJECT_ID = "straxor-landing";
    fetchSessions(PROJECT_ID).then(setDbSessions);
  }, []);

  // Resume system — restore latest active session
  const restoreLatestSession = useCallback(async () => {
    if (dbSessions.length === 0) return;
    const latest = dbSessions[0];
    if (!latest) return;

    setSessionLoading(true);
    try {
      const full = await fetchSession(latest.id);
      if (!full) return;

      // Restore DB session ID
      setDbSessionId(full.id);

      // Restore OpenCode session ID
      if (full.opencodeSessionId) {
        setAgentSessionId(full.opencodeSessionId);
      }

      // Restore machine ID
      if (full.machineId) {
        setAgentMachineId(full.machineId);
        setVpsStatus("ready");
      }

      // Restore agent config
      if (full.agentConfig) {
        try {
          const cfg = JSON.parse(full.agentConfig);
          if (cfg.provider) setAgentProvider(cfg.provider);
          if (cfg.model) setAgentModel(cfg.model);
          if (cfg.thinking) setAgentThinking(cfg.thinking);
          if (cfg.role) setAgentRole(cfg.role);
          if (cfg.planAct) setAgentPlanAct(cfg.planAct);
        } catch {}
      }

      // Restore ask config
      if (full.askConfig) {
        try {
          const cfg = JSON.parse(full.askConfig);
          if (cfg.provider) setAskProvider(cfg.provider);
          if (cfg.model) setAskModel(cfg.model);
          if (cfg.thinking) setAskThinking(cfg.thinking);
          if (cfg.planAct) setAskPlanAct(cfg.planAct);
        } catch {}
      }

      // Restore active prompts
      if (full.activePromptIds) {
        try {
          const ids = JSON.parse(full.activePromptIds);
          setActivePromptIds(new Set(ids));
        } catch {}
      }

      // Restore messages
      if (full.messages && full.messages.length > 0) {
        const restored = restoreMessages(full.messages);
        setAgentMessages(restored as ChatMessage[]);
      }

      // Restore todos
      if (full.todoSnapshot) {
        try {
          const todos = JSON.parse(full.todoSnapshot);
          setAgentTodos(todos);
        } catch {}
      }
    } finally {
      setSessionLoading(false);
    }
  }, [dbSessions]);

  // Auto-restore on mount if there's an active session
  useEffect(() => {
    if (dbSessions.length > 0 && !dbSessionId && !sessionLoading) {
      restoreLatestSession();
    }
  }, [dbSessions, dbSessionId, sessionLoading, restoreLatestSession]);

  // Auto-save todos to DB session when they change
  useEffect(() => {
    if (dbSessionId && agentTodos.length > 0) {
      const timeout = setTimeout(() => {
        updateSession(dbSessionId, { todoSnapshot: JSON.stringify(agentTodos) }).catch(() => {});
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [dbSessionId, agentTodos]);

  // Command palette keyboard shortcut (CTRL/CMD + K)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      // Search shortcut (Ctrl+Shift+F)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
      // Home Center (Ctrl+H)
      if ((e.metaKey || e.ctrlKey) && e.key === "h") {
        e.preventDefault();
        setShowHomeCenter((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Fetch todos after agent finishes
  const refreshTodos = useCallback(async () => {
    if (!agentMachineId || !agentSessionId) return;

    // Preserve verification results from current state
    const existingVerifications = new Map(
      agentTodos.filter((s) => s.verification).map((s) => [s.id, s.verification!])
    );

    const raw = await fetchTodos(agentMachineId, agentSessionId);
    const steps: TodoStep[] = raw.map((t) => {
      const id = String(t.id);
      const isConfirmed = confirmedSteps.has(id);

      let status: TodoStep["status"];
      if (isConfirmed) {
        status = "completed";
      } else if (t.status === "completed") {
        status = "needs_review";
      } else {
        status = t.status as TodoStep["status"];
      }

      return {
        id,
        content: t.content,
        status,
        diff: diffCache[id],
        verification: existingVerifications.get(id),
      };
    });

    setAgentTodos(steps);
  }, [agentMachineId, agentSessionId, confirmedSteps, diffCache, agentTodos]);

  // Fetch diff for a specific step
  const handleExpandStep = useCallback(async (stepId: string) => {
    if (!agentMachineId || !agentSessionId) return;
    if (diffCache[stepId]) return;

    const diffs = await fetchDiff(agentMachineId, agentSessionId);
    const unified = diffs
      .map((d) => {
        const header = `--- ${d.path}\n+++ ${d.path}`;
        const adds = d.additions.map((l) => `+ ${l}`).join("\n");
        const dels = d.deletions.map((l) => `- ${l}`).join("\n");
        return [header, dels, adds].filter(Boolean).join("\n");
      })
      .join("\n\n");

    if (unified) {
      setDiffCache((prev) => ({ ...prev, [stepId]: unified }));
      setAgentTodos((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, diff: unified } : s))
      );
    }
  }, [agentMachineId, agentSessionId, diffCache]);

  // Open diff review modal
  const handleOpenDiffReview = useCallback(async () => {
    if (!agentMachineId || !agentSessionId) return;
    setDiffLoading(true);
    try {
      const diffs = await fetchDiff(agentMachineId, agentSessionId);
      const files: DiffFile[] = diffs.map((d) => ({
        path: d.path,
        additions: d.additions,
        deletions: d.deletions,
      }));
      setDiffFiles(files);
      setShowDiffReview(true);
    } catch {}
    setDiffLoading(false);
  }, [agentMachineId, agentSessionId]);

  // Approve selected changes
  const handleApprove = useCallback(async (paths: string[]) => {
    if (!agentMachineId || !agentSessionId) return;
    setDiffLoading(true);
    try {
      await approveChanges(agentMachineId, agentSessionId, paths);
      setShowDiffReview(false);
      // Refresh todos after approval
      setTimeout(() => refreshTodos(), 500);
    } catch {}
    setDiffLoading(false);
  }, [agentMachineId, agentSessionId, refreshTodos]);

  // Reject selected changes
  const handleReject = useCallback(async (paths: string[]) => {
    if (!agentMachineId || !agentSessionId) return;
    setDiffLoading(true);
    try {
      await rejectChanges(agentMachineId, agentSessionId, paths);
      setShowDiffReview(false);
      // Refresh todos after rejection
      setTimeout(() => refreshTodos(), 500);
    } catch {}
    setDiffLoading(false);
  }, [agentMachineId, agentSessionId, refreshTodos]);

  const handleAskSend = useCallback((msg: string) => {
    const userMsg: ChatMessage = { id: `a-${Date.now()}`, role: "user", content: msg };
    const assistantMsg: ChatMessage = {
      id: `a-${Date.now() + 1}`,
      role: "assistant",
      content: "",
      label: askModel,
    };

    setAskMessages((prev) => [...prev, userMsg, assistantMsg]);
    setAskStreamingId(assistantMsg.id);
    setAskLoading(true);
    setAskPrefill("");

    const history = [...askMessages, userMsg].map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    streamChat(askProvider, askModel, history, askThinking, {
      onToken: (token) => {
        setAskMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: m.content + token } : m
          )
        );
      },
      onDone: () => {
        setAskStreamingId(null);
        setAskLoading(false);
      },
      onError: (error) => {
        setAskMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `[Greška: ${error}]` }
              : m
          )
        );
        setAskStreamingId(null);
        setAskLoading(false);
      },
    });
  }, [askProvider, askModel, askThinking, askMessages]);

  // Helper: proceed with tool allow after permission/security check
  const proceedToolAllow = useCallback(
    (toolCallId: string, toolName: string, toolArgs: Record<string, unknown> | string, assistantMsgId: string) => {
      setAgentMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantMsgId) return m;
          const existing = m.toolCalls || [];
          const idx = existing.findIndex((tc) => tc.id === toolCallId);
          const tc: ToolCall = { id: toolCallId, name: toolName, args: toolArgs, status: "running" };
          const updated = [...existing];
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], status: "running", args: toolArgs };
          } else {
            updated.push(tc);
          }
          return { ...m, toolCalls: updated };
        })
      );
    },
    []
  );

  const handleAgentSend = useCallback(async (msg: string) => {
    if (!agentMachineId) {
      setAgentMessages((prev) => [
        ...prev,
        {
          id: `g-err-${Date.now()}`,
          role: "assistant",
          content: "⚠ Nema povezanog VPS-a. Klikni 'Connect VPS' za povezivanje.",
          label: "System",
        },
      ]);
      return;
    }

    // Auto-create DB session on first message
    let activeDbSessionId = dbSessionId;
    if (!activeDbSessionId) {
      try {
        const PROJECT_ID = "straxor-landing";
        const sess = await createSession(
          PROJECT_ID,
          agentMachineId,
          msg.slice(0, 100),
          { provider: agentProvider, model: agentModel, thinking: agentThinking, role: agentRole, planAct: agentPlanAct },
          { provider: askProvider, model: askModel, thinking: askThinking, planAct: askPlanAct }
        );
        activeDbSessionId = sess.id;
        setDbSessionId(sess.id);
        // Refresh session list
        fetchSessions(PROJECT_ID).then(setDbSessions);
      } catch (err) {
        console.error("Failed to create DB session:", err);
      }
    }

    // Save user message to DB
    if (activeDbSessionId) {
      saveMessage(activeDbSessionId, "user", msg).catch(() => {});
    }

    // Build system context from role + active prompts
    const roleConfig = getRoleById(agentRole);
    const activePrompts = savedPrompts.filter((p) => activePromptIds.has(p.id));
    const systemParts: string[] = [];
    systemParts.push(`[SISTEMSKA ULOGA: ${roleConfig.label}]\n${roleConfig.systemPrompt}`);
    for (const p of activePrompts) {
      systemParts.push(`[${p.name}]\n${p.content}`);
    }
    const fullMsg =
      systemParts.length > 0
        ? `${systemParts.join("\n\n")}\n\n---\n\n${msg}`
        : msg;

    const userMsg: ChatMessage = { id: `g-${Date.now()}`, role: "user", content: msg };
    const assistantMsg: ChatMessage = {
      id: `g-${Date.now() + 1}`,
      role: "assistant",
      content: "",
      label: agentModel,
      toolCalls: [],
    };

    setAgentMessages((prev) => [...prev, userMsg, assistantMsg]);
    setAgentStreamingId(assistantMsg.id);
    setAgentLoading(true);
    setAgentPrefill("");

    streamAgentMessage(agentMachineId, fullMsg, agentSessionId, {
      onSession: (sessionId) => {
        setAgentSessionId(sessionId);
      },
      onText: (content) => {
        setAgentMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: m.content + content }
              : m
          )
        );
      },
      onToolCall: (id, name, args) => {
        // Check permission for this tool
        const level = permissions[name] || "ask";
        if (level === "never") {
          // Block — don't add as running
          setAgentMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantMsg.id) return m;
              const existing = m.toolCalls || [];
              const tc: ToolCall = { id, name, args, status: "error", result: "⛔ Blokirano dozvolama" };
              return { ...m, toolCalls: [...existing, tc] };
            })
          );
          return;
        }

        if (level === "ask") {
          // Show confirmation dialog
          setPendingTool({
            toolId: name,
            args,
            onAllow: () => {
              setPendingTool(null);

              // For install_package, run security check first
              if (name === "install_package") {
                const pkgName = typeof args === "string"
                  ? args
                  : (args.package || args.name || args.packageName || "") as string;
                const pkgVersion = typeof args === "string"
                  ? "latest"
                  : (args.version || "latest") as string;
                const ecosystem = typeof args === "string"
                  ? "npm"
                  : (args.ecosystem || "npm") as string;

                if (pkgName) {
                  setSecurityPackageName(pkgName);
                  setPendingInstallAllow(() => () => {
                    proceedToolAllow(id, name, args, assistantMsg.id);
                  });

                  checkBeforeInstall(pkgName, pkgVersion, ecosystem, agentMachineId || undefined)
                    .then((verdict) => {
                      setSecurityVerdict(verdict);
                    })
                    .catch(() => {
                      // If scan fails, proceed anyway
                      proceedToolAllow(id, name, args, assistantMsg.id);
                    });
                  return;
                }
              }

              proceedToolAllow(id, name, args, assistantMsg.id);
            },
            onDeny: () => {
              setPendingTool(null);
              setAgentMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantMsg.id) return m;
                  const existing = m.toolCalls || [];
                  const tc: ToolCall = { id, name, args, status: "error", result: "⛔ Odbijeno od korisnika" };
                  return { ...m, toolCalls: [...existing, tc] };
                })
              );
            },
          });
          return;
        }

        // always — proceed
        setAgentMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantMsg.id) return m;
            const existing = m.toolCalls || [];
            const idx = existing.findIndex((tc) => tc.id === id);
            const tc: ToolCall = { id, name, args, status: "running" };
            const updated = [...existing];
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], status: "running", args };
            } else {
              updated.push(tc);
            }
            return { ...m, toolCalls: updated };
          })
        );
      },
      onToolResult: (id, result, status) => {
        setAgentMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantMsg.id) return m;
            const existing = m.toolCalls || [];
            const idx = existing.findIndex((tc) => tc.id === id);
            const updated = [...existing];
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], result, status };
            } else {
              updated.push({ id, name: "tool", args: {}, result, status });
            }
            return { ...m, toolCalls: updated };
          })
        );
      },
      onDone: () => {
        setAgentStreamingId(null);
        setAgentLoading(false);
        // Refresh todos after agent finishes
        setTimeout(() => refreshTodos(), 300);

        // Save assistant message to DB
        if (dbSessionId) {
          const msgId = assistantMsg.id;
          // Get the assistant message content from the current state
          setAgentMessages((prev) => {
            const found = prev.find((m) => m.id === msgId);
            if (found && found.content) {
              saveMessage(
                dbSessionId,
                "assistant",
                found.content,
                found.label,
                found.toolCalls
              ).catch(() => {});
            }
            return prev;
          });

          // Save session metadata
          updateSession(dbSessionId, {
            lastTask: msg.slice(0, 500),
            agentConfig: JSON.stringify({ provider: agentProvider, model: agentModel, thinking: agentThinking, role: agentRole, planAct: agentPlanAct }),
            activePromptIds: JSON.stringify(Array.from(activePromptIds)),
          }).catch(() => {});
        }
      },
      onError: (error) => {
        setAgentMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: m.content + `\n\n[Greška: ${error}]` }
              : m
          )
        );
        setAgentStreamingId(null);
        setAgentLoading(false);
      },
    });
  }, [agentMachineId, agentSessionId, agentModel, refreshTodos, permissions, agentRole, savedPrompts, activePromptIds, dbSessionId, agentProvider, agentThinking, agentPlanAct, askProvider, askModel, askThinking, askPlanAct]);

  // Confirm a step — send message to agent to continue
  const handleConfirmStep = useCallback(
    (stepId: string) => {
      const step = agentTodos.find((s) => s.id === stepId);
      if (!step) return;

      setConfirmedSteps((prev) => new Set([...prev, stepId]));
      setAgentTodos((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, status: "completed" as const } : s))
      );

      // Send confirmation message to agent
      handleAgentSend(`Korak potvrđen: "${step.content}". Nastavi na sljedeći korak.`);
    },
    [agentTodos, handleAgentSend]
  );

  // Store verification result for a step
  const handleVerified = useCallback((stepId: string, result: VerificationResult) => {
    setAgentTodos((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, verification: result } : s))
    );
  }, []);

  const handleVpsConnected = useCallback((machineId: string) => {
    setAgentMachineId(machineId);
    setVpsStatus("ready");
    setShowSshModal(false);
  }, []);

  const toggleAskExpand = useCallback(() => {
    setPanelMode((prev) => (prev === "ask-full" ? "split" : "ask-full"));
  }, []);

  const toggleAgentExpand = useCallback(() => {
    setPanelMode((prev) => (prev === "agent-full" ? "split" : "agent-full"));
  }, []);

  // ── Command Palette commands ──
  const commands: Command[] = useMemo(() => [
    // Search command
    {
      id: "search-project",
      label: "Pretraga projekta",
      description: "Pretraži datoteke, tekst, regex",
      icon: "🔍",
      category: "file",
      shortcut: "MOD+SHIFT+F",
      keywords: ["search", "pretraga", "find", "nađi", "grep"],
      action: () => setShowSearch(true),
    },

    // Panel commands
    {
      id: "panel-split",
      label: "Split prikaz",
      description: "Prikaži Ask i Agent panele",
      icon: "⊞",
      category: "panel",
      shortcut: "MOD+1",
      keywords: ["panel", "split", "dva"],
      action: () => setPanelMode("split"),
    },
    {
      id: "panel-ask",
      label: "Ask panel (full)",
      description: "Proširi Ask panel",
      icon: "◆",
      category: "panel",
      shortcut: "MOD+2",
      keywords: ["ask", "pitanja", "chat"],
      action: () => setPanelMode("ask-full"),
    },
    {
      id: "panel-agent",
      label: "Agent panel (full)",
      description: "Proširi Agent panel",
      icon: "⚡",
      category: "panel",
      shortcut: "MOD+3",
      keywords: ["agent", "build", "kod"],
      action: () => setPanelMode("agent-full"),
    },

    // Model commands
    {
      id: "model-sonnet",
      label: "Switch to Claude Sonnet 4",
      description: "Ask panel → Claude Sonnet 4",
      icon: "◆",
      category: "model",
      keywords: ["model", "sonnet", "claude", "anthropic"],
      action: () => { setAskProvider("anthropic"); setAskModel("claude-sonnet-4"); },
    },
    {
      id: "model-opus",
      label: "Switch to Claude Opus",
      description: "Agent panel → Claude Opus",
      icon: "◆",
      category: "model",
      keywords: ["model", "opus", "claude", "anthropic"],
      action: () => { setAgentProvider("anthropic"); setAgentModel("claude-opus-4-6"); },
    },
    {
      id: "model-gpt4o",
      label: "Switch to GPT-4o",
      description: "Ask panel → GPT-4o",
      icon: "◉",
      category: "model",
      keywords: ["model", "gpt", "openai", "4o"],
      action: () => { setAskProvider("openai"); setAskModel("gpt-4o"); },
    },
    {
      id: "model-gemini",
      label: "Switch to Gemini 2.5",
      description: "Ask panel → Gemini 2.5 Pro",
      icon: "◇",
      category: "model",
      keywords: ["model", "gemini", "google"],
      action: () => { setAskProvider("google"); setAskModel("gemini-2.5-pro"); },
    },

    // Action commands
    {
      id: "action-connect-vps",
      label: "Poveži VPS",
      description: "Otvori SSH povezivanje",
      icon: "⏻",
      category: "action",
      keywords: ["vps", "ssh", "connect", "server"],
      action: () => setShowSshModal(true),
    },
    {
      id: "action-deploy",
      label: "Deploy projekat",
      description: "Pokreni deploy proces",
      icon: "🚀",
      category: "action",
      keywords: ["deploy", "publish", "objavi"],
      action: () => setShowDeployModal(true),
    },
    {
      id: "action-export",
      label: "Export projekat",
      description: "Exportuj kao ZIP",
      icon: "📦",
      category: "action",
      keywords: ["export", "download", "zip", "paket"],
      action: () => setShowExportModal(true),
    },
    {
      id: "action-env",
      label: "Uredi env varijable",
      description: "Upravljaj .env datotekom",
      icon: "🔑",
      category: "action",
      keywords: ["env", "environment", "varijable", "secret"],
      action: () => setShowEnvModal(true),
    },
    {
      id: "action-logs",
      label: "Otvori logove",
      description: "Prikaži logove sistema",
      icon: "📋",
      category: "action",
      keywords: ["log", "logs", "povijest", "zapis"],
      action: () => {
        // Focus BottomBar logs tab — handled via event
        window.dispatchEvent(new CustomEvent("straxor:open-logs"));
      },
    },
    {
      id: "action-console",
      label: "Otvori konzolu",
      description: "Prikaži konzolu (greške)",
      icon: "◉",
      category: "action",
      keywords: ["console", "konzola", "error", "greska"],
      action: () => {
        window.dispatchEvent(new CustomEvent("straxor:open-console"));
      },
    },
    {
      id: "action-worktrees",
      label: "Git Worktrees",
      description: "Upravljaj worktree-ovima za paralelne grane",
      icon: "🌳",
      category: "action",
      keywords: ["worktree", "git", "branch", "grana", "paralelno"],
      action: () => setShowWorktrees(true),
    },
    {
      id: "action-browser-verify",
      label: "Browser Verifikacija",
      description: "Testiraj stranice u browseru — screenshot, JS greške, forme",
      icon: "🌐",
      category: "action",
      keywords: ["browser", "playwright", "screenshot", "test", "web"],
      action: () => setShowBrowserVerify(true),
    },
    {
      id: "action-rollback",
      label: "Historija verzija",
      description: "Vizuelni povratak projekta na prethodno stanje",
      icon: "↺",
      category: "action",
      keywords: ["rollback", "restore", "snapshot", "povijest", "verzija"],
      action: () => setShowRollback(true),
    },
    {
      id: "action-context",
      label: "Kontekst engine",
      description: "Upravljaj pravilima, sjećanjima i kontekstom za AI",
      icon: "🧠",
      category: "action",
      keywords: ["context", "kontekst", "rules", "pravila", "memory", "sjećanje"],
      action: () => setShowContext(true),
    },
    {
      id: "action-gateway",
      label: "AI Gateway",
      description: "Upravljaj AI gateway-em, cache-m i metrikama",
      icon: "⚡",
      category: "action",
      keywords: ["gateway", "proxy", "router", "cache", "fallback"],
      action: () => setShowGateway(true),
    },
    {
      id: "action-providers",
      label: "Direktni Provideri",
      description: "BYOK konekcije na OpenAI, Anthropic, Google i druge",
      icon: "🔗",
      category: "action",
      keywords: ["providers", "api", "key", "openai", "anthropic", "google", "byok", "direktno"],
      action: () => setShowProviders(true),
    },
    {
      id: "action-multi-agent",
      label: "Multi-Agent Sistem",
      description: "Upravljaj agentima, zadacima i workflow-ovima",
      icon: "🤖",
      category: "action",
      keywords: ["multi-agent", "agenti", "crewai", "langgraph", "workflow", "zadaci"],
      action: () => setShowMultiAgent(true),
    },
    {
      id: "home-center",
      label: "Home Center",
      description: "Centralno upravljanje svim alatima",
      icon: "🏠",
      category: "navigation",
      shortcut: "MOD+H",
      keywords: ["home", "dashboard", "centar", "početna", "alati"],
      action: () => setShowHomeCenter(true),
    },
    {
      id: "design-assets",
      label: "Design Assets",
      description: "Ikone, tokeni, SVG kolekcije, brand",
      icon: "🎨",
      category: "action",
      keywords: ["design", "assets", "ikone", "tokeni", "svg", "lucide", "brand"],
      action: () => setShowDesignAssets(true),
    },
    {
      id: "usage-cost",
      label: "Usage & Cost",
      description: "Troškovi, tokeni, budžeti, cjenovnik",
      icon: "📊",
      category: "action",
      keywords: ["usage", "cost", "troškovi", "budžet", "tokeni", "pricing", "billing"],
      action: () => setShowUsage(true),
    },
    {
      id: "runtime-manager",
      label: "Runtime Manager",
      description: "OpenCode, Crush, Claude Code — izaberi runtime",
      icon: "⚙",
      category: "action",
      keywords: ["runtime", "opencode", "crush", "engine", "switch", "mcp"],
      action: () => setShowRuntimeManager(true),
    },
    {
      id: "quick-start",
      label: "Quick Start",
      description: "Predlošci za brzi početak projekta",
      icon: "✨",
      category: "action",
      keywords: ["quick", "start", "template", "predložak", "scaffold", "projekat"],
      action: () => setShowQuickStart(true),
    },
    {
      id: "action-new-session",
      label: "Nova sesija",
      description: "Resetuj agent sesiju i započni novu",
      icon: "🔄",
      category: "action",
      keywords: ["session", "sesija", "novi", "reset", "restart"],
      action: () => {
        setDbSessionId(null);
        setAgentSessionId(null);
        setAgentMessages([]);
        setAgentTodos([]);
        setConfirmedSteps(new Set());
        setDiffCache({});
      },
    },
    {
      id: "action-session-history",
      label: "Prethodne sesije",
      description: "Prikaži i nastavi prethodne sesije",
      icon: "📋",
      category: "action",
      keywords: ["session", "sesija", "povijest", "nastavi", "resume"],
      action: () => setShowSessionPicker(true),
    },

    // Settings commands
    {
      id: "settings-permissions",
      label: "Agent dozvole",
      description: "Upravljaj dozvolama alata",
      icon: "⬡",
      category: "settings",
      keywords: ["permissions", "dozvole", "security", "alati"],
      action: () => setShowPermissionsModal(true),
    },
    {
      id: "settings-notifications",
      label: "Notifikacije",
      description: "Postavi notifikacije",
      icon: "🔔",
      category: "settings",
      keywords: ["notifications", "notifikacije", "obavijesti"],
      action: () => setShowNotifications(true),
    },
    {
      id: "settings-prompts",
      label: "Prompt Library",
      description: "Upravljaj promptima",
      icon: "📋",
      category: "settings",
      keywords: ["prompts", "prompt", "library", "biblioteka"],
      action: () => setShowPromptLibrary(true),
    },

    // Agent role commands
    {
      id: "role-developer",
      label: "Uloga: Developer",
      description: "Postavi agent ulogu na Developer",
      icon: "⌨",
      category: "action",
      keywords: ["role", "uloga", "developer", "kod"],
      action: () => setAgentRole("developer"),
    },
    {
      id: "role-designer",
      label: "Uloga: Designer",
      description: "Postavi agent ulogu na Designer",
      icon: "◆",
      category: "action",
      keywords: ["role", "uloga", "designer", "dizajn"],
      action: () => setAgentRole("designer"),
    },
    {
      id: "role-qa",
      label: "Uloga: QA",
      description: "Postavi agent ulogu na QA",
      icon: "◉",
      category: "action",
      keywords: ["role", "uloga", "qa", "test"],
      action: () => setAgentRole("qa"),
    },
    {
      id: "role-security",
      label: "Uloga: Security",
      description: "Postavi agent ulogu na Security Reviewer",
      icon: "⬡",
      category: "action",
      keywords: ["role", "uloga", "security", "sigurnost"],
      action: () => setAgentRole("security"),
    },
    {
      id: "role-marketing",
      label: "Uloga: Marketing",
      description: "Postavi agent ulogu na Marketing",
      icon: "▲",
      category: "action",
      keywords: ["role", "uloga", "marketing", "sadrzaj"],
      action: () => setAgentRole("marketing"),
    },

    // Navigation
    {
      id: "nav-dashboard",
      label: "Natrag na Dashboard",
      description: "Idi na početnu stranicu",
      icon: "←",
      category: "navigation",
      shortcut: "MOD+D",
      keywords: ["dashboard", "pocetna", "home"],
      action: () => window.location.href = "/dashboard",
    },
  ], [
    setPanelMode, setAskProvider, setAskModel, setAgentProvider, setAgentModel,
    setShowSshModal, setShowDeployModal, setShowExportModal, setShowEnvModal,
    setShowPermissionsModal, setShowNotifications, setShowPromptLibrary,
    setAgentRole, setShowRollback, setShowContext, setShowGateway, setShowProviders, setShowMultiAgent, setShowHomeCenter, setShowDesignAssets, setShowUsage, setShowRuntimeManager, setShowQuickStart,
  ]);

  return (
    <div className="h-full flex flex-col relative">
      <WorkspaceTopbar
        projectName="straxor-landing"
        template="react"
        status="active"
        orchestrator={orchestrator}
        onOrchestratorChange={setOrchestrator}
        vpsStatus={vpsStatus}
        onConnectVps={() => setShowSshModal(true)}
        onOpenEnv={() => setShowEnvModal(true)}
        onOpenDeploy={() => setShowDeployModal(true)}
        onOpenSettings={() => setShowPermissionsModal(true)}
        onOpenExport={() => setShowExportModal(true)}
        onOpenNotifications={() => setShowNotifications(true)}
        onOpenWorktrees={() => setShowWorktrees(true)}
        onOpenBrowserVerify={() => setShowBrowserVerify(true)}
        onOpenRollback={() => setShowRollback(true)}
        onOpenContext={() => setShowContext(true)}
        onOpenGateway={() => setShowGateway(true)}
        onOpenProviders={() => setShowProviders(true)}
        onOpenMultiAgent={() => setShowMultiAgent(true)}
        onOpenHomeCenter={() => setShowHomeCenter(true)}
        onOpenDesignAssets={() => setShowDesignAssets(true)}
        onOpenUsage={() => setShowUsage(true)}
        onOpenRuntimeManager={() => setShowRuntimeManager(true)}
        onOpenQuickStart={() => setShowQuickStart(true)}
      />

      {/* Mobile tab switcher */}
      <div className="flex border-b border-border bg-surface shrink-0 md:hidden">
        <button
          onClick={() => setMobileTab("ask")}
          className={`flex-1 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors flex items-center justify-center gap-1.5 ${
            mobileTab === "ask"
              ? "text-text border-accent-blue"
              : "text-text-muted border-transparent"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-accent-blue shrink-0" />
          Ask
        </button>
        <button
          onClick={() => setMobileTab("agent")}
          className={`flex-1 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors flex items-center justify-center gap-1.5 ${
            mobileTab === "agent"
              ? "text-text border-accent"
              : "text-text-muted border-transparent"
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
          Agent
        </button>
      </div>

      {/* Panels */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Ask panel */}
        <div
          className={`flex flex-col min-h-0 min-w-0 border-b md:border-b-0 md:border-r border-border ${
            panelMode === "agent-full"
              ? "hidden md:hidden"
              : panelMode === "ask-full"
              ? "flex-1"
              : mobileTab !== "ask"
              ? "hidden md:flex md:flex-1"
              : "flex-1"
          }`}
        >
          <ChatPanel
            title="Ask"
            icon="?"
            iconColor="blue"
            badge="chat"
            badgeColor="blue"
            providerId={askProvider}
            modelId={askModel}
            thinking={askThinking}
            planActMode={askPlanAct}
            onProviderChange={setAskProvider}
            onModelChange={setAskModel}
            onThinkingChange={setAskThinking}
            onPlanActChange={setAskPlanAct}
            messages={askMessages}
            inputPlaceholder={
              askHasKey ? "Pitaj bilo šta..." : "Prvo unesi API key..."
            }
            onSend={handleAskSend}
            loading={askLoading}
            streamingMessageId={askStreamingId}
            copyLabel="→ Copy to Agent"
            onCopyTo={(content) => setAgentPrefill(content)}
            prefill={askPrefill}
            isExpanded={panelMode === "ask-full"}
            onToggleExpand={toggleAskExpand}
          />
        </div>

        {/* Agent panel */}
        <div
          className={`flex flex-col min-h-0 min-w-0 ${
            panelMode === "ask-full"
              ? "hidden md:hidden"
              : panelMode === "agent-full"
              ? "flex-1"
              : mobileTab !== "agent"
              ? "hidden md:flex md:flex-1"
              : "flex-1"
          }`}
        >
          <ChatPanel
            title="Agent"
            icon="⚡"
            iconColor="accent"
            badge="build"
            providerId={agentProvider}
            modelId={agentModel}
            thinking={agentThinking}
            planActMode={agentPlanAct}
            onProviderChange={setAgentProvider}
            onModelChange={setAgentModel}
            onThinkingChange={setAgentThinking}
            onPlanActChange={setAgentPlanAct}
            messages={agentMessages}
            inputPlaceholder={
              agentMachineId
                ? "Naredi agentu šta da napravi..."
                : "Poveži VPS za agenta..."
            }
            onSend={handleAgentSend}
            loading={agentLoading}
            streamingMessageId={agentStreamingId}
            copyLabel="← Copy to Ask"
            onCopyTo={(content) => setAskPrefill(content)}
            prefill={agentPrefill}
            isExpanded={panelMode === "agent-full"}
            onToggleExpand={toggleAgentExpand}
            enablePlanPreview
            headerLeft={
              <RoleSelector role={agentRole} onChange={setAgentRole} />
            }
            headerContent={
              <>
                <TodoList
                  steps={agentTodos}
                  onConfirm={handleConfirmStep}
                  onExpand={handleExpandStep}
                  onVerified={handleVerified}
                  loading={agentLoading}
                  machineId={agentMachineId || undefined}
                  sessionId={agentSessionId || undefined}
                />
                {agentTodos.length > 0 && (
                  <div className="px-2 py-1.5 border-b border-border bg-surface">
                    <button
                      onClick={handleOpenDiffReview}
                      className="w-full py-1.5 text-[11px] font-medium rounded-lg border border-accent/30 bg-accent/5 text-accent hover:bg-accent/10 transition-colors"
                    >
                      Pregledaj promjene
                    </button>
                  </div>
                )}
                <div className="px-2 py-1.5 border-b border-border bg-surface">
                  <button
                    onClick={() => setShowPromptLibrary(true)}
                    className="w-full py-1.5 text-[11px] font-medium rounded-lg border border-border bg-surface-2 text-text-secondary hover:bg-surface-2/80 transition-colors"
                  >
                    📋 Prompt Library ({activePromptIds.size} aktivnih)
                  </button>
                </div>
              </>
            }
          />
        </div>
      </div>

      <BottomBar machineId={agentMachineId || null} />

      {/* SSH Modal */}
      {showSshModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4">
            <SshInput
              projectId="placeholder-project-id"
              onConnected={handleVpsConnected}
              onCancel={() => setShowSshModal(false)}
            />
          </div>
        </div>
      )}

      {/* Env Editor Modal */}
      {showEnvModal && (
        <EnvEditor
          projectId="placeholder-project-id"
          onClose={() => setShowEnvModal(false)}
        />
      )}

      {/* Deployment Panel Modal */}
      {showDeployModal && (
        <DeploymentPanel
          projectId="placeholder-project-id"
          onClose={() => setShowDeployModal(false)}
        />
      )}

      {/* Diff Review Modal */}
      {showDiffReview && (
        <DiffReview
          files={diffFiles}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setShowDiffReview(false)}
          loading={diffLoading}
        />
      )}

      {/* Permissions Panel */}
      {showPermissionsModal && (
        <PermissionsPanel onClose={() => setShowPermissionsModal(false)} />
      )}

      {/* Tool Confirmation Dialog */}
      {pendingTool && (
        <ToolConfirmDialog
          toolId={pendingTool.toolId}
          args={pendingTool.args}
          onAllow={pendingTool.onAllow}
          onDeny={pendingTool.onDeny}
        />
      )}

      {/* Prompt Library Modal */}
      {showPromptLibrary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[500px] mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <span className="text-[13px] font-semibold text-text">Prompt Library</span>
              <button
                onClick={() => setShowPromptLibrary(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <PromptLibrary
                projectId={undefined}
                onSelect={(p) => {
                  setActivePromptIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(p.id)) {
                      next.delete(p.id);
                    } else {
                      next.add(p.id);
                    }
                    return next;
                  });
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Security Scan Result Modal */}
      {securityVerdict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[500px] mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-[13px] font-semibold text-text">🔍 Sigurnosna provjera</span>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <SecurityScanResult
                verdict={securityVerdict}
                packageName={securityPackageName}
              />
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
              <button
                onClick={() => {
                  setSecurityVerdict(null);
                  setPendingInstallAllow(null);
                }}
                className="text-[11px] text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
              >
                Otkaži
              </button>
              {securityVerdict.verdict === "block" ? (
                <span className="text-[11px] text-red-400 px-3 py-1.5">
                  ⛔ Instalacija blokirana
                </span>
              ) : (
                <button
                  onClick={() => {
                    const allowFn = pendingInstallAllow;
                    setSecurityVerdict(null);
                    setPendingInstallAllow(null);
                    if (allowFn) allowFn();
                  }}
                  className={`text-[11px] text-white px-3 py-1.5 rounded-lg transition-colors ${
                    securityVerdict.verdict === "warn"
                      ? "bg-yellow-500 hover:bg-yellow-400"
                      : "bg-accent hover:bg-accent-light"
                  }`}
                >
                  {securityVerdict.verdict === "warn" ? "⚠ Nastavi unatoč upozorenju" : "✓ Nastavi instalaciju"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Panel */}
      {showExportModal && (
        <ExportPanel
          projectId="straxor-landing"
          machineId={agentMachineId || undefined}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showNotifications && (
        <NotificationSettings onClose={() => setShowNotifications(false)} />
      )}

      {showWorktrees && agentMachineId && (
        <WorktreeManager
          machineId={agentMachineId}
          onClose={() => setShowWorktrees(false)}
        />
      )}

      {showBrowserVerify && agentMachineId && (
        <BrowserVerifier
          machineId={agentMachineId}
          onClose={() => setShowBrowserVerify(false)}
        />
      )}

      {showRollback && agentMachineId && (
        <RollbackPanel
          machineId={agentMachineId}
          projectPath="/root/straxor-landing"
          onClose={() => setShowRollback(false)}
        />
      )}

      {showContext && (
        <ContextPanel
          projectId="straxor-landing"
          machineId={agentMachineId}
          projectPath="/root/straxor-landing"
          onClose={() => setShowContext(false)}
          onAssembled={(ctx) => {
            // Inject assembled context into next agent message
            setShowContext(false);
            if (ctx.systemPrompt) {
              setAgentPrefill(`[KONTEKST]\n${ctx.systemPrompt}\n[/KONTEKST]\n\n`);
            }
          }}
        />
      )}

      {showGateway && (
        <GatewayPanel onClose={() => setShowGateway(false)} />
      )}

      {showProviders && (
        <ProvidersPanel onClose={() => setShowProviders(false)} />
      )}

      {showMultiAgent && (
        <MultiAgentPanel onClose={() => setShowMultiAgent(false)} />
      )}

      {showHomeCenter && (
        <HomeCenter
          onClose={() => setShowHomeCenter(false)}
          onNavigate={(action) => {
            setShowHomeCenter(false);
            // Map tile actions to panel states
            const panelMap: Record<string, () => void> = {
              providers: () => setShowProviders(true),
              gateway: () => setShowGateway(true),
              "multi-agent": () => setShowMultiAgent(true),
              ssh: () => setShowSshModal(true),
              deploy: () => setShowDeployModal(true),
              worktrees: () => setShowWorktrees(true),
              prompts: () => setShowPromptLibrary(true),
              context: () => setShowContext(true),
              logs: () => window.dispatchEvent(new CustomEvent("straxor:open-logs")),
              console: () => window.dispatchEvent(new CustomEvent("straxor:open-console")),
              env: () => setShowEnvModal(true),
              permissions: () => setShowPermissionsModal(true),
              rollback: () => setShowRollback(true),
              notifications: () => setShowNotifications(true),
              export: () => setShowExportModal(true),
              sessions: () => setShowSessionPicker(true),
              theme: () => toggleTheme(),
              docs: () => window.open("https://straxor.dev/docs", "_blank"),
              "design-assets": () => setShowDesignAssets(true),
              "design-studio": () => setShowDesignStudio(true),
              "web-research": () => setShowWebResearch(true),
              usage: () => setShowUsage(true),
              "runtime-manager": () => setShowRuntimeManager(true),
              "quick-start": () => setShowQuickStart(true),
            };
            const handler = panelMap[action];
            if (handler) handler();
          }}
        />
      )}

      {showDesignAssets && (
        <DesignAssetsPanel onClose={() => setShowDesignAssets(false)} />
      )}

      {showDesignStudio && (
        <DesignStudio onClose={() => setShowDesignStudio(false)} />
      )}

      {showWebResearch && (
        <WebResearchPanel onClose={() => setShowWebResearch(false)} />
      )}

      {showUsage && (
        <UsagePanel onClose={() => setShowUsage(false)} />
      )}

      {showRuntimeManager && (
        <RuntimeSelector machineId={agentMachineId} onClose={() => setShowRuntimeManager(false)} />
      )}

      {showQuickStart && (
        <QuickStartPanel onClose={() => setShowQuickStart(false)} />
      )}

      {showSessionPicker && (
        <SessionPicker
          sessions={dbSessions}
          currentSessionId={dbSessionId}
          onSelect={async (session) => {
            setShowSessionPicker(false);
            setDbSessionId(session.id);
            if (session.opencodeSessionId) {
              setAgentSessionId(session.opencodeSessionId);
            }
            if (session.machineId) {
              setAgentMachineId(session.machineId);
              setVpsStatus("ready");
            }
            // Load full session with messages
            const full = await fetchSession(session.id);
            if (full?.messages) {
              setAgentMessages(restoreMessages(full.messages) as ChatMessage[]);
            }
            if (full?.todoSnapshot) {
              try { setAgentTodos(JSON.parse(full.todoSnapshot)); } catch {}
            }
            if (full?.agentConfig) {
              try {
                const cfg = JSON.parse(full.agentConfig);
                if (cfg.provider) setAgentProvider(cfg.provider);
                if (cfg.model) setAgentModel(cfg.model);
                if (cfg.role) setAgentRole(cfg.role);
              } catch {}
            }
          }}
          onNewSession={() => {
            setShowSessionPicker(false);
            setDbSessionId(null);
            setAgentSessionId(null);
            setAgentMessages([]);
            setAgentTodos([]);
            setConfirmedSteps(new Set());
          }}
          onDelete={async (id) => {
            await import("../lib/sessions.js").then((m) => m.deleteSession(id));
            setDbSessions((prev) => prev.filter((s) => s.id !== id));
            if (dbSessionId === id) {
              setDbSessionId(null);
              setAgentSessionId(null);
              setAgentMessages([]);
            }
          }}
          onClose={() => setShowSessionPicker(false)}
        />
      )}

      {/* Search Panel */}
      <SearchPanel
        machineId={agentMachineId}
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onFileSelect={(path, line) => {
          setShowSearch(false);
          // Open file in BottomBar editor — trigger by clicking Files tab
          // For now, log the path; full integration with EditorContainer comes later
          console.log("Open file:", path, "line:", line);
        }}
      />

      {/* Command Palette */}
      <CommandPalette
        commands={commands}
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />

      {/* Command Palette trigger hint */}
      {!showCommandPalette && (
        <button
          onClick={() => setShowCommandPalette(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface/80 backdrop-blur-sm text-[10px] text-text-muted hover:text-text-secondary hover:border-border-light transition-colors shadow-lg shadow-black/20 hidden md:flex"
          title="Command Palette (Ctrl+K)"
        >
          <kbd className="text-[9px] bg-surface-2 border border-border px-1 py-0.5 rounded font-mono">⌘K</kbd>
          <span>Komande</span>
        </button>
      )}
    </div>
  );
}
