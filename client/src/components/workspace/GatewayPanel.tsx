import { useState, useCallback, useEffect } from "react";
import {
  listGateways, updateGateway, addGateway, removeGateway,
  getGatewayStatuses, checkGatewayHealth, resetGateway,
  getCacheStats, clearCache, getGatewayMetrics,
  type GatewayConfig, type ProviderStatus, type CacheStats, type GatewayMetrics,
  GATEWAY_LABELS, GATEWAY_ICONS, HEALTH_COLORS, CIRCUIT_COLORS,
} from "../../lib/gateway.js";

interface Props {
  onClose: () => void;
}

type Tab = "gateways" | "health" | "cache" | "metrics";

export default function GatewayPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("gateways");
  const [gateways, setGateways] = useState<GatewayConfig[]>([]);
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [metrics, setMetrics] = useState<GatewayMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<GatewayConfig>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGateway, setNewGateway] = useState({ id: "", name: "", baseUrl: "", apiKey: "" });

  // ── Load data ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [gw, st, ca, me] = await Promise.all([
        listGateways(),
        getGatewayStatuses(),
        getCacheStats(),
        getGatewayMetrics(),
      ]);
      setGateways(gw);
      setStatuses(st);
      setCache(ca);
      setMetrics(me);
    } catch { /* ok */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Toggle gateway ──
  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    await updateGateway(id, { isEnabled: enabled });
    setGateways((prev) => prev.map((g) => (g.id === id ? { ...g, isEnabled: enabled } : g)));
  }, []);

  // ── Start editing ──
  const handleStartEdit = useCallback((gw: GatewayConfig) => {
    setEditingId(gw.id);
    setEditDraft({ name: gw.name, baseUrl: gw.baseUrl, apiKey: gw.apiKey || "", priority: gw.priority, timeout: gw.timeout, rateLimit: gw.rateLimit });
  }, []);

  // ── Save edit ──
  const handleSaveEdit = useCallback(async () => {
    if (!editingId) return;
    await updateGateway(editingId, editDraft);
    setGateways((prev) => prev.map((g) => (g.id === editingId ? { ...g, ...editDraft, updatedAt: new Date().toISOString() } : g)));
    setEditingId(null);
    setEditDraft({});
  }, [editingId, editDraft]);

  // ── Add custom gateway ──
  const handleAdd = useCallback(async () => {
    if (!newGateway.id || !newGateway.name || !newGateway.baseUrl) return;
    await addGateway({
      id: newGateway.id,
      name: newGateway.name,
      type: "custom",
      baseUrl: newGateway.baseUrl,
      apiKey: newGateway.apiKey || undefined,
      isEnabled: true,
      priority: 10,
      timeout: 30000,
    });
    setShowAddForm(false);
    setNewGateway({ id: "", name: "", baseUrl: "", apiKey: "" });
    loadAll();
  }, [newGateway, loadAll]);

  // ── Delete gateway ──
  const handleDelete = useCallback(async (id: string) => {
    await removeGateway(id);
    setGateways((prev) => prev.filter((g) => g.id !== id));
  }, []);

  // ── Refresh health ──
  const handleRefreshHealth = useCallback(async (id: string) => {
    await checkGatewayHealth(id);
    const st = await getGatewayStatuses();
    setStatuses(st);
  }, []);

  // ── Reset circuit breaker ──
  const handleResetCircuit = useCallback(async (id: string) => {
    await resetGateway(id);
    const st = await getGatewayStatuses();
    setStatuses(st);
  }, []);

  // ── Clear cache ──
  const handleClearCache = useCallback(async () => {
    await clearCache();
    const ca = await getCacheStats();
    setCache(ca);
  }, []);

  const getStatus = (id: string) => statuses.find((s) => s.gatewayId === id);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "gateways", label: "Gatewayi", icon: "⚡" },
    { id: "health", label: "Zdravlje", icon: "💓" },
    { id: "cache", label: "Cache", icon: "💾" },
    { id: "metrics", label: "Metrike", icon: "📊" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚡</span>
            <span className="text-[13px] font-semibold text-text">AI Gateway / Token Router</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={loadAll} className="text-[11px] text-text-muted hover:text-text px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors" title="Osvježi">
              ↻
            </button>
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

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[11px] text-text-muted">Učitavanje...</div>
          ) : tab === "gateways" ? (
            <div className="p-3 space-y-2">
              {gateways.map((gw) => {
                const status = getStatus(gw.id);
                const isEditing = editingId === gw.id;

                return (
                  <div key={gw.id} className={`p-3 rounded-xl border transition-colors ${gw.isEnabled ? "border-border bg-surface-2/30" : "border-border/50 bg-surface-2/10 opacity-60"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">{GATEWAY_ICONS[gw.type]}</span>
                        <div className="min-w-0">
                          {isEditing ? (
                            <input value={editDraft.name || ""} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} className="w-full bg-surface-3 border border-border rounded px-2 py-0.5 text-[12px] text-text" />
                          ) : (
                            <div className="text-[12px] font-medium text-text truncate">{gw.name}</div>
                          )}
                          <div className="text-[10px] text-text-muted">{GATEWAY_LABELS[gw.type]}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {status && (
                          <span className={`text-[10px] font-medium ${HEALTH_COLORS[status.health]}`}>
                            {status.health}
                          </span>
                        )}
                        <button onClick={() => handleToggle(gw.id, !gw.isEnabled)} className={`w-8 h-[18px] rounded-full transition-colors relative ${gw.isEnabled ? "bg-accent" : "bg-surface-3"}`}>
                          <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${gw.isEnabled ? "left-[14px]" : "left-[2px]"}`} />
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-1.5 mt-2">
                        <input value={editDraft.baseUrl || ""} onChange={(e) => setEditDraft((d) => ({ ...d, baseUrl: e.target.value }))} placeholder="Base URL" className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-[11px] text-text" />
                        <input value={editDraft.apiKey || ""} onChange={(e) => setEditDraft((d) => ({ ...d, apiKey: e.target.value }))} placeholder="API Key (optional)" type="password" className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-[11px] text-text" />
                        <div className="flex gap-2">
                          <input value={editDraft.priority || ""} onChange={(e) => setEditDraft((d) => ({ ...d, priority: parseInt(e.target.value) || 10 }))} placeholder="Priority" type="number" className="w-20 bg-surface-3 border border-border rounded px-2 py-1 text-[11px] text-text" />
                          <input value={editDraft.timeout || ""} onChange={(e) => setEditDraft((d) => ({ ...d, timeout: parseInt(e.target.value) || 30000 }))} placeholder="Timeout (ms)" type="number" className="w-28 bg-surface-3 border border-border rounded px-2 py-1 text-[11px] text-text" />
                          <input value={editDraft.rateLimit || ""} onChange={(e) => setEditDraft((d) => ({ ...d, rateLimit: parseInt(e.target.value) || undefined }))} placeholder="Rate limit/min" type="number" className="flex-1 bg-surface-3 border border-border rounded px-2 py-1 text-[11px] text-text" />
                        </div>
                        <div className="flex justify-end gap-1.5 mt-1">
                          <button onClick={() => { setEditingId(null); setEditDraft({}); }} className="text-[10px] text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-2 transition-colors">Odustani</button>
                          <button onClick={handleSaveEdit} className="text-[10px] text-white bg-accent hover:bg-accent-light px-2 py-1 rounded transition-colors">Spremi</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-[10px] text-text-muted truncate max-w-[200px]">{gw.baseUrl}</div>
                        <div className="flex items-center gap-1">
                          {status && (
                            <button onClick={() => handleRefreshHealth(gw.id)} className="text-[10px] text-text-muted hover:text-text px-1.5 py-0.5 rounded hover:bg-surface-2 transition-colors" title="Provjeri zdravlje">↻</button>
                          )}
                          {status?.circuitState === "open" && (
                            <button onClick={() => handleResetCircuit(gw.id)} className="text-[10px] text-yellow-500 hover:text-yellow-400 px-1.5 py-0.5 rounded hover:bg-yellow-500/10 transition-colors" title="Reset circuit breaker">⚡</button>
                          )}
                          <button onClick={() => handleStartEdit(gw)} className="text-[10px] text-text-muted hover:text-text px-1.5 py-0.5 rounded hover:bg-surface-2 transition-colors">✎</button>
                          {gw.type === "custom" && (
                            <button onClick={() => handleDelete(gw.id)} className="text-[10px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-500/10 transition-colors">🗑</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add custom gateway */}
              {showAddForm ? (
                <div className="p-3 rounded-xl border border-accent/30 bg-accent/5">
                  <div className="text-[11px] font-medium text-text mb-2">Novi gateway</div>
                  <div className="space-y-1.5">
                    <input value={newGateway.id} onChange={(e) => setNewGateway((d) => ({ ...d, id: e.target.value }))} placeholder="ID (npr. my-proxy)" className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-[11px] text-text" />
                    <input value={newGateway.name} onChange={(e) => setNewGateway((d) => ({ ...d, name: e.target.value }))} placeholder="Naziv" className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-[11px] text-text" />
                    <input value={newGateway.baseUrl} onChange={(e) => setNewGateway((d) => ({ ...d, baseUrl: e.target.value }))} placeholder="Base URL" className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-[11px] text-text" />
                    <input value={newGateway.apiKey} onChange={(e) => setNewGateway((d) => ({ ...d, apiKey: e.target.value }))} placeholder="API Key (optional)" type="password" className="w-full bg-surface-3 border border-border rounded px-2 py-1 text-[11px] text-text" />
                  </div>
                  <div className="flex justify-end gap-1.5 mt-2">
                    <button onClick={() => { setShowAddForm(false); setNewGateway({ id: "", name: "", baseUrl: "", apiKey: "" }); }} className="text-[10px] text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-2 transition-colors">Odustani</button>
                    <button onClick={handleAdd} className="text-[10px] text-white bg-accent hover:bg-accent-light px-2 py-1 rounded transition-colors">Dodaj</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddForm(true)} className="w-full p-2 rounded-xl border border-dashed border-border hover:border-accent/50 text-[11px] text-text-muted hover:text-accent transition-colors">
                  + Dodaj custom gateway
                </button>
              )}
            </div>
          ) : tab === "health" ? (
            <div className="p-3 space-y-2">
              {statuses.length === 0 ? (
                <div className="text-center text-[11px] text-text-muted py-8">Nema podataka o zdravlju</div>
              ) : (
                statuses.map((s) => (
                  <div key={s.gatewayId} className="p-3 rounded-xl border border-border bg-surface-2/30">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{GATEWAY_ICONS[s.gatewayType]}</span>
                        <span className="text-[12px] font-medium text-text">{s.gatewayName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-medium ${HEALTH_COLORS[s.health]}`}>{s.health}</span>
                        <span className={`text-[10px] font-medium ${CIRCUIT_COLORS[s.circuitState]}`}>circuit: {s.circuitState}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[10px] text-text-muted">
                      <div>Latency: <span className="text-text-secondary">{s.latencyMs}ms</span></div>
                      <div>Errors: <span className="text-text-secondary">{(s.errorRate * 100).toFixed(1)}%</span></div>
                      <div>Requests: <span className="text-text-secondary">{s.totalRequests}</span></div>
                      <div>Cost: <span className="text-text-secondary">${s.monthlyCost.toFixed(2)}</span></div>
                    </div>
                    {s.lastError && <div className="mt-1.5 text-[10px] text-red-400 truncate">Error: {s.lastError}</div>}
                  </div>
                ))
              )}
            </div>
          ) : tab === "cache" ? (
            <div className="p-3 space-y-3">
              {cache ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                      <div className="text-[18px] font-bold text-text">{cache.totalEntries}</div>
                      <div className="text-[10px] text-text-muted">Unosa</div>
                    </div>
                    <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                      <div className="text-[18px] font-bold text-accent">{(cache.hitRate * 100).toFixed(0)}%</div>
                      <div className="text-[10px] text-text-muted">Hit rate</div>
                    </div>
                    <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                      <div className="text-[18px] font-bold text-green-400">{cache.savedTokens.toLocaleString()}</div>
                      <div className="text-[10px] text-text-muted">Ušteđeni tokeni</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] text-text-muted">
                      Hits: {cache.totalHits} | Misses: {cache.totalMisses} | Memory: {cache.memoryUsage}
                    </div>
                    <button onClick={handleClearCache} className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors">
                      Očisti cache
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center text-[11px] text-text-muted py-8">Nema cache podataka</div>
              )}
            </div>
          ) : (
            /* Metrics tab */
            <div className="p-3 space-y-3">
              {metrics ? (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                      <div className="text-[18px] font-bold text-text">{metrics.totalRequests}</div>
                      <div className="text-[10px] text-text-muted">Ukupno zahtjeva</div>
                    </div>
                    <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                      <div className="text-[18px] font-bold text-accent">{metrics.totalTokens.toLocaleString()}</div>
                      <div className="text-[10px] text-text-muted">Tokeni</div>
                    </div>
                    <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                      <div className="text-[18px] font-bold text-green-400">${metrics.totalCostUSD.toFixed(2)}</div>
                      <div className="text-[10px] text-text-muted">Ukupno troškovi</div>
                    </div>
                    <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                      <div className="text-[18px] font-bold text-text-secondary">{metrics.avgLatencyMs.toFixed(0)}ms</div>
                      <div className="text-[10px] text-text-muted">Prosječna latencija</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                      <div className="text-[14px] font-bold text-accent">{(metrics.cacheHitRate * 100).toFixed(0)}%</div>
                      <div className="text-[10px] text-text-muted">Cache hit rate</div>
                    </div>
                    <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                      <div className="text-[14px] font-bold text-yellow-400">{metrics.fallbackCount}</div>
                      <div className="text-[10px] text-text-muted">Fallback događaja</div>
                    </div>
                  </div>
                  {metrics.circuitBreakerTrips > 0 && (
                    <div className="p-2 rounded-xl border border-red-500/30 bg-red-500/5 text-center">
                      <div className="text-[14px] font-bold text-red-400">{metrics.circuitBreakerTrips}</div>
                      <div className="text-[10px] text-red-400">Circuit breaker tripping</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-[11px] text-text-muted py-8">Nema metrika</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
