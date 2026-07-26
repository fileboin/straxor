import { useState, useRef, useEffect, type FormEvent } from "react";

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
  models: string[];
  selectedModel: string;
  onModelChange: (model: string) => void;
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
  models,
  selectedModel,
  onModelChange,
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
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="text-[11px] px-2 py-1 rounded-lg border border-border bg-surface-2 text-text-secondary cursor-pointer hover:border-border-light hover:text-text focus:outline-none focus:border-accent transition-colors appearance-none pr-5 bg-no-repeat bg-[length:10px_6px] bg-[right:8px_center]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
          }}
        >
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
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
