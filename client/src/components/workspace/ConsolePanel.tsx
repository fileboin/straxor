import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchConsoleEntries,
  streamConsoleEntries,
  type ConsoleEntry,
  type ConsoleCategory,
} from "../../lib/console.js";

const CATEGORIES: { id: ConsoleCategory | "all"; label: string; color: string; icon: string }[] = [
  { id: "all", label: "Svi", color: "text-text-secondary", icon: "●" },
  { id: "build", label: "Build", color: "text-yellow-400", icon: "◆" },
  { id: "runtime", label: "Runtime", color: "text-red-400", icon: "!" },
  { id: "browser", label: "Browser", color: "text-orange-400", icon: "◉" },
  { id: "terminal", label: "Terminal", color: "text-text-muted", icon: "$" },
  { id: "stack", label: "Stack Trace", color: "text-purple-400", icon: "↳" },
];

const LEVEL_COLORS: Record<string, string> = {
  error: "text-red-400",
  warn: "text-yellow-400",
  info: "text-text-secondary",
  debug: "text-text-muted",
};

const LEVEL_BG: Record<string, string> = {
  error: "bg-red-500/5",
  warn: "bg-yellow-500/5",
  info: "",
  debug: "",
};

function StackTrace({ trace }: { trace: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = trace.split("\n");

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
      >
        {expanded ? "▾ Sklopi stack trace" : "▸ Prikaži stack trace"}
      </button>
      {expanded && (
        <pre className="mt-1 px-2 py-1.5 bg-surface-2 rounded text-[10px] font-mono text-text-muted leading-relaxed overflow-x-auto">
          {lines.map((line, i) => (
            <div key={i} className={i === 0 ? "text-text-secondary" : ""}>
              {line}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

function ConsoleRow({ entry }: { entry: ConsoleEntry }) {
  const time = new Date(entry.timestamp).toLocaleTimeString("hr-HR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const catDef = CATEGORIES.find((c) => c.id === entry.category);

  return (
    <div
      className={`px-3 py-1.5 border-b border-border/30 hover:bg-surface/50 transition-colors ${LEVEL_BG[entry.level] || ""}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-text-muted shrink-0 w-[65px] text-[10px]">
          {time}
        </span>
        <span
          className={`shrink-0 w-4 text-center font-bold text-[10px] ${
            LEVEL_COLORS[entry.level] || "text-text-muted"
          }`}
        >
          {entry.level === "error" ? "x" : entry.level === "warn" ? "!" : entry.level === "info" ? "i" : "d"}
        </span>
        <span
          className={`shrink-0 text-[9px] uppercase font-semibold w-[60px] ${
            catDef?.color || "text-text-muted"
          }`}
        >
          {entry.category}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-text-secondary whitespace-pre-wrap break-all font-mono leading-relaxed">
            {entry.message}
          </div>
          {entry.source && (
            <div className="text-[9px] text-text-muted mt-0.5">{entry.source}</div>
          )}
          {entry.stackTrace && <StackTrace trace={entry.stackTrace} />}
        </div>
      </div>
    </div>
  );
}

export default function ConsolePanel() {
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [category, setCategory] = useState<ConsoleCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<(() => void) | null>(null);

  const loadEntries = useCallback(async () => {
    try {
      const params: Record<string, unknown> = { limit: 300 };
      if (category !== "all") params.category = category;
      if (query) params.query = query;
      const data = await fetchConsoleEntries(params);
      setEntries(data);
    } catch {}
  }, [category, query]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    streamRef.current = streamConsoleEntries(
      category !== "all" ? category : undefined,
      (entry) => {
        setEntries((prev) => [entry, ...prev].slice(0, 500));
      }
    );
    return () => {
      streamRef.current?.();
    };
  }, [category]);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [entries, autoScroll]);

  const filtered = entries.filter((e) => {
    if (category !== "all" && e.category !== category) return false;
    if (query && !e.message.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const errorCount = entries.filter((e) => e.level === "error").length;
  const warnCount = entries.filter((e) => e.level === "warn").length;

  const clearAll = () => {
    setEntries([]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-surface sm:gap-2 sm:px-3">
        {/* Category tabs */}
        <div className="flex gap-0.5 overflow-x-auto shrink-0 scrollbar-none">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap sm:px-2 ${
                category === c.id
                  ? `${c.color} bg-surface-2`
                  : "text-text-muted hover:text-text-secondary hover:bg-surface-2/50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Error/warn badges */}
        {errorCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">
            {errorCount} errors
          </span>
        )}
        {warnCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-medium">
            {warnCount} warns
          </span>
        )}

        {/* Search */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pretraži..."
          className="hidden sm:block px-2 py-0.5 text-[10px] bg-bg border border-border rounded w-28 focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
        />

        {/* Clear */}
        <button
          onClick={clearAll}
          className="px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text border border-border rounded transition-colors"
        >
          Clear
        </button>

        {/* Auto-scroll */}
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
            autoScroll
              ? "text-accent border-accent/30 bg-accent/10"
              : "text-text-muted border-border hover:text-text-secondary"
          }`}
        >
          Auto
        </button>
      </div>

      {/* Entries */}
      <div ref={listRef} className="flex-1 overflow-y-auto bg-bg">
        {filtered.length === 0 ? (
          <div className="p-3 text-text-muted text-center text-[11px]">
            Nema grešaka — sve radi kako treba
          </div>
        ) : (
          filtered.map((entry) => (
            <ConsoleRow key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}
