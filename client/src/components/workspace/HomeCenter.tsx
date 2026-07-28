import { useState, useCallback, useEffect } from "react";
import { useTheme } from "../../lib/theme.js";
import { useAuth } from "../../lib/auth.js";
import {
  HOME_TILES, getHomeStats,
  type HomeTile, type HomeCenterStats,
} from "../../lib/home-center.js";

interface Props {
  onClose: () => void;
  onNavigate: (action: string) => void;
}

type Category = "all" | "ai" | "system" | "tools" | "info";

const CATEGORY_LABELS: Record<Category, string> = {
  all: "Sve",
  ai: "AI & Modeli",
  system: "Sistem",
  tools: "Alati",
  info: "Info",
};

const CATEGORY_ICONS: Record<Category, string> = {
  all: "◉",
  ai: "⚡",
  system: "⚙",
  tools: "🧰",
  info: "ℹ",
};

const TILE_COLORS: Record<string, string> = {
  blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20 hover:border-blue-400/40",
  green: "from-green-500/20 to-green-600/5 border-green-500/20 hover:border-green-400/40",
  purple: "from-purple-500/20 to-purple-600/5 border-purple-500/20 hover:border-purple-400/40",
  red: "from-red-500/20 to-red-600/5 border-red-500/20 hover:border-red-400/40",
  yellow: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/20 hover:border-yellow-400/40",
  orange: "from-orange-500/20 to-orange-600/5 border-orange-500/20 hover:border-orange-400/40",
  pink: "from-pink-500/20 to-pink-600/5 border-pink-500/20 hover:border-pink-400/40",
};

export default function HomeCenter({ onClose, onNavigate }: Props) {
  const { user, logout } = useAuth();
  const { toggleTheme, theme } = useTheme();
  const [category, setCategory] = useState<Category>("all");
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<HomeCenterStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHomeStats().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = HOME_TILES.filter((t) => {
    if (category !== "all" && t.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    }
    return true;
  });

  const categories: Category[] = ["all", "ai", "system", "tools", "info"];

  const handleTileClick = useCallback((tile: HomeTile) => {
    onNavigate(tile.action);
  }, [onNavigate]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <span className="text-xl">🏠</span>
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-text">Home Center</h1>
                <p className="text-[11px] text-text-muted">Centralno upravljanje Straxor platformom</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-surface-3 text-text-secondary text-xs hover:text-text transition-colors"
                title={theme === "dark" ? "Light tema" : "Dark tema"}
              >
                {theme === "dark" ? "☀" : "☾"}
              </button>
              <button
                onClick={() => { logout(); onClose(); }}
                className="text-[11px] text-red-400 hover:text-red-300 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
              >
                ⏻ Odjava
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* User info */}
          {user && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-surface-2/50 border border-border/50">
              <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[11px] font-bold text-accent">
                {user.email?.charAt(0).toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium text-text truncate">{user.email}</div>
                <div className="text-[9px] text-text-muted">
                  {stats ? `${stats.projects} projekata · ${stats.machines} VPS` : "Učitavanje..."}
                </div>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraži alate..."
              className="w-full bg-surface-3 border border-border rounded-xl px-3 py-2 text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-text-muted hover:text-text"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 mt-3 overflow-x-auto">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors ${
                  category === c
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "bg-surface-2/50 text-text-muted hover:text-text-secondary border border-transparent"
                }`}
              >
                <span>{CATEGORY_ICONS[c]}</span>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Stats Bar */}
        {stats && (
          <div className="flex items-center gap-3 px-5 py-2 border-b border-border/50 bg-surface-2/20 shrink-0 overflow-x-auto">
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span>{stats.activeMachines} VPS online</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted shrink-0">
              <span>🔗 {stats.apiKeys} API key-eva</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted shrink-0">
              <span>📋 {stats.sessions} sesija</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted shrink-0">
              <span>🚀 {stats.deployments} deployova</span>
            </div>
            {stats.recentLogs.length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted shrink-0 ml-auto">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  stats.recentLogs.some((l) => l.level === "error") ? "bg-red-500" : "bg-green-500"
                }`} />
                <span>Poslednji log: {stats.recentLogs[0]?.category}</span>
              </div>
            )}
          </div>
        )}

        {/* Tile Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[11px] text-text-muted">Učitavanje...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-[11px] text-text-muted">
              <span className="text-2xl mb-2">🔍</span>
              Nema rezultata za "{search}"
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map((tile) => (
                <button
                  key={tile.id}
                  onClick={() => handleTileClick(tile)}
                  className={`group relative p-4 rounded-xl border bg-gradient-to-br text-left transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 ${
                    TILE_COLORS[tile.color] || TILE_COLORS.blue
                  }`}
                >
                  {tile.badge && (
                    <span className="absolute top-2 right-2 text-[8px] px-1.5 py-0.5 rounded bg-surface/80 text-text-muted font-medium">
                      {tile.badge}
                    </span>
                  )}
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">{tile.icon}</div>
                  <div className="text-[12px] font-semibold text-text mb-0.5">{tile.name}</div>
                  <div className="text-[10px] text-text-secondary leading-relaxed">{tile.description}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-border shrink-0">
          <div className="text-[9px] text-text-muted">
            Straxor v1.0 · {HOME_TILES.length} alata dostupno
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/fileboin/straxor"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-text-muted hover:text-text transition-colors"
            >
              GitHub
            </a>
            <span className="text-text-muted/30">·</span>
            <a
              href="https://straxor.dev/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-text-muted hover:text-text transition-colors"
            >
              Docs
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
