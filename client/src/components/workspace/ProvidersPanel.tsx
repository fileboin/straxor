import { useState, useCallback, useEffect } from "react";
import {
  listProviders, saveProviderKey, deleteProviderKey,
  updateProviderConfig, checkProviderHealth, checkAllProvidersHealth,
  toggleProvider,
  type DirectProviderStatus,
  PROVIDER_COLORS,
} from "../../lib/providers.js";

interface Props {
  onClose: () => void;
}

export default function ProvidersPanel({ onClose }: Props) {
  const [providers, setProviders] = useState<DirectProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);

  // ── Load providers ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listProviders();
      setProviders(list);
    } catch { /* ok */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Save key ──
  const handleSaveKey = useCallback(async (providerId: string) => {
    if (!keyInput.trim()) return;
    setSaving(true);
    try {
      await saveProviderKey(providerId, keyInput.trim());
      setKeyInput("");
      await load();
    } catch { /* ok */ }
    setSaving(false);
  }, [keyInput, load]);

  // ── Delete key ──
  const handleDeleteKey = useCallback(async (providerId: string) => {
    try {
      await deleteProviderKey(providerId);
      await load();
    } catch { /* ok */ }
  }, [load]);

  // ── Toggle provider ──
  const handleToggle = useCallback(async (providerId: string, enabled: boolean) => {
    await toggleProvider(providerId, enabled);
    setProviders((prev) => prev.map((p) => (p.providerId === providerId ? { ...p, isEnabled: enabled } : p)));
  }, []);

  // ── Check health ──
  const handleCheckHealth = useCallback(async (providerId: string) => {
    setProviders((prev) => prev.map((p) => (p.providerId === providerId ? { ...p, isHealthy: null, lastError: null } : p)));
    try {
      const result = await checkProviderHealth(providerId);
      setProviders((prev) => prev.map((p) => (p.providerId === providerId ? {
        ...p,
        isHealthy: result.healthy,
        latencyMs: result.latencyMs,
        lastChecked: new Date().toISOString(),
        lastError: result.error ?? null,
      } : p)));
    } catch { /* ok */ }
  }, []);

  // ── Check all health ──
  const handleCheckAll = useCallback(async () => {
    setCheckingAll(true);
    try {
      const results = await checkAllProvidersHealth();
      setProviders((prev) => prev.map((p) => {
        const r = results[p.providerId];
        if (!r) return p;
        return {
          ...p,
          isHealthy: r.healthy,
          latencyMs: r.latencyMs,
          lastChecked: new Date().toISOString(),
          lastError: r.error ?? null,
        };
      }));
    } catch { /* ok */ }
    setCheckingAll(false);
  }, []);

  // ── Save custom base URL ──
  const handleSaveUrl = useCallback(async (providerId: string) => {
    await updateProviderConfig(providerId, { baseUrl: customUrl.trim() || undefined });
    setCustomUrl("");
    await load();
  }, [customUrl, load]);

  const healthyCount = providers.filter((p) => p.isHealthy === true).length;
  const configuredCount = providers.filter((p) => p.hasKey || p.def?.authMethod === "none").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">🔗</span>
            <span className="text-[13px] font-semibold text-text">Direktni Provideri</span>
            <span className="text-[10px] text-text-muted bg-surface-3 px-1.5 py-0.5 rounded">
              {configuredCount}/{providers.length} konfigurisano
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCheckAll}
              disabled={checkingAll}
              className="text-[11px] text-text-muted hover:text-text px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors disabled:opacity-50"
              title="Provjeri sve"
            >
              {checkingAll ? "⏳" : "💓"} {checkingAll ? "Provjeravam..." : "Svi zdravi"}
            </button>
            <button onClick={load} className="text-[11px] text-text-muted hover:text-text px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors" title="Osvježi">↻</button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">✕</button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-2/30 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className={`w-1.5 h-1.5 rounded-full ${healthyCount === providers.length ? "bg-green-500" : "bg-yellow-500"}`} />
            <span className="text-text-muted">{healthyCount} zdravo</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-text-muted">BYOK: {configuredCount} key-eva</span>
          </div>
          <div className="text-[10px] text-text-muted ml-auto">
            Bez gateway-a — direktna konekcija na API
          </div>
        </div>

        {/* Provider list */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[11px] text-text-muted">Učitavanje...</div>
          ) : (
            providers.map((p) => {
              const isExpanded = expandedId === p.providerId;
              const hasKey = p.hasKey || p.def?.authMethod === "none";
              const colorClass = PROVIDER_COLORS[p.providerId] || "text-text";

              return (
                <div
                  key={p.providerId}
                  className={`rounded-xl border transition-all ${
                    p.isEnabled
                      ? "border-border bg-surface-2/30"
                      : "border-border/50 bg-surface-2/10 opacity-50"
                  }`}
                >
                  {/* Provider row */}
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg shrink-0">{p.def?.icon || "❓"}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[12px] font-medium ${colorClass}`}>{p.def?.name || p.providerId}</span>
                          {p.def?.authMethod === "none" && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/10 text-green-400 font-medium">BESPLATNO</span>
                          )}
                        </div>
                        <div className="text-[10px] text-text-muted truncate">{p.def?.description}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Health indicator */}
                      {p.isHealthy !== null && (
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${p.isHealthy ? "bg-green-500" : "bg-red-500"}`} />
                          {p.latencyMs !== null && (
                            <span className="text-[9px] text-text-muted">{p.latencyMs}ms</span>
                          )}
                        </div>
                      )}

                      {/* Key status */}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        hasKey ? "bg-accent/10 text-accent" : "bg-surface-3 text-text-muted"
                      }`}>
                        {hasKey ? "✓ Key" : "No key"}
                      </span>

                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(p.providerId, !p.isEnabled)}
                        className={`w-8 h-[18px] rounded-full transition-colors relative ${p.isEnabled ? "bg-accent" : "bg-surface-3"}`}
                      >
                        <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${p.isEnabled ? "left-[14px]" : "left-[2px]"}`} />
                      </button>
                    </div>
                  </div>

                  {/* Expand/collapse button */}
                  <div className="px-3 pb-2 flex items-center gap-2">
                    <button
                      onClick={() => { setExpandedId(isExpanded ? null : p.providerId); setKeyInput(""); setCustomUrl(p.baseUrl || p.def?.baseUrl || ""); }}
                      className="text-[10px] text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-2 transition-colors"
                    >
                      {isExpanded ? "▾ Skupi" : "▸ Proširi"}
                    </button>
                    <button
                      onClick={() => handleCheckHealth(p.providerId)}
                      className="text-[10px] text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-2 transition-colors"
                    >
                      ↻ Provjeri
                    </button>
                    {p.lastChecked && (
                      <span className="text-[9px] text-text-muted ml-auto">
                        Provjereno: {new Date(p.lastChecked).toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-2.5">
                      {/* API Key input */}
                      {p.def && p.def.authMethod !== "none" && (
                        <div>
                          <label className="text-[10px] text-text-muted block mb-1">API Key</label>
                          <div className="flex gap-1.5">
                            <input
                              type="password"
                              value={keyInput}
                              onChange={(e) => setKeyInput(e.target.value)}
                              placeholder={p.hasKey ? "•••••••• (key postoji)" : "Unesi API key..."}
                              className="flex-1 bg-surface-3 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
                            />
                            <button
                              onClick={() => handleSaveKey(p.providerId)}
                              disabled={!keyInput.trim() || saving}
                              className="px-3 py-1.5 rounded-lg bg-accent text-white text-[10px] font-medium hover:bg-accent-light transition-colors disabled:opacity-40"
                            >
                              {saving ? "..." : "Spremi"}
                            </button>
                            {p.hasKey && p.def && (
                              <button
                                onClick={() => handleDeleteKey(p.providerId)}
                                className="px-2 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 text-[10px] transition-colors"
                                title="Obriši key"
                              >
                                🗑
                              </button>
                            )}
                          </div>
                          {p.keyPreview && (
                            <div className="text-[9px] text-text-muted mt-1">Trenutni: {p.keyPreview}</div>
                          )}
                        </div>
                      )}

                      {/* Custom base URL */}
                      <div>
                        <label className="text-[10px] text-text-muted block mb-1">Base URL {p.providerId === "ollama" ? "(lokalni server)" : ""}</label>
                        <div className="flex gap-1.5">
                          <input
                            value={customUrl}
                            onChange={(e) => setCustomUrl(e.target.value)}
                            placeholder={p.def?.baseUrl}
                            className="flex-1 bg-surface-3 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text font-mono placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
                          />
                          <button
                            onClick={() => handleSaveUrl(p.providerId)}
                            className="px-3 py-1.5 rounded-lg bg-surface-3 border border-border text-[10px] text-text-secondary hover:bg-surface-2 transition-colors"
                          >
                            Spremi URL
                          </button>
                        </div>
                      </div>

                      {/* Health error */}
                      {p.lastError && (
                        <div className="text-[10px] text-red-400 bg-red-500/5 rounded-lg px-2.5 py-1.5">
                          ⚠ {p.lastError}
                        </div>
                      )}

                      {/* Models list */}
                      <div>
                        <label className="text-[10px] text-text-muted block mb-1">Modeli ({p.def?.models.length || 0})</label>
                        <div className="flex flex-wrap gap-1">
                          {p.def?.models.map((m) => (
                            <span key={m.id} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary">
                              {m.name} {m.thinking && <span className="text-accent">⚡</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
