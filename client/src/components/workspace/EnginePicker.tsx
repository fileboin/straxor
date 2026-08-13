import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  machineId: string | null;
  hasRepo: boolean;
  repoName?: string | null;
  panelLabel?: string;
  onSelectLocal: () => void;
  onConnectVps: () => void;
  onDisconnectVps?: () => void;
  onOpenGitRemote: () => void;
  onOpenRuntimeManager: () => void;
}

const isLocal = (id: string | null) => !!id && id.startsWith("local:");

const MENU_W = 264;

export default function EnginePicker({
  machineId,
  hasRepo,
  repoName,
  panelLabel = "Panel",
  onSelectLocal,
  onConnectVps,
  onDisconnectVps,
  onOpenGitRemote,
  onOpenRuntimeManager,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const mode = isLocal(machineId)
    ? "local"
    : machineId
      ? "vps"
      : "none";

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    const d = menuRef.current;
    if (!r || !d) return;
    const H = d.offsetHeight;
    let left = Math.min(r.right - MENU_W, window.innerWidth - MENU_W - 8);
    left = Math.max(8, left);
    const below = r.bottom + 4;
    let top = below;
    if (below + H > window.innerHeight - 8) {
      const above = r.top - H - 4;
      top = above >= 8 ? above : Math.max(8, window.innerHeight - H - 8);
    }
    setPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(place);
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const modeLabel =
    mode === "local" ? "◇ Lokalno · OpenCode" :
    mode === "vps" ? "⏻ VPS" :
    "◇ Engine";

  const modeTitle =
    mode === "local"
      ? `Agent radi na lokalnom engine-u u repou${repoName ? ` ${repoName}` : ""} — bez VPS-a`
      : mode === "vps"
        ? "Agent radi na VPS mašini"
        : "Nijedan engine nije aktivan — poveži GitHub repo ili VPS";

  const modeColor =
    mode === "local" ? "text-accent border-accent/40 bg-accent/10" :
    mode === "vps" ? "text-blue-400 border-blue-400/40 bg-blue-400/10" :
    "text-text-muted border-border bg-surface-2";

  const menu = open ? (
    createPortal(
      <div
        ref={menuRef}
        className="z-[1000] w-[264px] max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-xl border border-border shadow-2xl shadow-black/50"
        style={{
          position: "fixed",
          top: pos?.top ?? 0,
          left: pos?.left ?? 0,
          visibility: pos ? "visible" : "hidden",
          background: "var(--surface)",
          color: "var(--text)",
        }}
      >
        <div className="px-3 py-2 border-b border-border" style={{ background: "var(--surface-2)" }}>
          <div className="text-[10px] font-semibold" style={{ color: "var(--text)" }}>{panelLabel} engine</div>
          <div className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>Gdje ovaj panel izvršava zadatke</div>
        </div>

        <button
          onClick={() => { setOpen(false); onSelectLocal(); }}
          disabled={!hasRepo}
          className="w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
          style={mode === "local" ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)" } : undefined}
          title={hasRepo ? "Pokreni agenta na lokalno kloniranom repou (bez VPS-a)" : "Prvo poveži GitHub repo"}
        >
          <span className="text-base leading-none mt-0.5">◇</span>
          <span className="min-w-0">
            <span className="block text-[11px] font-medium" style={{ color: "var(--text)" }}>Lokalni engine (repo)</span>
            <span className="block text-[9px]" style={{ color: "var(--text-muted)" }}>
              {hasRepo
                ? repoName ? `Radi u ${repoName} — bez VPS-a` : "Radi u kloniranom repou — bez VPS-a"
                : "Poveži GitHub repo prvo"}
            </span>
          </span>
          {mode === "local" && <span className="ml-auto text-[9px] shrink-0" style={{ color: "var(--accent)" }}>●</span>}
        </button>

        <button
          onClick={() => { setOpen(false); onConnectVps(); }}
          className="w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
          style={mode === "vps" ? { background: "rgba(59,130,246,0.10)" } : undefined}
        >
          <span className="text-base leading-none mt-0.5">⏻</span>
          <span className="min-w-0">
            <span className="block text-[11px] font-medium" style={{ color: "var(--text)" }}>VPS mašina</span>
            <span className="block text-[9px]" style={{ color: "var(--text-muted)" }}>Poveži SSH server i pokreni agenta tamo</span>
          </span>
          {mode === "vps" && <span className="ml-auto text-[9px] shrink-0" style={{ color: "#60a5fa" }}>●</span>}
        </button>

        <button
          onClick={() => { setOpen(false); onOpenGitRemote(); }}
          className="w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
        >
          <span className="text-base leading-none mt-0.5">🔗</span>
          <span className="min-w-0">
            <span className="block text-[11px] font-medium" style={{ color: "var(--text)" }}>GitHub repo</span>
            <span className="block text-[9px]" style={{ color: "var(--text-muted)" }}>
              {hasRepo
                ? "Token, aktivni repo, push sandboxa"
                : "Poveži repozitorijum + GitHub token za agenta"}
            </span>
          </span>
        </button>



        <div className="border-t border-border">
          <button
            onClick={() => { setOpen(false); onOpenRuntimeManager(); }}
            className="w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
          >
            <span className="text-base leading-none mt-0.5">⚙</span>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium" style={{ color: "var(--text)" }}>Runtime Manager</span>
              <span className="block text-[9px]" style={{ color: "var(--text-muted)" }}>Health, restart, MCP serveri</span>
            </span>
          </button>
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        title={modeTitle}
        className={`h-7 px-2 rounded-md text-[10px] font-medium border transition-colors flex items-center gap-1 ${modeColor}`}
      >
        {modeLabel}
        <span className="text-[8px] opacity-70">{open ? "▴" : "▾"}</span>
      </button>
      {menu}
    </div>
  );
}
