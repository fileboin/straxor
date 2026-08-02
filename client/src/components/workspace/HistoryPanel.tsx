import { useState, useEffect, useCallback } from "react";
import { changeHistory, type ChangeEntry } from "../../lib/history";

interface Props {
  open: boolean;
  onClose: () => void;
  onJump: (entry: ChangeEntry, direction: "undo" | "redo") => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return "Upravo sad";
  if (diffMin < 60) return `Prije ${diffMin} min`;
  if (diffHr < 24) return `Prije ${diffHr} sat`;

  return d.toLocaleDateString("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  user: { label: "Korisnik", color: "text-[#4ec9b0]" },
  agent: { label: "Agent", color: "text-[#c586c0]" },
  system: { label: "Sustav", color: "text-text-muted" },
};

export default function HistoryPanel({ open, onClose, onJump }: Props) {
  const [entries, setEntries] = useState<ChangeEntry[]>([]);
  const [pointer, setPointer] = useState(-1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setEntries(changeHistory.getEntries());
    setPointer(changeHistory.getCurrentPointer());
  }, []);

  useEffect(() => {
    if (!open) return;
    refresh();
    const unsub = changeHistory.subscribe(refresh);
    return unsub;
  }, [open, refresh]);

  if (!open) return null;

  // Group entries by date
  const groups: Record<string, ChangeEntry[]> = {};
  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    const key = d.toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "numeric" });
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }

  function getEntryIndex(entry: ChangeEntry): number {
    return entries.findIndex((e) => e.id === entry.id);
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#0e1422]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#202838] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-[11px] font-medium">Povijest promjena</span>
          <span className="text-[9px] text-text-muted/50">
            {entries.length} zapisa &middot; {pointer + 1}/{entries.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const entry = changeHistory.undo();
              if (entry) onJump(entry, "undo");
            }}
            disabled={!changeHistory.canUndo()}
            className="px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text disabled:opacity-20"
            title="Undo (natrag)"
          >↶</button>
          <button
            onClick={() => {
              const entry = changeHistory.redo();
              if (entry) onJump(entry, "redo");
            }}
            disabled={!changeHistory.canRedo()}
            className="px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text disabled:opacity-20"
            title="Redo (naprijed)"
          >↷</button>
          <button
            onClick={() => {
              if (window.confirm("Obrisati cijelu povijest?")) {
                changeHistory.clear();
                refresh();
              }
            }}
            className="px-1.5 py-0.5 text-[10px] text-red-400/60 hover:text-red-400"
            title="Obriši povijest"
          >🗑</button>
          <button onClick={onClose} className="px-1.5 py-0.5 text-text-muted hover:text-text text-[11px]">✕</button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted text-[11px]">
            <span className="text-2xl opacity-10">↶</span>
            <span>Nema zapisa promjena</span>
            <span className="text-[9px] opacity-40">Promjene će se automatski bilježiti</span>
          </div>
        )}

        {Object.entries(groups).map(([date, dateEntries]) => (
          <div key={date}>
            {/* Date header */}
            <div className="px-3 py-1.5 text-[9px] text-text-muted/40 uppercase tracking-wider bg-[#0a0e1a] sticky top-0 z-10">
              {date}
            </div>

            {dateEntries.map((entry) => {
              const idx = getEntryIndex(entry);
              const isCurrent = idx === pointer;
              const isFuture = idx > pointer;
              const badge = SOURCE_BADGES[entry.source];
              const isExpanded = expanded === entry.id;

              return (
                <div
                  key={entry.id}
                  className={`border-b border-[#202838] transition-colors ${
                    isCurrent ? "bg-accent/5 border-l-2 border-l-accent" : ""
                  } ${isFuture ? "opacity-30" : ""}`}
                >
                  <div
                    onClick={() => setExpanded(isExpanded ? null : entry.id)}
                    className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-surface-2/30"
                  >
                    {/* Timeline dot */}
                    <div className="shrink-0 mt-1">
                      <div className={`w-2 h-2 rounded-full ${
                        isCurrent ? "bg-accent" : isFuture ? "bg-[#2d3750]" : "bg-[#4a5878]"
                      }`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-text truncate">{entry.fileName}</span>
                        <span className={`text-[8px] font-medium ${badge.color}`}>{badge.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-text-muted">{entry.description}</span>
                        <span className="text-[9px] text-text-muted/40">{formatTime(entry.timestamp)}</span>
                      </div>
                    </div>

                    {/* Jump button */}
                    {!isCurrent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onJump(entry, idx > pointer ? "redo" : "undo");
                        }}
                        className="shrink-0 px-1.5 py-0.5 text-[9px] text-accent/60 hover:text-accent border border-accent/20 rounded transition-colors"
                      >
                        {idx > pointer ? "↷" : "↶"}
                      </button>
                    )}
                  </div>

                  {/* Expanded diff preview */}
                  {isExpanded && (
                    <div className="px-3 pb-2 ml-4">
                      <div className="bg-[#141824] rounded border border-[#2d3750] text-[10px] font-mono overflow-hidden">
                        <div className="px-2 py-1 border-b border-[#2d3750] text-text-muted">
                          <span className="text-red-400/60">−</span> {entry.contentBefore.split("\n").length} redaka
                          {" → "}
                          <span className="text-green-400/60">+</span> {entry.contentAfter.split("\n").length} redaka
                        </div>
                        <div className="max-h-32 overflow-y-auto">
                          {entry.contentBefore.split("\n").slice(0, 10).map((_line, i) => (
                            <div key={i} className="px-2 py-0 text-red-400/40">
                              − {_line}
                            </div>
                          ))}
                          {entry.contentBefore.split("\n").length > 10 && (
                            <div className="px-2 py-0 text-text-muted/30">…</div>
                          )}
                        </div>
                        <div className="border-t border-[#2d3750] max-h-32 overflow-y-auto">
                          {entry.contentAfter.split("\n").slice(0, 10).map((_line, i) => (
                            <div key={i} className="px-2 py-0 text-green-400/40">
                              + {_line}
                            </div>
                          ))}
                          {entry.contentAfter.split("\n").length > 10 && (
                            <div className="px-2 py-0 text-text-muted/30">…</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-[#202838] text-[9px] text-text-muted/50 flex items-center gap-3 shrink-0">
        <span>↶ undo</span>
        <span>↷ redo</span>
        <span>✕ zatvori</span>
        <span className="ml-auto">
          {changeHistory.canUndo() ? "↶ dostupno" : "—"}
          {" · "}
          {changeHistory.canRedo() ? "↷ dostupno" : "—"}
        </span>
      </div>
    </div>
  );
}
