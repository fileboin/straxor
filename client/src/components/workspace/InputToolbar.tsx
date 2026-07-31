import { useState, useRef, useEffect } from "react";
import { t, useLang } from "../../lib/i18n.js";

interface ToolbarAction {
  id: string;
  label: string;
  icon: string;
}

interface Props {
  onAction: (actionId: string) => void;
  micState?: "idle" | "recording" | "processing";
  onMicToggle?: () => void;
}

export default function InputToolbar({ onAction, micState = "idle", onMicToggle }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useLang();

  const ACTIONS: ToolbarAction[] = [
    { id: "camera", label: t("toolbar.camera"), icon: "📷" },
    { id: "file", label: t("toolbar.file"), icon: "📎" },
    { id: "image", label: t("toolbar.image"), icon: "🖼" },
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

  const micActive = micState !== "idle";

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={onMicToggle}
        className={`w-[30px] h-[30px] rounded-full border flex items-center justify-center transition-all shrink-0 ${
          micActive
            ? "border-red-500/50 bg-red-500/15 text-red-500"
            : "border-border bg-surface-2 text-text-muted hover:text-text hover:border-border-light"
        } ${micState === "recording" ? "animate-pulse" : ""}`}
        title={micActive ? t("toolbar.mic.stop") : t("toolbar.mic")}
        aria-label={t("toolbar.mic")}
      >
        <span className="text-sm leading-none">{micActive ? "■" : "🎙"}</span>
      </button>

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`w-[30px] h-[30px] rounded-full border border-border bg-surface-2 text-text-muted flex items-center justify-center transition-all shrink-0 hover:text-text hover:border-border-light ${
            open ? "rotate-45 bg-surface-3" : ""
          }`}
          title={t("toolbar.attach")}
        >
          <span className="text-base leading-none">+</span>
        </button>

        {open && (
          <div className="absolute bottom-full left-0 mb-2 w-44 rounded-xl border border-border bg-surface shadow-xl shadow-black/30 z-50 overflow-hidden">
            {ACTIONS.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  onAction(a.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2 transition-colors"
              >
                <span className="text-sm">{a.icon}</span>
                <span className="text-[13px] text-text">{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
