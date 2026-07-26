import { useState, useCallback } from "react";
import WorkspaceTopbar from "../components/workspace/WorkspaceTopbar.js";
import ChatPanel from "../components/workspace/ChatPanel.js";
import BottomBar from "../components/workspace/BottomBar.js";
import type { ChatMessage } from "../components/workspace/ChatPanel.js";
import type { PlanActMode } from "../components/workspace/PlanActToggle.js";
import type { ThinkingBudget } from "../lib/models.js";
import { streamChat, getApiKey } from "../lib/chat.js";

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

const INITIAL_AGENT_MESSAGES: ChatMessage[] = [
  {
    id: "g1",
    role: "user",
    content: "Napravi landing page sa hero sekcijom, features gridom i CTA dugmetom.",
  },
  {
    id: "g2",
    role: "assistant",
    label: "Opus 4.6",
    content: "Kreiram strukturu projekta. Vite + React + Tailwind.\n\n$ npm create vite@latest . -- --template react-ts\n$ npm install -D tailwindcss @tailwindcss/vite",
  },
  {
    id: "g3",
    role: "assistant",
    label: "Opus 4.6",
    content: "Generišem komponente...\n\n✦ src/components/Hero.tsx — created\n✦ src/components/Features.tsx — created\n✦ src/components/CTA.tsx — created\n\nBuild prolazi. Želiš li da vidim preview?",
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
  const [agentMessages, setAgentMessages] = useState<ChatMessage[]>(INITIAL_AGENT_MESSAGES);
  const [mobileTab, setMobileTab] = useState<"ask" | "agent">("ask");

  const [askStreamingId, setAskStreamingId] = useState<string | null>(null);
  const [agentStreamingId, setAgentStreamingId] = useState<string | null>(null);

  const [askLoading, setAskLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);

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
    const userMsg: ChatMessage = { id: `g-${Date.now()}`, role: "user", content: msg };
    const assistantMsg: ChatMessage = {
      id: `g-${Date.now() + 1}`,
      role: "assistant",
      content: "",
      label: agentModel,
    };

    setAgentMessages((prev) => [...prev, userMsg, assistantMsg]);
    setAgentStreamingId(assistantMsg.id);
    setAgentLoading(true);

    const history = [...agentMessages, userMsg].map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    streamChat(agentProvider, agentModel, history, agentThinking, {
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
    });
  }, [agentProvider, agentModel, agentThinking, agentMessages]);

  return (
    <div className="h-full flex flex-col">
      <WorkspaceTopbar
        projectName="straxor-landing"
        template="react"
        status="active"
        orchestrator={orchestrator}
        onOrchestratorChange={setOrchestrator}
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
              getApiKey(askProvider) ? "Pitaj bilo šta..." : "Prvo unesi API key..."
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
              getApiKey(agentProvider) ? "Naredi agentu šta da napravi..." : "Prvo unesi API key..."
            }
            onSend={handleAgentSend}
            loading={agentLoading}
            streamingMessageId={agentStreamingId}
          />
        </div>
      </div>

      <BottomBar />
    </div>
  );
}
