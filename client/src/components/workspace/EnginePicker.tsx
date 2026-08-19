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
  // Per-panel preparation feedback from the local/VPS engine selection.
  prepStatus?: "idle" | "preparing" | "ready" | "error" | "no-repo";
  prepMessage?: string;
  // Explicit connection state so each panel shows "Status: Ready" or
  // "Status: Disconnected" instead of silently doing nothing.
  vpsStatus?: "disconnected" | "connecting" | "provisioning" | "ready" | "error" | "reconnecting" | "offline";
}

const isLocal = (id: string | null) => !!id && id.startsWith("local:");

const MENU_W = 264;

const PREP_LABELS: Record<string, string> = {
  preparing: "Priprema…",
  ready: "Spreman",
  error: "Greška",
  "no-repo": "Bez repo-a",
};

// Per-panel connection status: "Status: Ready" when the engine is usable
// (local OpenCode bound, or a verified VPS), otherwise "Status: Disconnected".
function connectionStatus(mode: "local" | "vps" | "none", vpsStatus: Props["vpsStatus"]): {
  label: string;
  tone: "ok" | "warn" | "bad" | "idle";
} {
  if (mode === "local") {
    return { label: "Status: Ready (lokalno)", tone: "ok" };
  }
  if (mode === "vps") {
    switch (vpsStatus) {
      case "ready":
        return { label: "Status: Ready (VPS)", tone: "ok" };
      case "connecting":
      case "provisioning":
      case "reconnecting":
        return { label: "Status: Spajanje…", tone: "warn" };
      case "error":
      case "offline":
        return { label: "Status: Greška / Nije spojen na VPS", tone: "bad" };
      default:
        return { label: "Status: Disconnected", tone: "bad" };
    }
  }
  return { label: "Status: Disconnected", tone: "bad" };
}

const STATUS_TONES: Record<string, { text: string; border: string; bg: string }> = {
  ok: { text: "#34d399", border: "rgba(52,211,153,0.35)", bg: "rgba(52,211,153,0.08)" },
  warn: { text: "#fbbf24", border: "rgba(251,191,36,0.35)", bg: "rgba(251,191,36,0.08)" },
  bad: { text: "#f87171", border: "rgba(248,113,113,0.35)", bg: "rgba(248,113,113,0.08)" },
  idle: { text: "var(--text-muted)", border: "var(--border)", bg: "var(--surface-2)" },
};

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
  prepStatus = "idle",
  prepMessage = "",
  vpsStatus = "disconnected",
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

  const prepColor =
    prepStatus === "ready" ? "text-green-400 border-green-500/30 bg-green-500/10" :
    prepStatus === "error" ? "text-red-400 border-red-500/30 bg-red-500/10" :
    prepStatus === "preparing" ? "text-accent border-accent/30 bg-accent/10" :
    prepStatus === "no-repo" ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
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
          {(() => {
            const cs = connectionStatus(mode, vpsStatus);
            const tone = STATUS_TONES[cs.tone];
            return (
              <div
                className="mt-1.5 px-2 py-1 rounded-md text-[9px] font-semibold"
                style={{ color: tone.text, border: `1px solid ${tone.border}`, background: tone.bg }}
              >
                {cs.label}
              </div>
            );
          })()}
        </div>

        <button
          onClick={() => { setOpen(false); onSelectLocal(); }}
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

        {mode === "vps" && onDisconnectVps && (
          <button
            onClick={() => { setOpen(false); onDisconnectVps(); }}
            className="w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
          >
            <span className="text-base leading-none mt-0.5">⏻</span>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium" style={{ color: "#f87171" }}>Prekini VPS vezu → lokalni engine</span>
              <span className="block text-[9px]" style={{ color: "var(--text-muted)" }}>Odspoji ovaj panel sa VPS mašine i nastavi lokalno</span>
            </span>
          </button>
        )}

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

        {prepStatus !== "idle" && (
          <div className={`px-3 py-2 border-t border-border text-[10px] ${prepColor}`}>
            <span className="font-semibold">{PREP_LABELS[prepStatus] || prepStatus}:</span>{" "}
            <span className="break-words">{prepMessage}</span>
          </div>
        )}
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
        {(() => {
          const cs = connectionStatus(mode, vpsStatus);
          const tone = STATUS_TONES[cs.tone];
          return (
            <span
              className="hidden sm:inline-flex items-center gap-1 text-[8px] font-semibold px-1.5 py-0.5 rounded"
              style={{ color: tone.text, border: `1px solid ${tone.border}`, background: tone.bg }}
            >
              {cs.label.replace("Status: ", "")}
            </span>
          );
        })()}
        {prepStatus === "preparing" && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
        <span className="text-[8px] opacity-70">{open ? "▴" : "▾"}</span>
      </button>
      {menu}
    </div>
  );
}
