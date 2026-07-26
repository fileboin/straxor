import { useState, useCallback, useEffect } from "react";
import WorkspaceTopbar from "../components/workspace/WorkspaceTopbar.js";
import ChatPanel from "../components/workspace/ChatPanel.js";
import TodoList, { type TodoStep } from "../components/workspace/TodoList.js";
import BottomBar from "../components/workspace/BottomBar.js";
import SshInput from "../components/workspace/SshInput.js";
import type { ChatMessage, ToolCall } from "../components/workspace/ChatPanel.js";
import type { PlanActMode } from "../components/workspace/PlanActToggle.js";
import type { ThinkingBudget } from "../lib/models.js";
import { streamChat, hasApiKey } from "../lib/chat.js";
import { streamAgentMessage, fetchTodos, fetchDiff } from "../lib/agent.js";

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
  const [vpsStatus, setVpsStatus] = useState<"disconnected" | "connecting" | "provisioning" | "ready" | "error">("disconnected");

  // Agent session state
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const [agentMachineId, setAgentMachineId] = useState<string | null>(null);

  // Agent todo state
  const [agentTodos, setAgentTodos] = useState<TodoStep[]>([]);
  const [confirmedSteps, setConfirmedSteps] = useState<Set<string>>(new Set());
  const [diffCache, setDiffCache] = useState<Record<string, string>>({});

  // API key status
  const [askHasKey, setAskHasKey] = useState(false);

  // Check API key status when provider changes
  useEffect(() => {
    hasApiKey(askProvider).then(setAskHasKey);
  }, [askProvider]);

  // Fetch todos after agent finishes
  const refreshTodos = useCallback(async () => {
    if (!agentMachineId || !agentSessionId) return;

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

      return { id, content: t.content, status, diff: diffCache[id] };
    });

    setAgentTodos(steps);
  }, [agentMachineId, agentSessionId, confirmedSteps, diffCache]);

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

  const handleAgentSend = useCallback((msg: string) => {
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

    streamAgentMessage(agentMachineId, msg, agentSessionId, {
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
  }, [agentMachineId, agentSessionId, agentModel, refreshTodos]);

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

  const handleVpsConnected = useCallback((machineId: string) => {
    setAgentMachineId(machineId);
    setVpsStatus("ready");
    setShowSshModal(false);
  }, []);

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
          className={`flex-1 flex flex-col min-h-0 min-w-0 border-b md:border-b-0 md:border-r border-border ${
            mobileTab !== "ask" ? "hidden md:flex" : "flex"
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
          />
        </div>

        {/* Agent panel */}
        <div
          className={`flex-1 flex flex-col min-h-0 min-w-0 ${
            mobileTab !== "agent" ? "hidden md:flex" : "flex"
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
            headerContent={
              <TodoList
                steps={agentTodos}
                onConfirm={handleConfirmStep}
                onExpand={handleExpandStep}
                loading={agentLoading}
              />
            }
          />
        </div>
      </div>

      <BottomBar />

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
    </div>
  );
}
