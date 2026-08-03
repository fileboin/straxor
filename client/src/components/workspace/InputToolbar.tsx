import { useState, useRef, useEffect } from "react";
import { t, useLang } from "../../lib/i18n.js";
import InfoTip from "./InfoTip.js";

interface ToolbarAction {
  id: string;
  label: string;
  icon: string;
  info: string;
}

interface Props {
  onAction: (actionId: string) => void;
  micState?: "idle" | "recording" | "processing";
  disabledActions?: string[];
}

export default function InputToolbar({ onAction, micState = "idle", disabledActions = [] }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useLang();

  const ACTIONS: ToolbarAction[] = [
    { id: "connect-vps", label: t("toolbar.connectVps"), icon: "⏻", info: t("toolbar.connectVpsInfo") },
    { id: "github", label: t("toolbar.githubRepo"), icon: "🐙", info: t("toolbar.githubRepoInfo") },
    { id: "model", label: t("toolbar.model"), icon: "🤖", info: t("toolbar.modelInfo") },
    { id: "prompts", label: t("toolbar.prompts"), icon: "📋", info: t("toolbar.promptsInfo") },
    { id: "camera", label: t("toolbar.camera"), icon: "📷", info: t("toolbar.cameraInfo") },
    { id: "file", label: t("toolbar.file"), icon: "📎", info: t("toolbar.fileInfo") },
    { id: "image", label: t("toolbar.image"), icon: "🖼", info: t("toolbar.imageInfo") },
    { id: "mic", label: t("toolbar.mic"), icon: "🎙", info: t("toolbar.micInfo") },
    { id: "budget", label: t("toolbar.budget"), icon: "💰", info: t("toolbar.budgetInfo") },
  ];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-[30px] h-[30px] rounded-full border border-border bg-surface-2 text-text-muted flex items-center justify-center transition-all hover:text-text hover:border-border-light ${
          open ? "rotate-45 bg-surface-3" : ""
        }`}
        title={t("toolbar.menu")}
        aria-label={t("toolbar.menu")}
      >
        <span className="text-base leading-none">+</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-border bg-surface shadow-xl shadow-black/30 z-50 overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted border-b border-border bg-surface-2">
            {t("toolbar.menu")}
          </div>
{ACTIONS.map((a) => {
              const disabled = disabledActions.includes(a.id);
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-1 px-1.5 transition-colors ${
                    disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-surface-2"
                  } ${a.id === "mic" && micState === "recording" ? "bg-red-500/10" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (disabled) return;
                      onAction(a.id);
                      setOpen(false);
                    }}
                    disabled={disabled}
                    className="flex-1 flex items-center gap-2.5 px-1.5 py-2 text-left"
                  >
                    <span className="text-sm shrink-0">{a.icon}</span>
                    <span className="text-[13px] text-text truncate">{a.label}</span>
                    {a.id === "mic" && micState === "recording" && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    )}
                  </button>
                  <InfoTip text={a.info} />
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
