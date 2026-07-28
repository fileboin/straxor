import { useState, useCallback } from "react";
import {
  webSearch,
  webSearchAll,
  type WebResearchResponse,
  type WebResearchResult,
} from "../../lib/web-research.js";

interface Props {
  onClose: () => void;
}

const PROVIDER_ICONS: Record<string, string> = {
  firecrawl: "🔥",
  tavily: "🦉",
  brave: "🦁",
  searxng: "🔍",
  "custom-crawler": "🕷",
};

const PROVIDER_COLORS: Record<string, string> = {
  firecrawl: "text-orange-400",
  tavily: "text-yellow-400",
  brave: "text-blue-400",
  searxng: "text-green-400",
  "custom-crawler": "text-purple-400",
};

export default function WebResearchPanel({ onClose }: Props) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("firecrawl");
  const [searching, setSearching] = useState(false);
  const [response, setResponse] = useState<WebResearchResponse | null>(null);
  const [allResponses, setAllResponses] = useState<WebResearchResponse[]>([]);
  const [searchMode, setSearchMode] = useState<"single" | "all">("single");
  const [error, setError] = useState("");
  const [selectedResult, setSelectedResult] = useState<WebResearchResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setResponse(null);
    setAllResponses([]);

    try {
      if (searchMode === "all") {
        const result = await webSearchAll(query);
        setAllResponses(result.responses);
      } else {
        const result = await webSearch(query, provider);
        setResponse(result);
      }
    } catch (err: any) {
      setError(err.message || "Search failed");
    } finally {
      setSearching(false);
    }
  }, [query, provider, searchMode]);

  const openDetail = useCallback((result: WebResearchResult) => {
    setSelectedResult(result);
    setShowDetail(true);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-4xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-xl">🔍</div>
            <div>
              <h1 className="text-[15px] font-bold text-text">Web Research</h1>
              <p className="text-[11px] text-text-muted">Firecrawl · Tavily · Brave · SearXNG · Custom Crawler</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">✕</button>
        </div>

        {/* Search bar */}
        <div className="p-4 border-b border-border/50 shrink-0">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setSearchMode("single")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                searchMode === "single" ? "bg-accent/15 text-accent border-accent/30" : "bg-surface-2/50 text-text-muted border-border"
              }`}
            >Single Provider</button>
            <button
              onClick={() => setSearchMode("all")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                searchMode === "all" ? "bg-accent/15 text-accent border-accent/30" : "bg-surface-2/50 text-text-muted border-border"
              }`}
            >All Providers</button>
          </div>

          <div className="flex gap-2">
            {searchMode === "single" && (
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="bg-surface-3 border border-border rounded-xl px-3 py-2 text-[12px] text-text"
              >
                {["firecrawl", "tavily", "brave", "searxng", "custom-crawler"].map((p) => (
                  <option key={p} value={p}>{PROVIDER_ICONS[p]} {p}</option>
                ))}
              </select>
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search the web..."
              className="flex-1 bg-surface-3 border border-border rounded-xl px-3 py-2 text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
            />
            <button
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="px-4 py-2 rounded-xl bg-accent text-white text-[11px] font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {searching ? "..." : "Search"}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-400">{error}</div>
          )}

          {response && (
            <div>
              <div className="text-[10px] text-text-muted mb-2">
                {response.totalResults} results from {response.provider} · {response.durationMs}ms
              </div>
              {response.results.map((r) => (
                <ResultCard key={r.id} result={r} onClick={() => openDetail(r)} />
              ))}
            </div>
          )}

          {allResponses.length > 0 && (
            <div className="space-y-4">
              {allResponses.map((resp) => (
                <div key={resp.provider}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className={PROVIDER_COLORS[resp.provider] || "text-text-muted"}>{PROVIDER_ICONS[resp.provider] || "🔍"}</span>
                    <span className="text-[11px] font-medium text-text">{resp.provider}</span>
                    <span className="text-[9px] text-text-muted">({resp.totalResults} results · {resp.durationMs}ms)</span>
                  </div>
                  <div className="space-y-1.5">
                    {resp.results.slice(0, 5).map((r) => (
                      <ResultCard key={r.id} result={r} compact onClick={() => openDetail(r)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!response && allResponses.length === 0 && !searching && !error && (
            <div className="text-[11px] text-text-muted text-center py-12">
              Enter a search query above to research the web
            </div>
          )}

          {searching && (
            <div className="text-[11px] text-text-muted text-center py-12">Searching...</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-border shrink-0">
          <div className="text-[9px] text-text-muted">Web Research v1 · Adapter Ecosystem</div>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetail && selectedResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowDetail(false)}>
          <div className="w-full max-w-2xl mx-4 bg-surface border border-border rounded-2xl overflow-hidden max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
              <div className="min-w-0">
                <h2 className="text-[13px] font-semibold text-text truncate">{selectedResult.title}</h2>
                <a href={selectedResult.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline truncate block">{selectedResult.url}</a>
              </div>
              <button onClick={() => setShowDetail(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors shrink-0 ml-3">✕</button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3">
              <div className="text-[11px] text-text leading-relaxed">{selectedResult.snippet}</div>
              {selectedResult.content && (
                <div>
                  <div className="text-[10px] font-medium text-text-muted mb-1">Content</div>
                  <div className="text-[11px] text-text-secondary leading-relaxed bg-surface-3 rounded-lg p-3">{selectedResult.content}</div>
                </div>
              )}
              {selectedResult.publishedDate && (
                <div className="text-[10px] text-text-muted">Published: {selectedResult.publishedDate}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCard({ result, onClick, compact }: { result: WebResearchResult; onClick: () => void; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl bg-surface-2/30 border border-border/50 hover:border-accent/30 hover:bg-surface-2/50 transition-all group"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-text group-hover:text-accent transition-colors truncate">{result.title}</div>
          <div className="text-[9px] text-text-muted truncate">{result.url}</div>
          <div className={`text-[10px] text-text-secondary mt-1 leading-relaxed ${compact ? "line-clamp-1" : ""}`}>{result.snippet}</div>
        </div>
        <div className="text-[9px] text-text-muted shrink-0 mt-0.5">{result.score.toFixed(2)}</div>
      </div>
    </button>
  );
}
