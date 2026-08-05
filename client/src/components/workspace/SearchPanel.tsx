import { useState, useCallback, useRef, useEffect } from "react";
import { searchProject, type SearchMode, type SearchResult, type SearchStats, SEARCH_MODE_LABELS, SEARCH_MODE_ICONS } from "../../lib/search";

interface Props {
  machineId: string | null;
  open: boolean;
  onClose: () => void;
  onFileSelect: (path: string, line?: number) => void;
}

const MODES: SearchMode[] = ["text", "filename", "regex"];

export default function SearchPanel({ machineId, open, onClose, onFileSelect }: Props) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("text");
  const [filePattern, setFilePattern] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setStats(null);
      setError(null);
    }
  }, [open]);

  const doSearch = useCallback(async () => {
    if (!machineId || !query.trim()) return;
    setLoading(true);
    setError(null);
    setSelectedIdx(0);
    try {
      const res = await searchProject({
        machineId,
        query: query.trim(),
        mode,
        filePattern: filePattern || undefined,
        caseSensitive,
        maxResults: 100,
      });
      setResults(res.results);
      setStats(res.stats);
    } catch (err: any) {
      setError(err.message || "Greška pri pretrazi");
    } finally {
      setLoading(false);
    }
  }, [machineId, query, mode, filePattern, caseSensitive]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0) {
        const r = results[selectedIdx];
        if (r) onFileSelect(r.path, r.line);
      } else {
        doSearch();
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Escape") {
      onClose();
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#0e1422]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#202838] shrink-0">
        <span className="text-text-muted text-[11px] font-medium">Pretraga</span>
        <div className="flex-1" />
        <button onClick={onClose} className="text-text-muted hover:text-text text-[11px] px-1">✕</button>
      </div>

      {/* Search controls */}
      <div className="px-3 py-2 border-b border-[#202838] space-y-2 shrink-0">
        {/* Mode tabs + input */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#0e1422] rounded-md border border-[#2d3750] overflow-hidden shrink-0">
            {MODES.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2 py-1 text-[10px] transition-colors ${
                  mode === m
                    ? "bg-accent/15 text-accent"
                    : "text-text-muted hover:text-text-secondary"
                }`}
                title={SEARCH_MODE_LABELS[m]}
              >
                {SEARCH_MODE_ICONS[m]}
              </button>
            ))}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === "filename" ? "Naziv datoteke..." :
              mode === "regex" ? "Regex uzorak..." :
              "Tekst za pretragu..."
            }
            className="flex-1 min-w-0 px-2 py-1 bg-[#0e1422] text-text text-[12px] rounded border border-[#202838] focus:border-accent outline-none"
          />
          <button
            onClick={doSearch}
            disabled={!query.trim() || loading}
            className="px-3 py-1 bg-accent/10 text-accent text-[11px] rounded hover:bg-accent/20 disabled:opacity-30 transition-colors shrink-0"
          >
            {loading ? "…" : "🔍"}
          </button>
        </div>

        {/* Options row */}
        <div className="flex items-center gap-3 text-[10px] text-text-muted">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
              className="w-3 h-3 accent-accent"
            />
            Velika/mala slova
          </label>
          <label className="flex items-center gap-1">
            <span>Filter:</span>
            <input
              type="text"
              value={filePattern}
              onChange={(e) => setFilePattern(e.target.value)}
              placeholder="*.tsx"
              className="w-16 px-1 py-0.5 bg-[#0e1422] text-text text-[10px] rounded border border-[#2d3750] focus:border-accent outline-none"
            />
          </label>
          {stats && (
            <span className="ml-auto text-text-muted/60">
              {stats.totalMatches} rezultata u {stats.filesSearched} datoteka ({stats.duration}ms)
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {error && (
          <div className="px-3 py-2 text-red-400 text-[11px]">{error}</div>
        )}

        {!loading && results.length === 0 && query && !error && (
          <div className="px-3 py-6 text-center text-text-muted text-[11px]">
            Nema rezultata za "{query}"
          </div>
        )}

        {results.map((r, i) => (
          <div
            key={`${r.path}:${r.line}:${i}`}
            data-idx={i}
            onClick={() => onFileSelect(r.path, r.line)}
            className={`group flex items-start gap-2 px-3 py-1.5 cursor-pointer border-b border-[#202838] transition-colors ${
              i === selectedIdx
                ? "bg-accent/10 text-text"
                : "text-text-secondary hover:bg-surface-2"
            }`}
          >
            {/* File path */}
            <div className="shrink-0 text-[10px] text-text-muted min-w-0">
              <span className="truncate block max-w-[180px]">{shortenPath(r.path)}</span>
            </div>
            {/* Line number */}
            {r.line > 0 && (
              <span className="text-[9px] text-accent/50 shrink-0 w-8 text-right">{r.line}</span>
            )}
            {/* Content */}
            <div className="flex-1 min-w-0 font-mono text-[11px] leading-tight">
              <code className="whitespace-pre-wrap break-all text-text-secondary/80">
                {r.content.trim()}
              </code>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-[#202838] text-[9px] text-text-muted/50 flex items-center gap-3 shrink-0">
        <span>↑↓ navigacija</span>
        <span>Enter otvori</span>
        <span>Esc zatvori</span>
        <span className="ml-auto">{SEARCH_MODE_LABELS[mode]}</span>
      </div>
    </div>
  );
}

function shortenPath(path: string): string {
  // Remove leading ./ or /
  let p = path.replace(/^\.\//, "").replace(/^\//, "");
  // If too long, show last 2 segments
  const parts = p.split("/");
  if (parts.length > 2) {
    return "…/" + parts.slice(-2).join("/");
  }
  return p;
}
