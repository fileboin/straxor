import { useState, useRef, useEffect } from "react";

interface Props {
  machineId: string | null;
  hasRepo: boolean;
  repoName?: string | null;
  onSelectLocal: () => void;
  onConnectVps: () => void;
  onOpenGitRemote: () => void;
  onOpenRuntimeManager: () => void;
}

const isLocal = (id: string | null) => !!id && id.startsWith("local:");

export default function EnginePicker({
  machineId,
  hasRepo,
  repoName,
  onSelectLocal,
  onConnectVps,
  onOpenGitRemote,
  onOpenRuntimeManager,
}: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const mode = isLocal(machineId)
    ? "local"
    : machineId
      ? "vps"
      : "none";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
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

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={modeTitle}
        className={`h-7 px-2 rounded-md text-[10px] font-medium border transition-colors flex items-center gap-1 ${modeColor}`}
      >
        {modeLabel}
        <span className="text-[8px] opacity-70">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-64 rounded-xl border border-border bg-surface shadow-2xl shadow-black/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-surface-2">
            <div className="text-[10px] font-semibold text-text">Agent engine</div>
            <div className="text-[9px] text-text-muted mt-0.5">Gdje agent izvršava zadatke</div>
          </div>

          <button
            onClick={() => { setOpen(false); onSelectLocal(); }}
            disabled={!hasRepo}
            className={`w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors ${
              mode === "local" ? "bg-accent/10" : "hover:bg-surface-2"
            } ${!hasRepo ? "opacity-50 cursor-not-allowed" : ""}`}
            title={hasRepo ? "Pokreni agenta na lokalno kloniranom repou (bez VPS-a)" : "Prvo poveži GitHub repo"}
          >
            <span className="text-base leading-none mt-0.5">◇</span>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-text">Lokalni engine (repo)</span>
              <span className="block text-[9px] text-text-muted">
                {hasRepo
                  ? repoName ? `Radi u ${repoName} — bez VPS-a` : "Radi u kloniranom repou — bez VPS-a"
                  : "Poveži GitHub repo prvo"}
              </span>
            </span>
            {mode === "local" && <span className="ml-auto text-[9px] text-accent shrink-0">●</span>}
          </button>

          <button
            onClick={() => { setOpen(false); onConnectVps(); }}
            className={`w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors ${
              mode === "vps" ? "bg-blue-400/10" : "hover:bg-surface-2"
            }`}
          >
            <span className="text-base leading-none mt-0.5">⏻</span>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium text-text">VPS mašina</span>
              <span className="block text-[9px] text-text-muted">Poveži SSH server i pokreni agenta tamo</span>
            </span>
            {mode === "vps" && <span className="ml-auto text-[9px] text-blue-400 shrink-0">●</span>}
          </button>

          {!hasRepo && (
            <button
              onClick={() => { setOpen(false); onOpenGitRemote(); }}
              className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-surface-2 transition-colors"
            >
              <span className="text-base leading-none mt-0.5">🔗</span>
              <span className="min-w-0">
                <span className="block text-[11px] font-medium text-text">GitHub repo</span>
                <span className="block text-[9px] text-text-muted">Poveži repozitorijum za agenta</span>
              </span>
            </button>
          )}

          <div className="border-t border-border">
            <button
              onClick={() => { setOpen(false); onOpenRuntimeManager(); }}
              className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-surface-2 transition-colors"
            >
              <span className="text-base leading-none mt-0.5">⚙</span>
              <span className="min-w-0">
                <span className="block text-[11px] font-medium text-text">Runtime Manager</span>
                <span className="block text-[9px] text-text-muted">Health, restart, MCP serveri</span>
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
