import { useState } from "react";
import WorkspaceTopbar from "../components/workspace/WorkspaceTopbar.js";
import ChatPanel from "../components/workspace/ChatPanel.js";
import BottomBar from "../components/workspace/BottomBar.js";
import type { ChatMessage } from "../components/workspace/ChatPanel.js";

const ASK_MODELS = ["Claude Sonnet 4", "GPT-4o", "DeepSeek R1", "Gemini 2.5 Pro"];
const AGENT_MODELS = ["Opus 4.6", "Claude Sonnet 4", "GPT-4o", "DeepSeek Coder"];

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
  const [askModel, setAskModel] = useState(ASK_MODELS[0]);
  const [agentModel, setAgentModel] = useState(AGENT_MODELS[0]);
  const [askMessages, setAskMessages] = useState<ChatMessage[]>(INITIAL_ASK_MESSAGES);
  const [agentMessages, setAgentMessages] = useState<ChatMessage[]>(INITIAL_AGENT_MESSAGES);
  const [mobileTab, setMobileTab] = useState<"ask" | "agent">("ask");

  const handleAskSend = (msg: string) => {
    setAskMessages((prev) => [
      ...prev,
      { id: `a-${Date.now()}`, role: "user", content: msg },
    ]);
  };

  const handleAgentSend = (msg: string) => {
    setAgentMessages((prev) => [
      ...prev,
      { id: `g-${Date.now()}`, role: "user", content: msg },
    ]);
  };

  return (
    <div className="h-full flex flex-col">
      <WorkspaceTopbar projectName="straxor-landing" template="react" status="active" />

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
            models={ASK_MODELS}
            selectedModel={askModel}
            onModelChange={setAskModel}
            messages={askMessages}
            inputPlaceholder="Pitaj bilo šta..."
            onSend={handleAskSend}
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
            models={AGENT_MODELS}
            selectedModel={agentModel}
            onModelChange={setAgentModel}
            messages={agentMessages}
            inputPlaceholder="Naredi agentu šta da napravi..."
            onSend={handleAgentSend}
          />
        </div>
      </div>

      <BottomBar />
    </div>
  );
}
