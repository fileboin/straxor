import { useState, useCallback, useEffect } from "react";
import {
  listCollections, listIcons, listTokens, getStats,
  type DesignAsset, type AssetCollection, type DesignToken, type DesignAssetStats,
  CATEGORY_LABELS, TOKEN_CATEGORY_LABELS,
} from "../../lib/design-assets.js";

interface Props {
  onClose: () => void;
}

type Tab = "collections" | "icons" | "tokens";

export default function DesignAssetsPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("icons");
  const [collections, setCollections] = useState<AssetCollection[]>([]);
  const [icons, setIcons] = useState<DesignAsset[]>([]);
  const [tokens, setTokens] = useState<DesignToken[]>([]);
  const [stats, setStats] = useState<DesignAssetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [iconFilter, setIconFilter] = useState<string>("");
  const [tokenFilter, setTokenFilter] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<DesignAsset | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [co, ic, tk, st] = await Promise.all([
        listCollections(), listIcons(), listTokens(), getStats(),
      ]);
      setCollections(co);
      setIcons(ic);
      setTokens(tk);
      setStats(st);
    } catch { /* ok */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Search icons ──
  useEffect(() => {
    if (tab !== "icons") return;
    const timeout = setTimeout(() => {
      listIcons(iconFilter || undefined, search || undefined).then(setIcons);
    }, 200);
    return () => clearTimeout(timeout);
  }, [tab, iconFilter, search]);

  // ── Filter tokens ──
  useEffect(() => {
    if (tab !== "tokens") return;
    listTokens(tokenFilter || undefined).then(setTokens);
  }, [tab, tokenFilter]);

  // ── Copy SVG ──
  const handleCopy = useCallback(async (asset: DesignAsset) => {
    if (!asset.content) return;
    try {
      await navigator.clipboard.writeText(asset.content);
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* ok */ }
  }, []);

  // ── Copy token value ──
  const handleCopyToken = useCallback(async (token: DesignToken) => {
    try {
      await navigator.clipboard.writeText(token.value);
      setCopiedId(token.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* ok */ }
  }, []);

  // ── Copy tailwind class ──
  const handleCopyClass = useCallback(async (token: DesignToken) => {
    if (!token.tailwindClass) return;
    try {
      await navigator.clipboard.writeText(token.tailwindClass);
      setCopiedId(token.id + "-tw");
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* ok */ }
  }, []);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "icons", label: "Ikone", icon: "◆" },
    { id: "tokens", label: "Tokeni", icon: "🎨" },
    { id: "collections", label: "Kolekcije", icon: "📚" },
  ];

  const iconCategories = [...new Set(icons.map((i) => i.category))];
  const tokenCategories = [...new Set(tokens.map((t) => t.category))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">🎨</span>
            <span className="text-[13px] font-semibold text-text">Design Asset Layer</span>
            {stats && (
              <span className="text-[10px] text-text-muted bg-surface-3 px-1.5 py-0.5 rounded">
                {stats.totalAssets}+ assets · {stats.totalTokens} tokena
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={load} className="text-[11px] text-text-muted hover:text-text px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors">↻</button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
                tab === t.id
                  ? "text-accent border-b-2 border-accent"
                  : "text-text-muted hover:text-text-secondary border-b-2 border-transparent"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        {tab === "icons" && (
          <div className="px-4 py-2 border-b border-border/50 shrink-0">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraži ikone..."
              className="w-full bg-surface-3 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
            />
          </div>
        )}

        {/* Category filters */}
        <div className="flex gap-1 px-4 py-2 border-b border-border/50 shrink-0 overflow-x-auto">
          {tab === "icons" && (
            <>
              <button onClick={() => setIconFilter("")} className={`text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors ${!iconFilter ? "bg-accent/15 text-accent" : "bg-surface-2 text-text-muted hover:text-text-secondary"}`}>
                Sve ({icons.length})
              </button>
              {iconCategories.map((c) => (
                <button key={c} onClick={() => setIconFilter(c)} className={`text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors ${iconFilter === c ? "bg-accent/15 text-accent" : "bg-surface-2 text-text-muted hover:text-text-secondary"}`}>
                  {CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] || c}
                </button>
              ))}
            </>
          )}
          {tab === "tokens" && (
            <>
              <button onClick={() => setTokenFilter("")} className={`text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors ${!tokenFilter ? "bg-accent/15 text-accent" : "bg-surface-2 text-text-muted hover:text-text-secondary"}`}>
                Sve ({tokens.length})
              </button>
              {tokenCategories.map((c) => (
                <button key={c} onClick={() => setTokenFilter(c)} className={`text-[9px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors ${tokenFilter === c ? "bg-accent/15 text-accent" : "bg-surface-2 text-text-muted hover:text-text-secondary"}`}>
                  {TOKEN_CATEGORY_LABELS[c] || c}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[11px] text-text-muted">Učitavanje...</div>
          ) : tab === "icons" ? (
            <div className="p-3">
              {icons.length === 0 ? (
                <div className="text-center text-[11px] text-text-muted py-8">Nema ikona</div>
              ) : (
                <>
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5">
                    {icons.map((asset) => (
                      <button
                        key={asset.id}
                        onClick={() => setSelectedIcon(asset)}
                        className={`group relative aspect-square flex items-center justify-center rounded-lg border transition-all hover:scale-110 hover:shadow-lg hover:shadow-black/20 ${
                          selectedIcon?.id === asset.id
                            ? "border-accent bg-accent/10"
                            : "border-border/50 bg-surface-2/30 hover:border-border"
                        }`}
                        title={asset.name}
                      >
                        <div
                          className="w-5 h-5 text-text-secondary group-hover:text-text transition-colors"
                          dangerouslySetInnerHTML={{ __html: asset.content || "" }}
                        />
                        {copiedId === asset.id && (
                          <span className="absolute -top-1 -right-1 text-[7px] bg-accent text-white px-1 rounded">✓</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Selected icon detail */}
                  {selectedIcon && (
                    <div className="mt-3 p-3 rounded-xl border border-accent/30 bg-accent/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: selectedIcon.content || "" }} />
                          <div>
                            <div className="text-[12px] font-medium text-text">{selectedIcon.name}</div>
                            <div className="text-[9px] text-text-muted">{selectedIcon.source} · {selectedIcon.license}</div>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleCopy(selectedIcon)}
                            className="text-[10px] text-white bg-accent hover:bg-accent-light px-2 py-1 rounded transition-colors"
                          >
                            {copiedId === selectedIcon.id ? "✓ Kopirano" : "Kopiraj SVG"}
                          </button>
                          <button
                            onClick={() => setSelectedIcon(null)}
                            className="text-[10px] text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-2 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {selectedIcon.tags.map((t) => (
                          <span key={t} className="text-[8px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : tab === "tokens" ? (
            <div className="p-3 space-y-1.5">
              {tokens.length === 0 ? (
                <div className="text-center text-[11px] text-text-muted py-8">Nema tokena</div>
              ) : (
                tokens.map((token) => (
                  <div
                    key={token.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-surface-2/20 hover:bg-surface-2/40 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {token.category === "color" && (
                        <div className="w-4 h-4 rounded border border-border/50 shrink-0" style={{ backgroundColor: token.value }} />
                      )}
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-text">{token.name}</div>
                        <div className="text-[9px] text-text-muted">{token.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {token.cssVar && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted font-mono">{token.cssVar}</span>
                      )}
                      {token.tailwindClass && (
                        <button
                          onClick={() => handleCopyClass(token)}
                          className={`text-[8px] px-1.5 py-0.5 rounded font-mono transition-colors ${
                            copiedId === token.id + "-tw"
                              ? "bg-accent/15 text-accent"
                              : "bg-surface-3 text-text-muted hover:text-text-secondary"
                          }`}
                        >
                          .{token.tailwindClass}
                        </button>
                      )}
                      <button
                        onClick={() => handleCopyToken(token)}
                        className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                          copiedId === token.id
                            ? "bg-accent/15 text-accent"
                            : "bg-surface-3 text-text-muted hover:text-text-secondary"
                        }`}
                      >
                        {copiedId === token.id ? "✓" : token.value}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* Collections tab */
            <div className="p-3 space-y-2">
              {collections.map((col) => (
                <div key={col.id} className="p-3 rounded-xl border border-border bg-surface-2/30">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{col.icon}</span>
                      <div>
                        <span className="text-[12px] font-medium text-text">{col.name}</span>
                        {col.version && <span className="text-[9px] text-text-muted bg-surface-3 px-1.5 py-0.5 rounded ml-2">v{col.version}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${col.isInstalled ? "bg-green-500/10 text-green-400" : "bg-surface-3 text-text-muted"}`}>
                        {col.isInstalled ? "✓ Instaliran" : "Nije instaliran"}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-text-secondary mb-1.5">{col.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-text-muted">{col.assetCount}+ assets · {col.source}</span>
                    <a
                      href={col.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-accent hover:text-accent-light transition-colors"
                    >
                      {col.url === "#" ? "Lokalno" : "Posjeti →"}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
