import { useState, useCallback, useEffect } from "react";
import {
  getCostSummary, listUsageEvents, listPricing, listBudgets, createBudget, deleteBudget, getBackend,
  formatCost, formatTokens, formatLatency,
  PROVIDER_ICONS, PROVIDER_COLORS, BACKEND_LABELS, BACKEND_ICONS,
  type CostSummary, type UsageEvent, type ModelPricing, type UsageBudget, type UsageBackend,
} from "../../lib/usage.js";

interface Props {
  onClose: () => void;
}

type Tab = "overview" | "events" | "pricing" | "budgets";

export default function UsagePanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [pricing, setPricing] = useState<ModelPricing[]>([]);
  const [budgets, setBudgets] = useState<UsageBudget[]>([]);
  const [backend, setBackend] = useState<{ backend: UsageBackend; url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetName, setBudgetName] = useState("");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [budgetThreshold, setBudgetThreshold] = useState("80");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = `${dateFrom}T00:00:00Z`;
      const to = `${dateTo}T23:59:59Z`;
      const [s, p, b, be] = await Promise.all([
        getCostSummary({ from, to }),
        listPricing(),
        listBudgets(),
        getBackend(),
      ]);
      setSummary(s);
      setPricing(p);
      setBudgets(b);
      setBackend(be);
    } catch { /* ok */ }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  // Load events when switching to events tab
  useEffect(() => {
    if (tab !== "events") return;
    const from = `${dateFrom}T00:00:00Z`;
    const to = `${dateTo}T23:59:59Z`;
    listUsageEvents({ from, to, limit: 100 }).then(setEvents);
  }, [tab, dateFrom, dateTo]);

  const handleCreateBudget = useCallback(async () => {
    if (!budgetName || !budgetLimit) return;
    const b = await createBudget({
      name: budgetName,
      monthlyLimitUsd: parseFloat(budgetLimit),
      alertThresholdPercent: parseInt(budgetThreshold) || 80,
    });
    setBudgets((prev) => [...prev, b]);
    setShowBudgetForm(false);
    setBudgetName("");
    setBudgetLimit("");
    setBudgetThreshold("80");
  }, [budgetName, budgetLimit, budgetThreshold]);

  const handleDeleteBudget = useCallback(async (id: string) => {
    await deleteBudget(id);
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const maxDayCost = summary ? Math.max(...summary.byDay.map((d) => d.totalCostUsd), 0.01) : 1;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Pregled", icon: "📊" },
    { id: "events", label: "Događaji", icon: "📋" },
    { id: "pricing", label: "Cjenovnik", icon: "💲" },
    { id: "budgets", label: "Budžeti", icon: "🎯" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">📊</span>
            <span className="text-[13px] font-semibold text-text">Usage & Cost</span>
            {backend && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted">
                {BACKEND_ICONS[backend.backend]} {BACKEND_LABELS[backend.backend]}
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

        {/* Date range */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 shrink-0">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-surface-3 border border-border rounded px-2 py-1 text-[10px] text-text" />
          <span className="text-[10px] text-text-muted">—</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-surface-3 border border-border rounded px-2 py-1 text-[10px] text-text" />
          <span className="text-[9px] text-text-muted ml-auto">
            {summary ? `${summary.totalRequests} zahtjeva` : ""}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[11px] text-text-muted">Učitavanje...</div>
          ) : tab === "overview" && summary ? (
            <div className="p-4 space-y-4">
              {/* Total stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border border-border bg-surface-2/30">
                  <div className="text-[9px] text-text-muted mb-1">Ukupno troškovi</div>
                  <div className="text-[18px] font-bold text-accent">{formatCost(summary.totalCostUsd)}</div>
                </div>
                <div className="p-3 rounded-xl border border-border bg-surface-2/30">
                  <div className="text-[9px] text-text-muted mb-1">Ukupno tokena</div>
                  <div className="text-[18px] font-bold text-text">{formatTokens(summary.totalTokens)}</div>
                </div>
                <div className="p-3 rounded-xl border border-border bg-surface-2/30">
                  <div className="text-[9px] text-text-muted mb-1">Zahtjeva</div>
                  <div className="text-[18px] font-bold text-text">{summary.totalRequests}</div>
                </div>
              </div>

              {/* Daily chart */}
              {summary.byDay.length > 0 && (
                <div className="p-3 rounded-xl border border-border bg-surface-2/30">
                  <div className="text-[10px] font-medium text-text mb-2">Dnevni troškovi</div>
                  <div className="flex items-end gap-1 h-20">
                    {summary.byDay.map((d) => (
                      <button
                        key={d.label}
                        onClick={() => setSelectedDay(selectedDay === d.label ? null : d.label)}
                        className="flex-1 flex flex-col items-center gap-0.5 group"
                        title={`${d.label}: ${formatCost(d.totalCostUsd)}`}
                      >
                        <span className="text-[7px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatCost(d.totalCostUsd)}
                        </span>
                        <div
                          className={`w-full rounded-t transition-all ${
                            selectedDay === d.label ? "bg-accent" : "bg-accent/40 group-hover:bg-accent/70"
                          }`}
                          style={{ height: `${(d.totalCostUsd / maxDayCost) * 60}px`, minHeight: "2px" }}
                        />
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[7px] text-text-muted">{summary.byDay[0]?.label}</span>
                    <span className="text-[7px] text-text-muted">{summary.byDay[summary.byDay.length - 1]?.label}</span>
                  </div>
                </div>
              )}

              {/* By Provider */}
              <div className="rounded-xl border border-border bg-surface-2/30 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/50 text-[10px] font-medium text-text">Po Provideru</div>
                {summary.byProvider.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[10px] text-text-muted">Nema podataka</div>
                ) : (
                  summary.byProvider.map((p) => (
                    <div key={p.label} className="flex items-center justify-between px-3 py-2 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${PROVIDER_COLORS[p.label] || "text-text-muted"}`}>
                          {PROVIDER_ICONS[p.label] || "•"}
                        </span>
                        <span className="text-[11px] text-text">{p.label}</span>
                        <span className="text-[9px] text-text-muted">{p.requestCount} req</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] text-text-muted">{formatTokens(p.totalTokens)}</span>
                        <span className="text-[11px] font-medium text-text">{formatCost(p.totalCostUsd)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* By Model */}
              <div className="rounded-xl border border-border bg-surface-2/30 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/50 text-[10px] font-medium text-text">Po Modelu</div>
                {summary.byModel.length === 0 ? (
                  <div className="px-3 py-4 text-center text-[10px] text-text-muted">Nema podataka</div>
                ) : (
                  summary.byModel.map((m) => (
                    <div key={m.label} className="flex items-center justify-between px-3 py-2 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-text truncate">{m.label}</span>
                        <span className="text-[9px] text-text-muted">{m.requestCount} req</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[9px] text-text-muted">{formatTokens(m.totalTokens)}</span>
                        <span className="text-[11px] font-medium text-text">{formatCost(m.totalCostUsd)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Budget alerts */}
              {budgets.length > 0 && (
                <div className="rounded-xl border border-border bg-surface-2/30 overflow-hidden">
                  <div className="px-3 py-2 border-b border-border/50 text-[10px] font-medium text-text">Budžeti</div>
                  {budgets.map((b) => {
                    const pct = b.monthlyLimitUsd > 0 ? (b.currentSpendUsd / b.monthlyLimitUsd) * 100 : 0;
                    const isOver = pct >= 100;
                    const isWarning = pct >= b.alertThresholdPercent;
                    return (
                      <div key={b.id} className="px-3 py-2 border-b border-border/30 last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-text">{b.name}</span>
                          <span className={`text-[10px] font-medium ${isOver ? "text-red-400" : isWarning ? "text-yellow-400" : "text-text-muted"}`}>
                            {formatCost(b.currentSpendUsd)} / {formatCost(b.monthlyLimitUsd)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-surface-3 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-accent"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : tab === "events" ? (
            <div className="p-3">
              {events.length === 0 ? (
                <div className="text-center text-[11px] text-text-muted py-8">Nema događaja u ovom periodu</div>
              ) : (
                <div className="space-y-1">
                  {events.map((e) => (
                    <div key={e.id} className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-surface-2/20 hover:bg-surface-2/40 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-sm ${PROVIDER_COLORS[e.provider] || "text-text-muted"}`}>
                          {PROVIDER_ICONS[e.provider] || "•"}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[11px] text-text truncate">{e.provider}/{e.model}</div>
                          <div className="text-[8px] text-text-muted">
                            {formatTokens(e.inputTokens)} in · {formatTokens(e.outputTokens)} out
                            {e.latencyMs ? ` · ${formatLatency(e.latencyMs)}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[9px] px-1 py-0.5 rounded ${e.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                          {e.success ? "✓" : "✕"}
                        </span>
                        <span className="text-[11px] font-medium text-text">{formatCost(e.costUsd)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : tab === "pricing" ? (
            <div className="p-3">
              <div className="space-y-1">
                {pricing.map((p) => (
                  <div key={`${p.provider}/${p.model}`} className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-surface-2/20">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${PROVIDER_COLORS[p.provider] || "text-text-muted"}`}>
                        {PROVIDER_ICONS[p.provider] || "•"}
                      </span>
                      <div>
                        <div className="text-[11px] text-text">{p.label}</div>
                        <div className="text-[8px] text-text-muted">{p.provider}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="text-text-muted">In: <span className="text-text font-medium">${p.inputCostPer1M}</span>/1M</span>
                      <span className="text-text-muted">Out: <span className="text-text font-medium">${p.outputCostPer1M}</span>/1M</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Budgets tab */
            <div className="p-3 space-y-3">
              {budgets.map((b) => {
                const pct = b.monthlyLimitUsd > 0 ? (b.currentSpendUsd / b.monthlyLimitUsd) * 100 : 0;
                return (
                  <div key={b.id} className="p-3 rounded-xl border border-border bg-surface-2/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-medium text-text">{b.name}</span>
                        <span className={`text-[8px] px-1 py-0.5 rounded ${b.isHardLimit ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                          {b.isHardLimit ? "HARD" : "SOFT"}
                        </span>
                      </div>
                      <button onClick={() => handleDeleteBudget(b.id)} className="text-[9px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-500/10">✕</button>
                    </div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-text-muted">
                        {formatCost(b.currentSpendUsd)} / {formatCost(b.monthlyLimitUsd)}
                      </span>
                      <span className={`text-[10px] font-medium ${pct >= 100 ? "text-red-400" : pct >= b.alertThresholdPercent ? "text-yellow-400" : "text-accent"}`}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= b.alertThresholdPercent ? "bg-yellow-500" : "bg-accent"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[8px] text-text-muted">Alert pri {b.alertThresholdPercent}%</span>
                    </div>
                  </div>
                );
              })}

              {/* Create budget form */}
              {showBudgetForm ? (
                <div className="p-3 rounded-xl border border-accent/30 bg-accent/5 space-y-2">
                  <input
                    type="text"
                    value={budgetName}
                    onChange={(e) => setBudgetName(e.target.value)}
                    placeholder="Naziv budžeta"
                    className="w-full bg-surface-3 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={budgetLimit}
                      onChange={(e) => setBudgetLimit(e.target.value)}
                      placeholder="Mjesečni limit ($)"
                      className="flex-1 bg-surface-3 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
                    />
                    <input
                      type="number"
                      value={budgetThreshold}
                      onChange={(e) => setBudgetThreshold(e.target.value)}
                      placeholder="Alert %"
                      className="w-20 bg-surface-3 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowBudgetForm(false)} className="text-[10px] text-text-muted hover:text-text px-2 py-1 rounded">Otkaži</button>
                    <button onClick={handleCreateBudget} className="text-[10px] text-white bg-accent hover:bg-accent-light px-3 py-1 rounded-lg transition-colors">Kreiraj</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowBudgetForm(true)}
                  className="w-full py-2 text-[11px] font-medium rounded-xl border border-dashed border-border hover:border-accent/50 text-text-muted hover:text-accent transition-colors"
                >
                  + Novi budžet
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
