import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
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
      // Only close when clicking OUTSIDE both the toggle button (ref) AND the
      // portal menu (menuRef). Since the portal is at document.body it is NOT
      // inside ref.current, so without this guard React 18 flushes the
      // setOpen(false) synchronously on mousedown — unmounting the portal
      // before the click event fires — and menu-item onClick never runs.
      const inToggle = ref.current && ref.current.contains(e.target as Node);
      const inMenu   = menuRef.current && menuRef.current.contains(e.target as Node);
      if (!inToggle && !inMenu) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      const r = btnRef.current?.getBoundingClientRect();
      const d = menuRef.current;
      if (!r || !d) return;
      const W = 256;
      const H = d.offsetHeight;
      let left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
      let top = r.top - H - 8;
      if (top < 8) top = r.bottom + 8;
      if (top + H > window.innerHeight - 8) top = Math.max(8, window.innerHeight - H - 8);
      setPos({ top, left });
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        ref={btnRef}
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

      {open &&
        createPortal(
        <div
          ref={menuRef}
          className="z-[1000] w-64 max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-xl border border-border shadow-2xl shadow-black/50"
          style={{
            position: "fixed",
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            visibility: pos ? "visible" : "hidden",
            background: "var(--surface)",
            color: "var(--text)",
          }}
        >
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border-b border-border" style={{ color: "var(--text-muted)", background: "var(--surface-2)" }}>
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
                    <span className="text-[13px]" style={{ color: "var(--text)" }}>{a.label}</span>
                    {a.id === "mic" && micState === "recording" && (
                      <span className="ml-auto w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                    )}
                  </button>
                  <InfoTip text={a.info} />
                </div>
              );
            })}
        </div>,
        document.body
        )}
    </div>
  );
}
