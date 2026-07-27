import { useState, useEffect, useRef, useCallback } from "react";
import { fetchLogs, streamLogs, exportLogs, type LogEntry, type LogCategory, type LogLevel } from "../../lib/logs";

const CATEGORIES: { id: LogCategory | "all"; label: string; color: string }[] = [
  { id: "all", label: "Svi", color: "text-text-secondary" },
  { id: "runtime", label: "Runtime", color: "text-accent" },
  { id: "agent", label: "Agent", color: "text-blue-400" },
  { id: "git", label: "Git", color: "text-yellow-400" },
  { id: "ssh", label: "SSH", color: "text-orange-400" },
  { id: "error", label: "Error", color: "text-red-400" },
  { id: "deployment", label: "Deploy", color: "text-purple-400" },
];

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: "text-text-secondary",
  warn: "text-yellow-400",
  error: "text-red-400",
  debug: "text-text-muted",
};

const LEVEL_ICONS: Record<LogLevel, string> = {
  info: "i",
  warn: "!",
  error: "x",
  debug: "d",
};

export default function LogViewer() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [category, setCategory] = useState<LogCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<(() => void) | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      const params: Record<string, unknown> = { limit: 200 };
      if (category !== "all") params.category = category;
      if (levelFilter !== "all") params.level = levelFilter;
      if (query) params.query = query;
      const logs = await fetchLogs(params);
      setEntries(logs);
    } catch {}
  }, [category, levelFilter, query]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    streamRef.current = streamLogs(
      category !== "all" ? category : undefined,
      (entry) => {
        setEntries((prev) => {
          const next = [entry, ...prev];
          return next.slice(0, 500);
        });
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
    if (levelFilter !== "all" && e.level !== levelFilter) return false;
    if (query && !e.message.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const handleExport = async (format: "json" | "csv") => {
    try {
      await exportLogs(format, category !== "all" ? category : undefined);
    } catch {}
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-surface sm:gap-2 sm:px-3">
        {/* Category tabs — scrollable on mobile */}
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

        {/* Search — hidden on very small screens */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pretrazi..."
          className="hidden sm:block px-2 py-0.5 text-[10px] bg-bg border border-border rounded w-32 focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
        />

        {/* Level filter */}
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LogLevel | "all")}
          className="px-1 py-0.5 text-[10px] bg-bg border border-border rounded focus:outline-none focus:border-accent text-text-secondary"
        >
          <option value="all">Sve</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
          <option value="debug">Debug</option>
        </select>

        {/* Export */}
        <div className="relative group">
          <button className="px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text-secondary border border-border rounded transition-colors">
            Export
          </button>
          <div className="hidden group-hover:block absolute right-0 top-full mt-1 bg-surface border border-border rounded shadow-lg z-10">
            <button
              onClick={() => handleExport("json")}
              className="block w-full px-3 py-1 text-[10px] text-text-secondary hover:bg-surface-2 text-left"
            >
              JSON
            </button>
            <button
              onClick={() => handleExport("csv")}
              className="block w-full px-3 py-1 text-[10px] text-text-secondary hover:bg-surface-2 text-left"
            >
              CSV
            </button>
          </div>
        </div>

        {/* Auto-scroll toggle */}
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

      {/* Log list */}
      <div ref={listRef} className="flex-1 overflow-y-auto font-mono text-[11px] leading-[1.6] bg-bg">
        {filtered.length === 0 ? (
          <div className="p-3 text-text-muted text-center text-[11px]">Nema logova</div>
        ) : (
          filtered.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 px-3 py-0.5 hover:bg-surface/50 border-b border-border/30"
            >
              <span className="text-text-muted shrink-0 w-[70px]">
                {formatTime(entry.timestamp)}
              </span>
              <span
                className={`shrink-0 w-4 text-center font-bold ${LEVEL_STYLES[entry.level]}`}
              >
                {LEVEL_ICONS[entry.level]}
              </span>
              <span className="shrink-0 w-[52px] text-[9px] uppercase font-semibold text-text-muted">
                {entry.category}
              </span>
              {entry.source && (
                <span className="shrink-0 text-text-muted">[{entry.source}]</span>
              )}
              <span className="text-text-secondary break-all">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
