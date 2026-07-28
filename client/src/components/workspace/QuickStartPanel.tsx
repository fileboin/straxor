import { useState, useCallback, useEffect } from "react";
import {
  listTemplates, scaffoldProject, startDevServer, stopDevServer,
  getFrameworkColor, getFrameworkBg,
  type QuickStartTemplate, type QuickStartId, type DevServerStatus,
} from "../../lib/quickstart.js";

interface Props {
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  web: "Web",
  app: "Aplikacije",
  business: "Business",
};

const COLOR_BG: Record<string, string> = {
  green: "from-green-500/20 to-green-600/5 border-green-500/20 hover:border-green-400/40",
  blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20 hover:border-blue-400/40",
  purple: "from-purple-500/20 to-purple-600/5 border-purple-500/20 hover:border-purple-400/40",
  orange: "from-orange-500/20 to-orange-600/5 border-orange-500/20 hover:border-orange-400/40",
  yellow: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/20 hover:border-yellow-400/40",
  emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 hover:border-emerald-400/40",
  pink: "from-pink-500/20 to-pink-600/5 border-pink-500/20 hover:border-pink-400/40",
  indigo: "from-indigo-500/20 to-indigo-600/5 border-indigo-500/20 hover:border-indigo-400/40",
};

export default function QuickStartPanel({ onClose }: Props) {
  const [templates, setTemplates] = useState<QuickStartTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<QuickStartId | null>(null);
  const [projectName, setProjectName] = useState("");
  const [scaffolding, setScaffolding] = useState(false);
  const [result, setResult] = useState<{ projectDir: string } | null>(null);
  const [devStatus, setDevStatus] = useState<DevServerStatus | null>(null);
  const [startingDev, setStartingDev] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listTemplates().then(setTemplates).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = templates.filter((t) => {
    if (category !== "all" && t.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    }
    return true;
  });

  const selected = templates.find((t) => t.id === selectedId);

  const handleScaffold = useCallback(async () => {
    if (!selectedId || !projectName.trim()) return;
    setScaffolding(true);
    setError("");
    setResult(null);
    try {
      const r = await scaffoldProject(selectedId, projectName.trim(), null);
      if (r.success) {
        setResult(r);
      } else {
        setError(r.error || "Scaffolding failed");
      }
    } catch (err) {
      setError(String(err));
    }
    setScaffolding(false);
  }, [selectedId, projectName]);

  const handleStartDev = useCallback(async () => {
    if (!result || !selectedId || !projectName.trim()) return;
    setStartingDev(true);
    setError("");
    try {
      const status = await startDevServer(result.projectDir, selectedId, projectName.trim(), null);
      setDevStatus(status);
    } catch (err) {
      setError(String(err));
    }
    setStartingDev(false);
  }, [result, selectedId, projectName]);

  const handleStopDev = useCallback(async () => {
    if (!result) return;
    await stopDevServer(result.projectDir);
    setDevStatus(null);
  }, [result]);

  const categories = ["all", "web", "app", "business"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-4xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <span className="text-xl">✨</span>
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-text">Quick Start</h1>
                <p className="text-[11px] text-text-muted">Predlošci za brzi početak projekta</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">
              ✕
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pretraži predloške..."
              className="w-full bg-surface-3 border border-border rounded-xl px-3 py-2 text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-text-muted hover:text-text">
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
                {c === "all" ? "Sve" : CATEGORY_LABELS[c] || c}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
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
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedId(t.id); setProjectName(t.name); setResult(null); setDevStatus(null); setError(""); }}
                  className={`group relative p-4 rounded-xl border bg-gradient-to-br text-left transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 ${
                    COLOR_BG[t.color] || COLOR_BG.blue
                  } ${selectedId === t.id ? "ring-2 ring-accent" : ""}`}
                >
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">{t.icon}</div>
                  <div className="text-[12px] font-semibold text-text mb-0.5">{t.name}</div>
                  <div className="text-[10px] text-text-secondary leading-relaxed mb-2">{t.description}</div>
                  <div className={`text-[9px] px-1.5 py-0.5 rounded inline-block ${getFrameworkBg(t.framework)} ${getFrameworkColor(t.framework)}`}>
                    {t.framework}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail / Scaffold Panel */}
        {selected && (
          <div className="shrink-0 border-t border-border p-4 bg-surface-2/50">
            <div className="flex items-start gap-4">
              <div className="text-3xl">{selected.icon}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[13px] font-bold text-text mb-1">{selected.name}</h3>
                <p className="text-[11px] text-text-secondary mb-2">{selected.detailedDescription}</p>
                <div className="flex items-center gap-2 text-[10px] text-text-muted mb-2">
                  <span className="px-1.5 py-0.5 rounded bg-surface-3">{selected.framework}</span>
                  <span>Port: {selected.port}</span>
                  <span>{selected.dependencies.length} dep.</span>
                  {selected.devDependencies && <span>{selected.devDependencies.length} devDep.</span>}
                </div>

                {/* Dependencies */}
                {selected.dependencies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {selected.dependencies.map((d) => (
                      <span key={d.name} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted">
                        {d.name} {d.version}
                      </span>
                    ))}
                  </div>
                )}

                {/* Scaffold form */}
                {!result ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Ime projekta..."
                      className="flex-1 bg-surface-3 border border-border rounded-lg px-2.5 py-1.5 text-[12px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 transition-colors"
                    />
                    <button
                      onClick={handleScaffold}
                      disabled={scaffolding || !projectName.trim()}
                      className="px-3 py-1.5 rounded-lg bg-accent text-white text-[11px] font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {scaffolding ? "Kreiram..." : "Kreiraj projekat"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-[11px] text-green-400">
                      ✓ Projekat kreiran: {result.projectDir}
                    </div>
                    {!devStatus ? (
                      <button
                        onClick={handleStartDev}
                        disabled={startingDev}
                        className="px-3 py-1.5 rounded-lg bg-accent text-white text-[11px] font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {startingDev ? "Pokrećem..." : "Pokreni dev server"}
                      </button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-[11px] text-green-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Dev server radi na portu {devStatus.port}
                        </div>
                        {devStatus.url && (
                          <a
                            href={devStatus.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-accent hover:underline"
                          >
                            Otvori →
                          </a>
                        )}
                        <button
                          onClick={handleStopDev}
                          className="px-2 py-1 rounded-lg border border-red-500/30 text-red-400 text-[10px] hover:bg-red-500/10 transition-colors"
                        >
                          Zaustavi
                        </button>
                        <button
                          onClick={() => { setResult(null); setDevStatus(null); setSelectedId(null); }}
                          className="px-2 py-1 rounded-lg border border-border text-text-muted text-[10px] hover:text-text transition-colors"
                        >
                          Zatvori
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="mt-2 text-[10px] text-red-400">{error}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-border shrink-0">
          <div className="text-[9px] text-text-muted">
            {templates.length} predlošaka dostupno
          </div>
        </div>
      </div>
    </div>
  );
}
