import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import type { ChatMessage, ToolCall, OrchestratedResult } from "../components/workspace/ChatPanel.js";
import type { Attachment } from "../lib/attachments.js";
import type { ThinkingBudget } from "../lib/models.js";
import { PROVIDERS } from "../lib/models.js";
import { streamChat, hasApiKey, getApiKey } from "../lib/chat.js";
import { routeChat, orchestrateChat, type OrchestrateModel } from "../lib/orchestrator.js";
import { streamAgentMessage, fetchTodos, fetchDiff, approveChanges, rejectChanges, sendSteerInstruction, startAgentBackground, fetchBackgroundStatus, type BackgroundTimelineEntry } from "../lib/agent.js";
import { runAgentTurn } from "../lib/agent-turn.js";
import { listRepoConnections, type RepoConnection } from "../lib/repos.js";
import { fetchProjects } from "../lib/projects.js";
import { fetchPermissions, type PermissionConfig } from "../lib/permissions.js";
import { type AgentRole, getRoleById, fetchPrompts, type SavedPrompt } from "../lib/roles.js";
import { t, useLang } from "../lib/i18n.js";
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
import GitRemotePanel from "../components/workspace/GitRemotePanel.js";
import EnginePicker from "../components/workspace/EnginePicker.js";
import UsagePanel from "../components/workspace/UsagePanel.js";
import RuntimeSelector from "../components/workspace/RuntimeSelector.js";
import QuickStartPanel from "../components/workspace/QuickStartPanel.js";
import KanbanCommandCenter from "../components/workspace/KanbanCommandCenter.js";
import McpMarketplace from "../components/workspace/McpMarketplace.js";
import InfrastructurePanel from "../components/workspace/InfrastructurePanel.js";
import TeamPanel from "../components/workspace/TeamPanel.js";
import EnterpriseSecurity from "../components/workspace/EnterpriseSecurity.js";
import PluginManager from "../components/workspace/PluginManager.js";
import Marketplace from "../components/workspace/Marketplace.js";
import GlobalScalePanel from "../components/workspace/GlobalScalePanel.js";
import EnterpriseResilience from "../components/workspace/EnterpriseResilience.js";
import CollaboratorsPanel from "../components/workspace/CollaboratorsPanel.js";
import OrganizationDashboard from "../components/workspace/OrganizationDashboard.js";
import type { OrbState } from "thinking-orbs";
import AdminCenter from "../components/workspace/AdminCenter.js";
import VerificationPanel from "../components/workspace/VerificationPanel.js";
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
import { loadAppState, saveAppState, saveAppStateNow, type AppStateShape } from "../lib/app-state.js";

const INITIAL_ASK_MESSAGES: ChatMessage[] = [];

export default function Workspace() {
  const navigate = useNavigate();
  const { id: projectIdFromUrl } = useParams<{ id: string }>();
  const projectId = projectIdFromUrl || "";
  const [projectName, setProjectName] = useState<string>("straxor-landing");
  const projectPath = `/root/${projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "") || "straxor-landing"}`;

  useEffect(() => {
    if (!projectId) return;
    fetchProjects()
      .then((list) => {
        const found = list.find((p) => p.id === projectId);
        if (found) setProjectName(found.name);
      })
      .catch(() => {});
  }, [projectId]);

  const { toggleTheme, setTheme: setAppTheme, accent, setAccent, theme } = useTheme();
  useLang();
  const [askModelOrch, setAskModelOrch] = useState(() => localStorage.getItem("straxor.orch.ask") === "1");
  const [agentModelOrch, setAgentModelOrch] = useState(() => localStorage.getItem("straxor.orch.agent") === "1");
  const [askBackground, setAskBackground] = useState(() => localStorage.getItem("straxor.bg.ask") === "1");
  const [agentBackground, setAgentBackground] = useState(() => localStorage.getItem("straxor.bg.agent") === "1");

  useEffect(() => {
    localStorage.setItem("straxor.orch.ask", askModelOrch ? "1" : "0");
  }, [askModelOrch]);
  useEffect(() => {
    localStorage.setItem("straxor.orch.agent", agentModelOrch ? "1" : "0");
  }, [agentModelOrch]);
  useEffect(() => {
    localStorage.setItem("straxor.bg.ask", askBackground ? "1" : "0");
  }, [askBackground]);
  useEffect(() => {
    localStorage.setItem("straxor.bg.agent", agentBackground ? "1" : "0");
  }, [agentBackground]);

  // Per-panel multi-model orchestration (FAZA 5) selection + persistence.
  const [askOrchestratedModels, setAskOrchestratedModels] = useState<{ providerId: string; modelId: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem("straxor.orchModels.ask") || "[]"); } catch { return []; }
  });
  const [agentOrchestratedModels, setAgentOrchestratedModels] = useState<{ providerId: string; modelId: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem("straxor.orchModels.agent") || "[]"); } catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem("straxor.orchModels.ask", JSON.stringify(askOrchestratedModels));
  }, [askOrchestratedModels]);
  useEffect(() => {
    localStorage.setItem("straxor.orchModels.agent", JSON.stringify(agentOrchestratedModels));
  }, [agentOrchestratedModels]);

  const availableModels = useMemo(
    () =>
      PROVIDERS.map((p) => ({
        providerId: p.id,
        name: p.name,
        models: p.models.map((m) => ({ id: m.id, name: m.name })),
      })),
    []
  );

  const [askProvider, setAskProvider] = useState("anthropic");
  const [askModel, setAskModel] = useState("claude-haiku-4-5");
  const [askThinking, setAskThinking] = useState<ThinkingBudget>("medium");

  const [agentProvider, setAgentProvider] = useState("anthropic");
  const [agentModel, setAgentModel] = useState("claude-opus-5");
  const [agentThinking, setAgentThinking] = useState<ThinkingBudget>("high");

  const [askMessages, setAskMessages] = useState<ChatMessage[]>(INITIAL_ASK_MESSAGES);
  const [agentMessages, setAgentMessages] = useState<ChatMessage[]>([]);
  const [mobileTab, setMobileTab] = useState<"ask" | "agent">("ask");

  const [askStreamingId, setAskStreamingId] = useState<string | null>(null);
  const [agentStreamingId, setAgentStreamingId] = useState<string | null>(null);

  const [askLoading, setAskLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [askFocused, setAskFocused] = useState(false);
  // Once the local engine has failed and we switched to plain chat, avoid
  // retrying the (always-failing) local engine for subsequent messages.
  const agentDirectFallbackRef = useRef(false);

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
  const [showGitRemote, setShowGitRemote] = useState(false);
  const [gitRemoteSlot, setGitRemoteSlot] = useState<string | undefined>(undefined);
  const [showUsage, setShowUsage] = useState(false);
  const [showRuntimeManager, setShowRuntimeManager] = useState(false);
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
  const [showMcpMarketplace, setShowMcpMarketplace] = useState(false);
  const [showInfrastructure, setShowInfrastructure] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [showOrganization, setShowOrganization] = useState(false);
  const [showEnterprise, setShowEnterprise] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showScale, setShowScale] = useState(false);
  const [showResilience, setShowResilience] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
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
  const [askRole, setAskRole] = useState<AgentRole>("developer");
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

  // Ask panel session state (Ask is a full independent agent on the local
  // engine with its own slot/repo, parallel to Agent).
  const [askSessionId, setAskSessionId] = useState<string | null>(null);
  const [askMachineId, setAskMachineId] = useState<string | null>(null);
  const askDirectFallbackRef = useRef(false);

  // Active repo connection — when set and no VPS machine is configured, the
  // agent runs on the LOCAL engine inside the cloned repo (no VPS needed).
  const [activeRepo, setActiveRepo] = useState<RepoConnection | null>(null);
  const [askActiveRepo, setAskActiveRepo] = useState<RepoConnection | null>(null);

  const loadActiveRepo = useCallback(async () => {
    try {
      const conns = await listRepoConnections();
      const active = conns.find((c) => c.isActive && c.slot !== "ask") || conns.find((c) => c.isActive) || null;
      const askActive = conns.find((c) => c.isActive && c.slot === "ask") || null;
      console.log("[repo-debug] conns=", conns.map((c) => `${c.fullName}:active=${c.isActive}:slot=${c.slot}`).join(" | "));
      console.log("[repo-debug] active=", active?.fullName, "askActive=", askActive?.fullName);
      setActiveRepo(active);
      setAskActiveRepo(askActive);
      return active;
    } catch (e) {
      console.error("[repo-debug] loadActiveRepo error", e);
      return null;
    }
  }, []);

  // Load the active repo on mount.
  useEffect(() => {
    loadActiveRepo();
  }, [loadActiveRepo]);

  // ── Global app-state persistence (FAZA 2) ──
  const [stateReady, setStateReady] = useState(false);

  // Panel mode: split | ask-full | agent-full
  const [panelMode, setPanelMode] = useState<"split" | "ask-full" | "agent-full">(() => {
    try {
      const saved = localStorage.getItem("straxor.panelMode");
      if (saved === "ask-full" || saved === "agent-full") return saved;
    } catch {}
    return "split";
  });

  // Panel layout: side-by-side | stacked (persisted)
  const [panelsLayout, setPanelsLayout] = useState<"side" | "stack">(() => {
    try {
      const saved = localStorage.getItem("straxor.panelsLayout");
      return saved === "stack" ? "stack" : "side";
    } catch {
      return "side";
    }
  });

  // Ask panel width (side-by-side layout, resizable divider) — persisted
  const [panelWidthPct, setPanelWidthPct] = useState<number>(() => {
    try {
      const saved = parseInt(localStorage.getItem("straxor.panelWidth") || "", 10);
      return Number.isFinite(saved) ? Math.max(25, Math.min(75, saved)) : 50;
    } catch {
      return 50;
    }
  });
  const panelsRef = useRef<HTMLDivElement>(null);

  // Per-panel zoom (independent Ask/Agent) — persisted
  const readZoom = (key: string) => {
    try {
      const saved = parseFloat(localStorage.getItem(key) || "");
      return Number.isFinite(saved) ? Math.max(0.7, Math.min(1.5, saved)) : 1;
    } catch {
      return 1;
    }
  };
  const [askZoom, setAskZoom] = useState<number>(() => readZoom("straxor.zoom.ask"));
  const [agentZoom, setAgentZoom] = useState<number>(() => readZoom("straxor.zoom.agent"));

  const clampZoomPct = (z: number) => Math.max(0.7, Math.min(1.5, Math.round(z * 20) / 20));
  const handleAskZoomChange = (z: number) => setAskZoom(clampZoomPct(z));
  const handleAgentZoomChange = (z: number) => setAgentZoom(clampZoomPct(z));

  // Per-panel vertical zoom (top-down compression, independent of zoom)
  const readVerticalZoom = (key: string) => {
    try {
      const saved = parseFloat(localStorage.getItem(key) || "");
      return Number.isFinite(saved) ? Math.max(0.5, Math.min(1.5, saved)) : 1;
    } catch {
      return 1;
    }
  };
  const [askVerticalZoom, setAskVerticalZoom] = useState<number>(() => readVerticalZoom("straxor.vzoom.ask"));
  const [agentVerticalZoom, setAgentVerticalZoom] = useState<number>(() => readVerticalZoom("straxor.vzoom.agent"));

  const clampVerticalPct = (z: number) => Math.max(0.5, Math.min(1.5, Math.round(z * 20) / 20));
  const handleAskVerticalZoomChange = (z: number) => setAskVerticalZoom(clampVerticalPct(z));
  const handleAgentVerticalZoomChange = (z: number) => setAgentVerticalZoom(clampVerticalPct(z));

  // Per-panel accent color (overrides global accent for that panel)
  const readPanelAccent = (key: string): string => {
    try { return localStorage.getItem(key) || ""; } catch { return ""; }
  };
  const [askPanelAccent, setAskPanelAccent] = useState<string>(() => readPanelAccent("straxor.panelAccent.ask"));
  const [agentPanelAccent, setAgentPanelAccent] = useState<string>(() => readPanelAccent("straxor.panelAccent.agent"));
  const handleAskPanelAccentChange = (a: string) => { localStorage.setItem("straxor.panelAccent.ask", a); setAskPanelAccent(a); };
  const handleAgentPanelAccentChange = (a: string) => { localStorage.setItem("straxor.panelAccent.agent", a); setAgentPanelAccent(a); };

  // Per-panel height (independent Ask/Agent, % of panels row) — persisted
  const readPanelHeight = (key: string) => {
    try {
      const saved = parseInt(localStorage.getItem(key) || "", 10);
      return Number.isFinite(saved) ? Math.max(30, Math.min(100, saved)) : 100;
    } catch {
      return 100;
    }
  };
  const [askPanelHeightPct, setAskPanelHeightPct] = useState<number>(() =>
    readPanelHeight("straxor.panelHeight.ask")
  );
  const [agentPanelHeightPct, setAgentPanelHeightPct] = useState<number>(() =>
    readPanelHeight("straxor.panelHeight.agent")
  );

  // Load persisted state from the DB once on mount, then hydrate UI.
  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      const saved = await loadAppState();
      // Theme + accent
      if (saved && typeof saved === "object") {
        const s = saved as Record<string, unknown>;
        if (typeof s.theme === "string") setAppTheme(s.theme as "dark" | "light");
        if (typeof s.accent === "string") setAccent(s.accent as never);
        // Models per agent
        if (s.ask && typeof s.ask === "object") {
          const ask = s.ask as Record<string, unknown>;
          if (typeof ask.provider === "string") setAskProvider(ask.provider);
          if (typeof ask.model === "string") setAskModel(ask.model);
          if (ask.thinking === "low" || ask.thinking === "medium" || ask.thinking === "high") setAskThinking(ask.thinking);
          if (ask.role && typeof ask.role === "string") setAskRole(ask.role as AgentRole);
          if (typeof ask.orch === "boolean") setAskModelOrch(ask.orch);
        }
        if (s.agent && typeof s.agent === "object") {
          const agent = s.agent as Record<string, unknown>;
          if (typeof agent.provider === "string") setAgentProvider(agent.provider);
          if (typeof agent.model === "string") setAgentModel(agent.model);
          if (agent.thinking === "low" || agent.thinking === "medium" || agent.thinking === "high") setAgentThinking(agent.thinking);
          if (agent.role && typeof agent.role === "string") setAgentRole(agent.role as AgentRole);
          if (typeof agent.orch === "boolean") setAgentModelOrch(agent.orch);
        }
        // Panel / layout / zoom / height
        if (s.panelMode === "ask-full" || s.panelMode === "agent-full") setPanelMode(s.panelMode);
        if (s.panelsLayout === "stack") setPanelsLayout("stack");
        if (typeof s.panelWidthPct === "number") {
          const w = Math.max(25, Math.min(75, s.panelWidthPct));
          setPanelWidthPct(w);
        }
        if (typeof s.askZoom === "number") setAskZoom(Math.max(0.7, Math.min(1.5, s.askZoom)));
        if (typeof s.agentZoom === "number") setAgentZoom(Math.max(0.7, Math.min(1.5, s.agentZoom)));
        if (typeof s.askVerticalZoom === "number") setAskVerticalZoom(Math.max(0.5, Math.min(1.5, s.askVerticalZoom)));
        if (typeof s.agentVerticalZoom === "number") setAgentVerticalZoom(Math.max(0.5, Math.min(1.5, s.agentVerticalZoom)));
        if (typeof s.askHeight === "number") setAskPanelHeightPct(Math.max(30, Math.min(100, s.askHeight)));
        if (typeof s.agentHeight === "number") setAgentPanelHeightPct(Math.max(30, Math.min(100, s.agentHeight)));
      }
      if (mounted) setStateReady(true);
    };
    hydrate().catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Debounced save of the full UI state to the DB.
  useEffect(() => {
    if (!stateReady) return;
    const state: AppStateShape = {
      version: 1,
      theme,
      accent,
      ask: { provider: askProvider, model: askModel, thinking: askThinking, role: askRole, orch: askModelOrch },
      agent: { provider: agentProvider, model: agentModel, thinking: agentThinking, role: agentRole, orch: agentModelOrch },
      panelMode,
      panelsLayout,
      panelWidthPct,
      askZoom,
      agentZoom,
      askVerticalZoom,
      agentVerticalZoom,
      askHeight: askPanelHeightPct,
      agentHeight: agentPanelHeightPct,
    };
    saveAppState(state);
  }, [
    stateReady, theme, accent, askProvider, askModel, askThinking, askRole, askModelOrch,
    agentProvider, agentModel, agentThinking, agentRole, agentModelOrch,
    panelMode, panelsLayout, panelWidthPct, askZoom, agentZoom, askVerticalZoom, agentVerticalZoom, askPanelHeightPct, agentPanelHeightPct,
  ]);

  // Flush pending save when leaving the page.
  useEffect(() => {
    const handler = () => {
      saveAppStateNow({
        version: 1,
        theme, accent,
        ask: { provider: askProvider, model: askModel, thinking: askThinking, role: askRole, orch: askModelOrch },
        agent: { provider: agentProvider, model: agentModel, thinking: agentThinking, role: agentRole, orch: agentModelOrch },
        panelMode, panelLayout: panelsLayout, panelWidthPct,
        askZoom, agentZoom, askVerticalZoom, agentVerticalZoom, askHeight: askPanelHeightPct, agentHeight: agentPanelHeightPct,
      });
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [stateReady, theme, accent, askProvider, askModel, askThinking, askRole, askModelOrch,
    agentProvider, agentModel, agentThinking, agentRole, agentModelOrch,
    panelMode, panelsLayout, panelWidthPct, askZoom, agentZoom, askVerticalZoom, agentVerticalZoom, askPanelHeightPct, agentPanelHeightPct]);

  // Resolve the real host once.
  const isLocalHost =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  // When an active repo exists, point the agent at the local engine (so it can
  // run opencode/tools/git push) UNLESS we are on a remote host (Render/phone),
  // where there is no local runtime — in that case force local:opencode so the
  // localEngineOnRemote guard turns the panel into plain AI chat. We must NOT
  // keep a stale VPS machineId from a restored session here, otherwise the
  // agent panel would hang on a VPS that doesn't exist on this host.
  useEffect(() => {
    if (activeRepo) {
      setAgentMachineId((prev) =>
        !isLocalHost || prev?.startsWith("local:") ? "local:opencode" : prev
      );
      console.log("[machine-debug] agent activeRepo=", activeRepo.fullName, "-> local:opencode", isLocalHost ? "(localhost)" : "(remote)");
    } else {
      setAgentMachineId((prev) => (prev && prev.startsWith("local:") ? null : prev));
      console.log("[machine-debug] agent no activeRepo -> clearing local");
    }
  }, [activeRepo, isLocalHost]);

  // Ask panel is a full independent agent on its own slot. When an active
  // repo exists for the ask slot, point it at the local engine (:ask).
  useEffect(() => {
    if (askActiveRepo) {
      setAskMachineId((prev) => (prev && !prev.startsWith("local:") ? prev : "local:opencode:ask"));
      console.log("[machine-debug] ask activeRepo=", askActiveRepo.fullName, "-> local:opencode:ask");
    } else {
      setAskMachineId((prev) => (prev && prev.startsWith("local:") ? null : prev));
      console.log("[machine-debug] ask no activeRepo -> clearing local");
    }
  }, [askActiveRepo]);

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

  const clampPanelHeight = (v: number) => Math.max(30, Math.min(100, v));
  const startPanelHeightResize = (e: React.MouseEvent, which: "ask" | "agent") => {
    e.preventDefault();
    const container = panelsRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startY = e.clientY;
    const onMove = (ev: MouseEvent) => {
      // The panel's top edge follows the cursor; the bottom edge stays fixed.
      const top = startY - rect.top + (ev.clientY - startY);
      const pct = ((rect.height - top) / rect.height) * 100;
      const clamped = clampPanelHeight(pct);
      if (which === "ask") setAskPanelHeightPct(clamped);
      else setAgentPanelHeightPct(clamped);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const startPanelResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = panelsRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setPanelWidthPct(Math.max(25, Math.min(75, pct)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Diff review modal
  const [showDiffReview, setShowDiffReview] = useState(false);
  const [diffFiles, setDiffFiles] = useState<DiffFile[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);

  // Check API key status when provider changes
  useEffect(() => {
    hasApiKey(askProvider).then(setAskHasKey);
  }, [askProvider]);

  // Persist panel layout choice
  useEffect(() => {
    try {
      localStorage.setItem("straxor.panelsLayout", panelsLayout);
    } catch {}
  }, [panelsLayout]);

  // Persist resized panel width
  useEffect(() => {
    try {
      localStorage.setItem("straxor.panelWidth", String(panelWidthPct));
    } catch {}
  }, [panelWidthPct]);

  // Persist per-panel zoom
  useEffect(() => {
    try {
      localStorage.setItem("straxor.zoom.ask", String(askZoom));
    } catch {}
  }, [askZoom]);
  useEffect(() => {
    try {
      localStorage.setItem("straxor.zoom.agent", String(agentZoom));
    } catch {}
  }, [agentZoom]);

  // Persist per-panel vertical zoom
  useEffect(() => {
    try {
      localStorage.setItem("straxor.vzoom.ask", String(askVerticalZoom));
    } catch {}
  }, [askVerticalZoom]);
  useEffect(() => {
    try {
      localStorage.setItem("straxor.vzoom.agent", String(agentVerticalZoom));
    } catch {}
  }, [agentVerticalZoom]);

  // Persist per-panel height
  useEffect(() => {
    try {
      localStorage.setItem("straxor.panelHeight.ask", String(askPanelHeightPct));
    } catch {}
  }, [askPanelHeightPct]);
  useEffect(() => {
    try {
      localStorage.setItem("straxor.panelHeight.agent", String(agentPanelHeightPct));
    } catch {}
  }, [agentPanelHeightPct]);

  // Persist panel mode (expand/fullscreen)
  useEffect(() => {
    try {
      localStorage.setItem("straxor.panelMode", panelMode);
    } catch {}
  }, [panelMode]);

  // Escape exits expanded/fullscreen mode
  useEffect(() => {
    if (panelMode === "split") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelMode("split");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panelMode]);

  // Load permissions and saved prompts on mount
  useEffect(() => {
    fetchPermissions().then(setPermissions);
    fetchPrompts().then(setSavedPrompts);
  }, []);

  // Resume system — load sessions on mount
  useEffect(() => {
    const PROJECT_ID = projectId || "straxor-landing";
    fetchSessions(PROJECT_ID).then(setDbSessions);
  }, [projectId]);

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

      // Restore OpenCode session ID — only meaningful for a VPS machine.
      // A restored session ID belongs to a specific machine; reusing it on the
      // local engine would cause the SSE filter to discard every event.
      if (full.machineId && !full.machineId.startsWith("local:")) {
        if (full.opencodeSessionId) {
          setAgentSessionId(full.opencodeSessionId);
        }
      }

      // Restore machine ID — but only for a real VPS machine. Local engines
      // ("local:*") are assigned automatically from the active repo for each
      // panel slot, so restoring one here would override the agent panel with
      // the ask-slot engine (or vice-versa) and leave it unresponsive.
      if (full.machineId && !full.machineId.startsWith("local:")) {
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
        } catch {}
      }

      // Restore ask config
      if (full.askConfig) {
        try {
          const cfg = JSON.parse(full.askConfig);
          if (cfg.provider) setAskProvider(cfg.provider);
          if (cfg.model) setAskModel(cfg.model);
          if (cfg.thinking) setAskThinking(cfg.thinking);
          if (cfg.role) setAskRole(cfg.role);
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

  const isAgentSteerable = !!agentSessionId && !!agentMachineId && agentLoading;

  // Single source of truth for the Agent panel's ThinkingOrb state. Maps the
  // live run (last assistant message tool-call status + loading flag) to one of
  // the nine orb states so the indicator reflects real work, not decoration.
  const agentStatusOrb = useMemo<{ state: OrbState; label: string } | null>(() => {
    if (!agentLoading && !agentStreamingId) return null;
    let running: string | null = null;
    for (let i = agentMessages.length - 1; i >= 0 && !running; i--) {
      const m = agentMessages[i];
      if (m.role !== "assistant" || !m.toolCalls?.length) continue;
      const active = m.toolCalls.find((t) => t.status === "running" || t.status === "pending");
      if (active) running = active.name;
    }
    if (!running) return { state: "composing", label: "Generišem…" };
    const name = running.toLowerCase();
    if (/(search|grep|glob|find|read|list|ls|browse|fetch)/.test(name)) {
      return { state: "searching", label: "Pretražujem kod…" };
    }
    if (/(write|edit|create|touch|append|patch|rename)/.test(name)) {
      return { state: "composing", label: "Pišem kod…" };
    }
    if (/(test|build|verify|check|lint|run|execute|compile)/.test(name)) {
      return { state: "solving", label: "Verifikujem…" };
    }
    if (/(plan|think|reason|todo)/.test(name)) {
      return { state: "working", label: "Razmišljam…" };
    }
    return { state: "working", label: "Radim…" };
  }, [agentLoading, agentStreamingId, agentMessages]);

  const handleSteerSend = useCallback(async (msg: string) => {
    if (!agentMachineId || !agentSessionId) return;

    // Echo user message in Ask panel
    const userMsg: ChatMessage = { id: `steer-${Date.now()}`, role: "user", content: msg, label: "Steer \u2192 Agent" };
    setAskMessages((prev) => [...prev, userMsg]);

    try {
      await sendSteerInstruction(agentMachineId, agentSessionId, msg);

      // Add system acknowledgment
      const ackMsg: ChatMessage = {
        id: `steer-ack-${Date.now()}`,
        role: "assistant",
        content: `\u2192 ${t("chat.steer.sent")}`,
        label: "System",
      };
      setAskMessages((prev) => [...prev, ackMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `steer-err-${Date.now()}`,
        role: "assistant",
        content: `\u26A0 ${t("chat.steer.error")} ${err.message}`,
        label: "System",
      };
      setAskMessages((prev) => [...prev, errMsg]);
    }
  }, [agentMachineId, agentSessionId]);

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

  const handleAskSend = useCallback(async (msg: string, attachments?: Attachment[]) => {
    const userMsg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: "user",
      content: msg,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };
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

    // Ask is a full independent agent on its own local engine/slot. When a
    // machine is configured (e.g. active repo for the ask slot → local engine),
    // run the full agent turn (SSE, tools, permissions) instead of plain chat.
    const localAskEngineOnRemote = !!askMachineId?.startsWith("local:") && !isLocalHost;
    if (askMachineId && !localAskEngineOnRemote && !askDirectFallbackRef.current) {
      await runAgentTurn(msg, attachments, {
        role: askRole,
        provider: askProvider,
        model: askModel,
        thinking: askThinking,
        background: askBackground,
        machineId: askMachineId,
        sessionId: askSessionId,
        setSessionId: setAskSessionId,
        messages: askMessages,
        setMessages: setAskMessages,
        assistantMsgId: assistantMsg.id,
        setStreamingId: setAskStreamingId,
        setLoading: setAskLoading,
        setPrefill: setAskPrefill,
        permissions,
        activePromptIds,
        savedPrompts,
        projectId,
        dbSessionId,
        createDbSession: async () => {
          try {
            const PROJECT_ID = projectId || "straxor-landing";
            const sess = await createSession(
              PROJECT_ID,
              askMachineId,
              msg.slice(0, 100),
              { provider: askProvider, model: askModel, thinking: askThinking, role: askRole },
              { provider: agentProvider, model: agentModel, thinking: agentThinking, role: agentRole }
            );
            setDbSessionId(sess.id);
            fetchSessions(PROJECT_ID).then(setDbSessions);
            return sess.id;
          } catch {
            return null;
          }
        },
        saveMessage,
        updateSession,
        onToolAllow: proceedToolAllow,
        setPendingTool,
        setSecurityPackageName,
        setPendingInstallAllow,
        setSecurityVerdict,
        checkBeforeInstall,
        onRefreshTodos: () => {},
        onErrorFallback: (error) => {
          if (askMachineId?.startsWith("local:") && !askDirectFallbackRef.current) {
            askDirectFallbackRef.current = true;
            setAskLoading(false);
            setAskStreamingId(null);
            setAskMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
            handleAskSend(msg, attachments);
            return;
          }
          setAskMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + `\n\n[Greška: ${error}]` }
                : m
            )
          );
          setAskStreamingId(null);
          setAskLoading(false);
        },
      }).catch((error) => {
        const message = error instanceof Error ? error.message : "Network error";
        setAskMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: m.content + `\n\n[Greška: ${message}]` }
              : m
          )
        );
        setAskStreamingId(null);
        setAskLoading(false);
      });
      return;
    }

    askDirectFallbackRef.current = false;

    // Model orkestracija — route to best model for this task's difficulty.
    // Skipped when images are attached (router is text-only and may pick a
    // non-vision model); image messages use the user's selected model.
    let provider = askProvider;
    let model = askModel;

    const roleConfig = getRoleById(askRole);
    const history: { role: "user" | "assistant" | "system"; content: string }[] = [
      {
        role: "system",
        content: `[SISTEMSKA ULOGA: ${roleConfig.label}]\n${roleConfig.systemPrompt}`,
      },
      ...askMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      userMsg,
    ];

    // FAZA 5: parallel multi-model execution when 2+ models selected and no
    // attachments (attachments break the shared-message fan-out for text-only
    // orchestration).
    if (askOrchestratedModels.length >= 2 && (!attachments || attachments.length === 0)) {
      const results: OrchestratedResult[] = askOrchestratedModels.map((m) => {
        const providerDef = availableModels.find((p) => p.providerId === m.providerId);
        const label = providerDef?.models.find((mm) => mm.id === m.modelId)?.name || m.modelId;
        return { modelId: m.modelId, label, content: "", done: false };
      });
      setAskMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, orchestrated: results } : m))
      );

      const models: OrchestrateModel[] = [];
      for (const sel of askOrchestratedModels) {
        const key = await getApiKey(sel.providerId).catch(() => null);
        models.push({ providerId: sel.providerId, modelId: sel.modelId, apiKey: key || "" });
      }

      try {
        for await (const part of orchestrateChat(models, history, askThinking, attachments)) {
          if (part.error !== undefined) {
            setAskMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id && m.orchestrated
                  ? {
                      ...m,
                      orchestrated: m.orchestrated.map((r, i) =>
                        i === part.modelIndex ? { ...r, error: part.error!, done: true } : r
                      ),
                    }
                  : m
              )
            );
            continue;
          }
          if (part.token) {
            setAskMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id && m.orchestrated
                  ? {
                      ...m,
                      orchestrated: m.orchestrated.map((r, i) =>
                        i === part.modelIndex ? { ...r, content: r.content + part.token! } : r
                      ),
                    }
                  : m
              )
            );
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setAskMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id && m.orchestrated
              ? {
                  ...m,
                  orchestrated: m.orchestrated.map((r) => ({ ...r, error: message, done: true })),
                }
              : m
          )
        );
      }
      // Mark each model complete (generator ended) unless already errored.
      setAskMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id && m.orchestrated
            ? {
                ...m,
                orchestrated: m.orchestrated.map((r) => ({ ...r, done: true })),
              }
            : m
        )
      );
      setAskStreamingId(null);
      setAskLoading(false);
      return;
    }

    if (askModelOrch && (!attachments || attachments.length === 0)) {
      try {
        const route = await routeChat(msg, askThinking);
        if (route.routed && route.providerId && route.modelId) {
          provider = route.providerId;
          model = route.modelId;
        }
      } catch {}
    }

    // Reflect the actual routed model in the message label.
    if (model !== askModel) {
      setAskMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, label: model } : m))
      );
    }

    streamChat(provider, model, history, askThinking, {
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
    }, attachments);
  }, [askProvider, askModel, askThinking, askRole, askMessages, askModelOrch, askOrchestratedModels, availableModels, askMachineId, askSessionId, askBackground, agentProvider, agentModel, agentThinking, agentRole, permissions, activePromptIds, savedPrompts, projectId, dbSessionId, proceedToolAllow]);

  const handleAgentSend = useCallback(async (msg: string, attachments?: Attachment[]) => {
    const roleConfig = getRoleById(agentRole);
    const activePrompts = savedPrompts.filter((p) => activePromptIds.has(p.id));

    const userMsg: ChatMessage = {
      id: `g-${Date.now()}`,
      role: "user",
      content: msg,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };
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

    // On a remote host (Render / phone) there is no local opencode runtime, so
    // the Agent panel must run as plain AI chat (exactly like the Ask panel).
    // The local `opencode` engine is only used when served from localhost.
    const localEngineOnRemote = !!agentMachineId?.startsWith("local:") && !isLocalHost;
    if (!agentMachineId || localEngineOnRemote || agentDirectFallbackRef.current) {
      // FAZA 5: parallel multi-model execution when 2+ models selected.
      if (agentOrchestratedModels.length >= 2 && (!attachments || attachments.length === 0)) {
        const systemParts: string[] = [];
        systemParts.push(`[SISTEMSKA ULOGA: ${roleConfig.label}]\n${roleConfig.systemPrompt}`);
        for (const p of activePrompts) {
          systemParts.push(`[${p.name}]\n${p.content}`);
        }
        const history: { role: "user" | "assistant" | "system"; content: string }[] = [
          { role: "system", content: systemParts.join("\n\n") },
          ...agentMessages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          userMsg,
        ];

        const results: OrchestratedResult[] = agentOrchestratedModels.map((m) => {
          const providerDef = availableModels.find((p) => p.providerId === m.providerId);
          const label = providerDef?.models.find((mm) => mm.id === m.modelId)?.name || m.modelId;
          return { modelId: m.modelId, label, content: "", done: false };
        });
        setAgentMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, orchestrated: results } : m))
        );

        const models: OrchestrateModel[] = [];
        for (const sel of agentOrchestratedModels) {
          const key = await getApiKey(sel.providerId).catch(() => null);
          models.push({ providerId: sel.providerId, modelId: sel.modelId, apiKey: key || "" });
        }

        const applyAsk = (updater: (results: OrchestratedResult[]) => OrchestratedResult[]) => {
          setAgentMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id && m.orchestrated
                ? { ...m, orchestrated: updater(m.orchestrated) }
                : m
            )
          );
        };

        try {
          for await (const part of orchestrateChat(models, history, agentThinking, attachments)) {
            if (part.error !== undefined) {
              applyAsk((rs) =>
                rs.map((r, i) => (i === part.modelIndex ? { ...r, error: part.error!, done: true } : r))
              );
              continue;
            }
            if (part.token) {
              applyAsk((rs) =>
                rs.map((r, i) =>
                  i === part.modelIndex ? { ...r, content: r.content + part.token! } : r
                )
              );
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Network error";
          applyAsk((rs) => rs.map((r) => ({ ...r, error: message, done: true })));
        }
        applyAsk((rs) => rs.map((r) => ({ ...r, done: true })));
        setAgentStreamingId(null);
        setAgentLoading(false);
        return;
      }

      // Model orkestracija — route to best model for this task's difficulty.
      // Skipped when images are attached (router may pick a non-vision model).
      let provider = agentProvider;
      let model = agentModel;
      if (agentModelOrch && (!attachments || attachments.length === 0)) {
        try {
          const route = await routeChat(msg, agentThinking);
          if (route.routed && route.providerId && route.modelId) {
            provider = route.providerId;
            model = route.modelId;
          }
        } catch {}
      }

      // Reflect the actual routed model in the message label.
      if (model !== agentModel) {
        setAgentMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, label: model } : m))
        );
      }

      const systemParts: string[] = [];
      systemParts.push(`[SISTEMSKA ULOGA: ${roleConfig.label}]\n${roleConfig.systemPrompt}`);
      for (const p of activePrompts) {
        systemParts.push(`[${p.name}]\n${p.content}`);
      }
      const history: { role: "user" | "assistant" | "system"; content: string }[] = [
        { role: "system", content: systemParts.join("\n\n") },
        ...agentMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        userMsg,
      ];

      streamChat(provider, model, history, agentThinking, {
        onToken: (token) => {
          setAgentMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: m.content + token } : m
            )
          );
        },
        onDone: () => {
          setAgentStreamingId(null);
          setAgentLoading(false);
        },
        onError: (error) => {
          setAgentMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: `[Greška: ${error}]` }
                : m
            )
          );
          setAgentStreamingId(null);
          setAgentLoading(false);
        },
      }, attachments);
      return;
    }

    // VPS connected — full agent flow.
    // Auto-create DB session on first message
    let activeDbSessionId = dbSessionId;
    if (!activeDbSessionId) {
      try {
        const PROJECT_ID = projectId || "straxor-landing";
        const sess = await createSession(
          PROJECT_ID,
          agentMachineId,
          msg.slice(0, 100),
          { provider: agentProvider, model: agentModel, thinking: agentThinking, role: agentRole },
          { provider: askProvider, model: askModel, thinking: askThinking, role: askRole }
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
    const systemParts: string[] = [];
    systemParts.push(`[SISTEMSKA ULOGA: ${roleConfig.label}]\n${roleConfig.systemPrompt}`);
    for (const p of activePrompts) {
      systemParts.push(`[${p.name}]\n${p.content}`);
    }
    const fullMsg =
      systemParts.length > 0
        ? `${systemParts.join("\n\n")}\n\n---\n\n${msg}`
        : msg;

    // FAZA 6: background execution — fire-and-forget server-side run + polling.
    if (agentBackground) {
      const statusRef = { timeline: [] as BackgroundTimelineEntry[] };
      const applyTimeline = () => {
        setAgentMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  content: statusRef.timeline
                    .filter((e) => e.t === "text")
                    .map((e) => e.content || "")
                    .join(""),
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

      const poll = async (jobId: string, sessionId: string) => {
        let attempts = 0;
        const timer = window.setInterval(async () => {
          if (attempts++ > 2400) { window.clearInterval(timer); setAgentStreamingId(null); setAgentLoading(false); return; }
          try {
            const st = await fetchBackgroundStatus(jobId);
            if (st.timeline.length !== statusRef.timeline.length) {
              statusRef.timeline = st.timeline;
              applyTimeline();
            }
            if (st.finished) {
              window.clearInterval(timer);
              if (st.status === "error" && st.error) {
                setAgentMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, content: `[Greška: ${st.error}]` } : m
                  )
                );
              }
              setAgentStreamingId(null);
              setAgentLoading(false);
            }
          } catch {}
        }, 1500);
      };

      try {
        const started = await startAgentBackground(agentMachineId, fullMsg, agentSessionId, attachments);
        setAgentSessionId(started.sessionId);
        statusRef.timeline = [];
        await poll(started.jobId, started.sessionId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setAgentMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: `[Greška: ${message}]` } : m))
        );
        setAgentStreamingId(null);
        setAgentLoading(false);
      }
      return;
    }

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
            agentConfig: JSON.stringify({ provider: agentProvider, model: agentModel, thinking: agentThinking, role: agentRole }),
            activePromptIds: JSON.stringify(Array.from(activePromptIds)),
          }).catch(() => {});
        }
      },
      onError: (error) => {
        // If a *local* engine (local:opencode) couldn't start — e.g. opencode isn't
        // installed, the GitHub token can't be decrypted, or there are no API keys —
        // silently switch this panel to plain AI chat instead of leaving it silent.
        if (agentMachineId?.startsWith("local:") && !agentDirectFallbackRef.current) {
          agentDirectFallbackRef.current = true;
          setAgentLoading(false);
          handleAgentSend(msg, attachments);
          return;
        }
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
    }, attachments);
  }, [agentMachineId, agentSessionId, agentModel, refreshTodos, permissions, agentRole, savedPrompts, activePromptIds, dbSessionId, agentProvider, agentThinking, askProvider, askModel, askThinking, agentMessages, agentModelOrch, agentOrchestratedModels, availableModels, agentBackground]);

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
      action: () => { setAskProvider("anthropic"); setAskModel("claude-sonnet-4-6"); },
    },
    {
      id: "model-opus",
      label: "Switch to Claude Opus",
      description: "Agent panel → Claude Opus",
      icon: "◆",
      category: "model",
      keywords: ["model", "opus", "claude", "anthropic"],
      action: () => { setAgentProvider("anthropic"); setAgentModel("claude-opus-5"); },
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
      id: "kanban",
      label: "Komandni Centar",
      description: "Kanban pregled sesija, deployeva i VPS-a",
      icon: "📋",
      category: "action",
      keywords: ["kanban", "komandni", "centar", "board", "sesije", "deploy", "vps"],
      action: () => setShowKanban(true),
    },
    {
      id: "mcp-marketplace",
      label: "MCP Marketplace",
      description: "MCP server registry — instaliraj i upravljaj MCP serverima",
      icon: "🔌",
      category: "action",
      keywords: ["mcp", "marketplace", "server", "firecrawl", "database", "docs", "extension"],
      action: () => setShowMcpMarketplace(true),
    },
    {
      id: "infrastructure",
      label: "Infrastructure",
      description: "DNS, SSL, Proxy, Tunnel, Monitoring & Alerts",
      icon: "🏗",
      category: "action",
      keywords: ["infrastructure", "infra", "dns", "ssl", "proxy", "tunnel", "monitoring", "alert"],
      action: () => setShowInfrastructure(true),
    },
    {
      id: "teams",
      label: "Team Collaboration",
      description: "Timovi, RBAC, deljenje projekata, kod komentari",
      icon: "👥",
      category: "action",
      keywords: ["team", "tim", "collaboration", "saradnja", "rbac", "member"],
      action: () => setShowTeams(true),
    },
    {
      id: "organization",
      label: "Organization Dashboard",
      description: "Organizacije, budžeti, deljeni API ključevi, security politike",
      icon: "🏢",
      category: "action",
      keywords: ["organization", "org", "billing", "budget", "company", "company"],
      action: () => setShowOrganization(true),
    },
    {
      id: "enterprise",
      label: "Enterprise Security & Compliance",
      description: "Audit log, SSO/SAML, enkripcija, compliance, privatni deployment",
      icon: "🏭",
      category: "action",
      keywords: ["enterprise", "security", "audit", "sso", "saml", "compliance", "encryption", "deployment", "air-gapped"],
      action: () => setShowEnterprise(true),
    },
    {
      id: "plugins",
      label: "Plugin Manager & SDK",
      description: "Custom plugini, adapteri, UI dodaci, SDK dokumentacija",
      icon: "🧩",
      category: "action",
      keywords: ["plugin", "sdk", "extension", "addon", "marketplace", "custom"],
      action: () => setShowPlugins(true),
    },
    {
      id: "marketplace",
      label: "Marketplace & Community Templates",
      description: "Template-i, agenti, promptovi, MCP serveri, radni okviri od zajednice",
      icon: "🏪",
      category: "action",
      keywords: ["marketplace", "community", "template", "share", "publish", "template"],
      action: () => setShowMarketplace(true),
    },
    {
      id: "scale",
      label: "Global Scale & High Availability",
      description: "Runtime nodovi, load balancer, failover, auto-scaling politike",
      icon: "🌍",
      category: "action",
      keywords: ["scale", "ha", "cluster", "node", "load balancer", "failover", "distributed", "availability"],
      action: () => setShowScale(true),
    },
    {
      id: "resilience",
      label: "Enterprise Resilience & Offline Mode",
      description: "Secrets vault, budget guardrails, disaster recovery, air-gapped mode",
      icon: "🛡",
      category: "action",
      keywords: ["resilience", "vault", "secrets", "guardrail", "budget", "disaster", "backup", "snapshot", "offline", "air-gapped", "encryption"],
      action: () => setShowResilience(true),
    },
    {
      id: "admin",
      label: "Admin Control Center",
      description: "Feature flags, tariffi, wallet, pretplate, promo kodovi, registry",
      icon: "🛡",
      category: "action",
      keywords: ["admin", "control", "flags", "tariffs", "billing", "wallet", "registry"],
      action: () => navigate("/admin"),
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
    navigate,
    setPanelMode, setAskProvider, setAskModel, setAgentProvider, setAgentModel,
    setShowSshModal, setShowDeployModal, setShowExportModal, setShowEnvModal,
    setShowPermissionsModal, setShowNotifications, setShowPromptLibrary,
    setAgentRole, setShowRollback, setShowContext, setShowGateway, setShowProviders, setShowMultiAgent, setShowHomeCenter, setShowDesignAssets, setShowUsage, setShowRuntimeManager, setShowQuickStart, setShowKanban, setShowMcpMarketplace, setShowInfrastructure, setShowTeams, setShowOrganization, setShowEnterprise, setShowPlugins, setShowMarketplace, setShowScale, setShowResilience, setShowAdmin,
  ]);

  return (
    <div className="h-full flex flex-col relative">
      {!stateReady && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-border-light border-t-accent rounded-full animate-spin" />
            <span className="text-[13px] text-text-muted">Učitavam radni prostor…</span>
          </div>
        </div>
      )}
      <WorkspaceTopbar
        projectName={projectName}
        template="react"
        status="active"
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
          onOpenImage={() => navigate(`/project/${projectIdFromUrl || "unknown"}/image`)}
          onOpenImageAgent={() => navigate(`/project/${projectIdFromUrl || "unknown"}/image-agent`)}
          onOpenVerification={() => setShowVerification(true)}
          onOpenKnowledge={() => navigate(`/project/${projectIdFromUrl || "unknown"}/knowledge`)}
        />

      {/* Mobile tab switcher — pill segmented control */}
      <div className="flex items-center gap-1 px-2 py-2 bg-surface-2 rounded-[20px] mx-2 mb-1 shrink-0 md:hidden">
        <button
          onClick={() => {
            setMobileTab("ask");
            setPanelMode("split");
          }}
          className={`flex-1 py-2 text-[13px] font-semibold rounded-full transition-colors flex items-center justify-center gap-1.5 ${
            mobileTab === "ask"
              ? "bg-accent text-white"
              : "text-text-muted hover:text-text hover:bg-surface-3"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${mobileTab === "ask" ? "bg-white/80" : "bg-accent"} shrink-0`} />
          {t("agent.panel1")}
        </button>
        <button
          onClick={() => {
            setMobileTab("agent");
            setPanelMode("split");
          }}
          className={`flex-1 py-2 text-[13px] font-semibold rounded-full transition-colors flex items-center justify-center gap-1.5 ${
            mobileTab === "agent"
              ? "bg-accent text-white"
              : "text-text-muted hover:text-text hover:bg-surface-3"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${mobileTab === "agent" ? "bg-white/80" : "bg-accent"} shrink-0`} />
          {t("agent.panel2")}
        </button>
      </div>

      {/* Panels */}
      <div
        ref={panelsRef}
        className="flex-1 flex flex-col min-h-0 overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3"
      >
        {/* Layout toggle — visible on all screens; stacked stays automatic on mobile */}
        <div
          className={`flex items-center justify-end gap-1 px-2 py-1 rounded-xl border border-border bg-surface-2 shrink-0 transition-opacity ${
            panelMode !== "split" ? "hidden" : ""
          }`}
        >
          <div className="flex items-center gap-0.5 bg-surface-2 rounded-lg p-0.5">
            <button
              onClick={() => setPanelsLayout("side")}
              title={t("layout.side")}
              aria-label={t("layout.side")}
              className={`w-8 h-6 rounded-md flex items-center justify-center text-[13px] transition-colors ${
                panelsLayout === "side"
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:text-text hover:bg-surface"
              }`}
            >
              ▤
            </button>
            <button
              onClick={() => setPanelsLayout("stack")}
              title={t("layout.stack")}
              aria-label={t("layout.stack")}
              className={`w-8 h-6 rounded-md flex items-center justify-center text-[13px] transition-colors ${
                panelsLayout === "stack"
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:text-text hover:bg-surface"
              }`}
            >
              ▥
            </button>
          </div>
          <span className="hidden sm:inline text-[10px] text-text-muted ml-1">
            {panelsLayout === "side" ? t("layout.sideLabel") : t("layout.stackLabel")}
          </span>
        </div>

        {/* Panels row */}
        <div
          ref={panelsRef}
          className={`flex-1 flex flex-col min-h-0 min-w-0 gap-3 sm:gap-4 ${
            panelsLayout === "side" ? "md:flex-row" : ""
          }`}
        >

        {/* Agent 1 panel */}
        <div
          className={`flex flex-col min-h-0 min-w-0 ${
            panelsLayout === "side" ? "min-h-[200px]" : ""
          } ${
            panelMode === "agent-full"
              ? "hidden md:hidden"
              : panelMode === "ask-full"
              ? "flex-1"
              : panelsLayout === "side"
              ? mobileTab !== "ask"
                ? "hidden md:flex md:grow-0 md:shrink-0"
                : "flex-1 md:grow-0 md:shrink-0"
              : mobileTab !== "ask"
              ? "hidden md:flex md:flex-1"
              : "flex-1"
          }`}
          style={{
            ...(panelsLayout === "side" && panelMode === "split"
              ? { flexBasis: `${panelWidthPct}%` }
              : {}),
            ...(panelsLayout === "side" && panelMode === "split"
              ? {
                  height: `${askPanelHeightPct}%`,
                  ...(askPanelHeightPct < 100 ? { marginTop: "auto" } : {}),
                }
              : {}),
            ...(askZoom !== 1 || askVerticalZoom !== 1
              ? {
                  transform: `scale(${askZoom}) scaleY(${askVerticalZoom})`,
                  transformOrigin: "top center",
                }
              : {}),
          }}
        >
          {panelsLayout === "side" && panelMode === "split" && (
            <div
              className="hidden md:flex items-center justify-center h-2.5 cursor-ns-resize shrink-0 select-none group"
              onMouseDown={(e) => startPanelHeightResize(e, "ask")}
              title={t("layout.resizeHeight")}
            >
              <div className="w-14 h-1 rounded-full bg-border group-hover:bg-accent transition-colors" />
            </div>
          )}
          <ChatPanel
            title={t("agent.panel1")}
            icon="⚡"
            iconColor="accent"
            badge="build"
            badgeColor="accent"
            providerId={askProvider}
            modelId={askModel}
            thinking={askThinking}
            onProviderChange={setAskProvider}
            onModelChange={setAskModel}
            onThinkingChange={setAskThinking}
            messages={askMessages}
            inputPlaceholder={
              askHasKey ? t("chat.ask.any") : t("chat.ask.noKey")
            }
            onSend={handleAskSend}
            loading={askLoading}
            streamingMessageId={askStreamingId}
            onApiKeyChange={() => hasApiKey(askProvider).then(setAskHasKey)}
            onConnectVps={() => setShowSshModal(true)}
            onOpenGitRemote={() => { setGitRemoteSlot("ask"); setShowGitRemote(true); }}
            zoom={askZoom}
            onZoomChange={handleAskZoomChange}
            verticalZoom={askVerticalZoom}
            onVerticalZoomChange={handleAskVerticalZoomChange}
            panelMenuKey="ask"
            role={askRole}
            onRoleChange={setAskRole}
            copyLabel={`\u2192 ${t("agent.panel2")}`}
            onCopyTo={(content) => setAgentPrefill(content)}
            prefill={askPrefill}
            isExpanded={panelMode === "ask-full"}
            onToggleExpand={toggleAskExpand}
            onOpenPromptLibrary={() => setShowPromptLibrary(true)}
            headerLeft={
              <RoleSelector role={askRole} onChange={setAskRole} />
            }
            modelOrch={askModelOrch}
            onModelOrchChange={setAskModelOrch}
            modelOrchHint="Model orkestracija — task se automatski rutira na najbolji model prema težini"
            isSteerable={isAgentSteerable}
            onSteerSend={handleSteerSend}
            steerStatusText={agentTodos.length > 0 ? t("chat.steer.steps", { n: agentTodos.filter(t => t.status !== "completed").length }) : undefined            }
            panelAccent={askPanelAccent || undefined}
            onPanelAccentChange={handleAskPanelAccentChange}
            orchestratedModels={askOrchestratedModels}
            onOrchestratedModelsChange={setAskOrchestratedModels}
            availableModels={availableModels}
            background={askBackground}
            onBackgroundChange={setAskBackground}
            runtimeControl={
              <EnginePicker
                machineId={askMachineId}
                hasRepo={!!askActiveRepo}
                repoName={askActiveRepo?.fullName}
                onSelectLocal={() => setAskMachineId("local:opencode:ask")}
                onConnectVps={() => setShowSshModal(true)}
                onOpenGitRemote={() => { setGitRemoteSlot("ask"); setShowGitRemote(true); }}
                onOpenRuntimeManager={() => setShowRuntimeManager(true)}
              />
            }
            onFocusChange={setAskFocused}
            orbState={askLoading ? "composing" : null}
            orbLabel={askLoading ? "Generišem odgovor…" : undefined}
          />
        </div>

        {/* Resize handle — side-by-side layout, desktop only */}
        {panelsLayout === "side" && panelMode === "split" && (
          <div
            className="hidden md:flex items-center justify-center w-2.5 cursor-col-resize shrink-0 select-none group"
            onMouseDown={startPanelResize}
            title={t("layout.resize")}
          >
            <div className="w-1 h-14 rounded-full bg-border group-hover:bg-accent transition-colors" />
          </div>
        )}

        {/* Agent 2 panel */}
        <div
          className={`flex flex-col min-h-0 min-w-0 ${
            panelsLayout === "side" ? "min-h-[200px]" : ""
          } ${
            panelMode === "ask-full"
              ? "hidden md:hidden"
              : panelMode === "agent-full"
              ? "flex-1"
              : mobileTab !== "agent"
              ? "hidden md:flex md:flex-1"
              : "flex-1"
          }`}
          style={{
            ...(panelsLayout === "side" && panelMode === "split"
              ? {
                  height: `${agentPanelHeightPct}%`,
                  ...(agentPanelHeightPct < 100 ? { marginTop: "auto" } : {}),
                }
              : {}),
            ...(agentZoom !== 1 || agentVerticalZoom !== 1
              ? {
                  transform: `scale(${agentZoom}) scaleY(${agentVerticalZoom})`,
                  transformOrigin: "top center",
                }
              : {}),
          }}
        >
          {panelsLayout === "side" && panelMode === "split" && (
            <div
              className="hidden md:flex items-center justify-center h-2.5 cursor-ns-resize shrink-0 select-none group"
              onMouseDown={(e) => startPanelHeightResize(e, "agent")}
              title={t("layout.resizeHeight")}
            >
              <div className="w-14 h-1 rounded-full bg-border group-hover:bg-accent transition-colors" />
            </div>
          )}
          <ChatPanel
            title={t("agent.panel2")}
            icon="⚡"
            iconColor="accent"
            badge="build"
            providerId={agentProvider}
            modelId={agentModel}
            thinking={agentThinking}
            onProviderChange={setAgentProvider}
            onModelChange={setAgentModel}
            onThinkingChange={setAgentThinking}
            messages={agentMessages}
            inputPlaceholder={t("chat.agent.command")}
            onSend={handleAgentSend}
            loading={agentLoading}
            streamingMessageId={agentStreamingId}
            onApiKeyChange={() => hasApiKey(askProvider).then(setAskHasKey)}
            onConnectVps={() => setShowSshModal(true)}
            onOpenGitRemote={() => { setGitRemoteSlot("agent"); setShowGitRemote(true); }}
            zoom={agentZoom}
            onZoomChange={handleAgentZoomChange}
            verticalZoom={agentVerticalZoom}
            onVerticalZoomChange={handleAgentVerticalZoomChange}
            panelMenuKey="agent"
            role={agentRole}
            onRoleChange={setAgentRole}
            copyLabel={`\u2190 ${t("agent.panel1")}`}
            onCopyTo={(content) => setAskPrefill(content)}
            prefill={agentPrefill}
            isExpanded={panelMode === "agent-full"}
            onToggleExpand={toggleAgentExpand}
            onOpenPromptLibrary={() => setShowPromptLibrary(true)}
            headerLeft={
              <RoleSelector role={agentRole} onChange={setAgentRole} />
            }
            runtimeControl={
              <EnginePicker
                machineId={agentMachineId}
                hasRepo={!!activeRepo}
                repoName={activeRepo?.fullName}
                onSelectLocal={() => setAgentMachineId("local:opencode")}
                onConnectVps={() => setShowSshModal(true)}
                onOpenGitRemote={() => { setGitRemoteSlot("agent"); setShowGitRemote(true); }}
                onOpenRuntimeManager={() => setShowRuntimeManager(true)}
              />
            }
modelOrch={agentModelOrch}
             onModelOrchChange={setAgentModelOrch}
             modelOrchHint="Model orkestracija — task se automatski rutira na najbolji model prema težini (kad agent radi kao običan chat)"
             panelAccent={agentPanelAccent || undefined}
             onPanelAccentChange={handleAgentPanelAccentChange}
             orchestratedModels={agentOrchestratedModels}
             onOrchestratedModelsChange={setAgentOrchestratedModels}
             availableModels={availableModels}
             background={agentBackground}
             onBackgroundChange={setAgentBackground}
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
                </>
              }
              orbState={agentStatusOrb?.state ?? null}
              orbLabel={agentStatusOrb?.label}
            />
        </div>
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
          projectId={projectId || "straxor-landing"}
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
          projectPath={projectPath}
          onClose={() => setShowRollback(false)}
        />
      )}

      {showContext && (
        <ContextPanel
          projectId={projectId || "straxor-landing"}
          machineId={agentMachineId}
          projectPath={projectPath}
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
              "git-remote": () => setShowGitRemote(true),
              usage: () => setShowUsage(true),
              "runtime-manager": () => setShowRuntimeManager(true),
              "quick-start": () => setShowQuickStart(true),
              kanban: () => setShowKanban(true),
              "mcp-marketplace": () => setShowMcpMarketplace(true),
              infrastructure: () => setShowInfrastructure(true),
              teams: () => setShowTeams(true),
              organization: () => setShowOrganization(true),
              enterprise: () => setShowEnterprise(true),
              plugins: () => setShowPlugins(true),
              marketplace: () => setShowMarketplace(true),
              scale: () => setShowScale(true),
              resilience: () => setShowResilience(true),
              admin: () => navigate("/admin"),
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

      {showGitRemote && (
        <GitRemotePanel
          slot={gitRemoteSlot}
          onClose={() => setShowGitRemote(false)}
          onRepoChanged={() => loadActiveRepo()}
        />
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

      {showMcpMarketplace && (
        <McpMarketplace
          onClose={() => setShowMcpMarketplace(false)}
          machineId={agentMachineId}
        />
      )}

      {showInfrastructure && (
        <InfrastructurePanel
          onClose={() => setShowInfrastructure(false)}
          projectId="placeholder-project-id"
          machineId={agentMachineId}
        />
      )}

      {showTeams && (
        <TeamPanel onClose={() => setShowTeams(false)} />
      )}

      {showOrganization && (
        <OrganizationDashboard onClose={() => setShowOrganization(false)} />
      )}

      {showEnterprise && (
        <EnterpriseSecurity onClose={() => setShowEnterprise(false)} />
      )}

      {showPlugins && (
        <PluginManager onClose={() => setShowPlugins(false)} />
      )}

      {showMarketplace && (
        <Marketplace onClose={() => setShowMarketplace(false)} />
      )}

      {showScale && (
        <GlobalScalePanel onClose={() => setShowScale(false)} />
      )}

      {showResilience && (
        <EnterpriseResilience onClose={() => setShowResilience(false)} />
      )}

      {showAdmin && (
        <AdminCenter onClose={() => setShowAdmin(false)} />
      )}

      {showKanban && (
        <KanbanCommandCenter
          onClose={() => setShowKanban(false)}
          onNavigate={(sessionId, machineId) => {
            setShowKanban(false);
            setDbSessionId(sessionId);
            setAgentMachineId(machineId);
            setVpsStatus("ready");
          }}
          runtimes={[
            { id: "opencode", name: "OpenCode" },
            { id: "crush", name: "Crush" },
            { id: "claude-code", name: "Claude Code" },
          ]}
        />
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

      {/* Verification Panel */}
      {showVerification && (
        <VerificationPanel
          sessionId={agentSessionId}
          onClose={() => setShowVerification(false)}
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
