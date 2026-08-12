import { t } from "../../lib/i18n.js";

interface Props {
  mode: "agent" | "chat";
  onChange: (mode: "agent" | "chat") => void;
  /** Engine not available → OpenCode silently falls back to plain chat. */
  noEngine: boolean;
  side: "left" | "right";
}

/**
 * Segmented Chat | OpenCode mode switch for a panel. The active mode is always
 * highlighted; when "OpenCode" is picked but no engine is available the toggle
 * shows an explicit warning so the mode never silently pretends to work.
 */
export default function ChatAgentToggle({ mode, onChange, noEngine, side }: Props) {
  const agentTooltip =
    side === "left" ? t("chat.ask.agentMode") : t("chat.agent.agentMode");
  const chatTooltip = side === "left" ? t("chat.ask.chatMode") : t("chat.agent.chatMode");

  return (
    <div
      className="flex items-center p-0.5 rounded-lg border border-border bg-surface-2 shrink-0"
      role="group"
      aria-label="Panel mode"
    >
      <button
        type="button"
        onClick={() => onChange("chat")}
        title={chatTooltip}
        aria-pressed={mode === "chat"}
        className={`flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold transition-colors ${
          mode === "chat"
            ? "bg-surface-3 text-text shadow-sm border border-border-light"
            : "text-text-muted hover:text-text"
        }`}
      >
        <span className="text-[11px] leading-none">💬</span>
        Chat
      </button>
      <button
        type="button"
        onClick={() => onChange("agent")}
        title={agentTooltip + (noEngine ? " — " + t("chat.agent.noEngine") : "")}
        aria-pressed={mode === "agent"}
        className={`relative flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold transition-colors ${
          mode === "agent"
            ? "bg-accent text-white shadow-sm"
            : "text-text-muted hover:text-text"
        }`}
      >
        <span className="text-[11px] leading-none">▣</span>
        OpenCode
        {mode === "agent" && noEngine && (
          <span
            className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-red-500 border border-white/40"
            title={t("chat.agent.noEngine")}
          />
        )}
      </button>
      {noEngine && mode === "agent" && (
        <span className="text-[9px] text-red-400 pl-1 pr-1 whitespace-nowrap">
          {t("chat.agent.fallback")}
        </span>
      )}
    </div>
  );
}
