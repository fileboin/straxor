import { useState, useRef, useEffect, type FormEvent } from "react";
import ProviderModelDropdown from "./ProviderModelDropdown.js";
import InputToolbar from "./InputToolbar.js";
import PlanActToggle, { type PlanActMode } from "./PlanActToggle.js";
import type { ThinkingBudget } from "../../lib/models.js";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  label?: string;
}

interface Props {
  title: string;
  icon: string;
  iconColor: "blue" | "accent";
  badge: string;
  badgeColor?: "blue" | "accent";
  providerId: string;
  modelId: string;
  thinking: ThinkingBudget;
  planActMode: PlanActMode;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onThinkingChange: (budget: ThinkingBudget) => void;
  onPlanActChange: (mode: PlanActMode) => void;
  messages: ChatMessage[];
  inputPlaceholder: string;
  onSend: (message: string) => void;
  loading?: boolean;
}

export default function ChatPanel({
  title,
  icon,
  iconColor,
  badge,
  badgeColor,
  providerId,
  modelId,
  thinking,
  planActMode,
  onProviderChange,
  onModelChange,
  onThinkingChange,
  onPlanActChange,
  messages,
  inputPlaceholder,
  onSend,
  loading,
}: Props) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
              iconColor === "blue"
                ? "bg-accent-blue-dim text-accent-blue"
                : "bg-accent-dim text-accent"
            }`}
          >
            {icon}
          </div>
          <span className="font-semibold text-[13px]">{title}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
              (badgeColor || iconColor) === "blue"
                ? "bg-accent-blue-dim text-accent-blue"
                : "bg-accent-dim text-accent"
            }`}
          >
            {badge}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PlanActToggle mode={planActMode} onChange={onPlanActChange} />
          <ProviderModelDropdown
            providerId={providerId}
            modelId={modelId}
            thinking={thinking}
            onProviderChange={onProviderChange}
            onModelChange={onModelChange}
            onThinkingChange={onThinkingChange}
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 flex flex-col gap-3 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
              msg.role === "user"
                ? "self-end bg-accent text-white rounded-br-sm"
                : `self-start bg-surface-2 border border-border rounded-bl-sm ${
                    iconColor === "blue" ? "border-accent-blue-border/30" : ""
                  }`
            }`}
          >
            {msg.label && (
              <div className="text-[11px] font-semibold mb-1 opacity-60">
                {msg.label}
              </div>
            )}
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-border bg-surface shrink-0">
        <form
          onSubmit={handleSubmit}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-[20px] border border-border bg-surface-2 transition-colors focus-within:border-accent ${
            iconColor === "blue" ? "focus-within:border-accent-blue" : ""
          }`}
        >
          <InputToolbar onAction={() => {}} />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={inputPlaceholder}
            disabled={loading}
            className="flex-1 bg-transparent text-text text-[13px] placeholder-text-muted outline-none border-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={`w-[30px] h-[30px] rounded-full border-none text-white text-sm flex items-center justify-center transition-opacity shrink-0 disabled:opacity-30 ${
              iconColor === "blue" ? "bg-accent-blue" : "bg-accent"
            } hover:opacity-85`}
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
