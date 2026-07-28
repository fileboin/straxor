import { useState, useEffect, useCallback } from "react";
import {
  resilienceApi,
  type VaultSecret,
  type SessionGuardrail,
  type SystemSnapshot,
  type OfflineConfig,
  type ResilienceStatus,
} from "../../lib/resilience";

interface Props {
  onClose: () => void;
}

type Tab = "overview" | "vault" | "guardrails" | "snapshots" | "offline";

const VAULT_TYPES = ["api_key", "ssh_key", "credential", "config", "token", "certificate"];

export default function EnterpriseResilience({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [status, setStatus] = useState<ResilienceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Vault
  const [secrets, setSecrets] = useState<VaultSecret[]>([]);
  const [showSecretForm, setShowSecretForm] = useState(false);
  const [secretForm, setSecretForm] = useState({ name: "", type: "api_key", value: "" });
  const [decryptedValue, setDecryptedValue] = useState("");

  // Guardrails
  const [guardrails, setGuardrails] = useState<SessionGuardrail[]>([]);
  const [showGuardForm, setShowGuardForm] = useState(false);
  const [guardForm, setGuardForm] = useState({ sessionId: "", maxTokens: 100000, maxCost: 1000 });

  // Snapshots
  const [snapshots, setSnapshots] = useState<SystemSnapshot[]>([]);
  const [showSnapshotForm, setShowSnapshotForm] = useState(false);
  const [snapForm, setSnapForm] = useState({ name: "", type: "full" });
  const [restoreMsg, setRestoreMsg] = useState("");

  // Offline
  const [offlineCfg, setOfflineCfg] = useState<OfflineConfig | null>(null);

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  };

  const loadStatus = useCallback(async () => {
    try { const s = await resilienceApi.getStatus(); setStatus(s); } catch { /* ignore */ }
  }, []);

  const loadSecrets = useCallback(async () => {
    try { setSecrets(await resilienceApi.getSecrets()); } catch (err: any) { flash(err.message); }
  }, []);

  const loadGuardrails = useCallback(async () => {
    try { setGuardrails(await resilienceApi.getGuardrails()); } catch (err: any) { flash(err.message); }
  }, []);

  const loadSnapshots = useCallback(async () => {
    try { setSnapshots(await resilienceApi.getSnapshots()); } catch (err: any) { flash(err.message); }
  }, []);

  const loadOffline = useCallback(async () => {
    try { setOfflineCfg(await resilienceApi.getOfflineConfig()); } catch (err: any) { flash(err.message); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { if (tab === "vault") loadSecrets(); }, [tab, loadSecrets]);
  useEffect(() => { if (tab === "guardrails") loadGuardrails(); }, [tab, loadGuardrails]);
  useEffect(() => { if (tab === "snapshots") loadSnapshots(); }, [tab, loadSnapshots]);
  useEffect(() => { if (tab === "offline") loadOffline(); }, [tab, loadOffline]);

  // ── Vault ──
  const createSecret = async () => {
    if (!secretForm.name.trim() || !secretForm.value.trim()) return;
    try {
      await resilienceApi.createSecret(secretForm);
      setShowSecretForm(false);
      setSecretForm({ name: "", type: "api_key", value: "" });
      flash("Secret stored securely");
      loadSecrets();
    } catch (err: any) { flash(err.message); }
  };

  const decryptSecret = async (id: string) => {
    try {
      const d = await resilienceApi.decryptSecret(id);
      setDecryptedValue(d.value);
      setTimeout(() => setDecryptedValue(""), 5000);
    } catch (err: any) { flash(err.message); }
  };

  const deleteSecret = async (id: string) => {
    try { await resilienceApi.deleteSecret(id); flash("Secret deleted"); loadSecrets(); } catch (err: any) { flash(err.message); }
  };

  // ── Guardrails ──
  const createGuardrail = async () => {
    try {
      await resilienceApi.createGuardrail(guardForm);
      setShowGuardForm(false);
      setGuardForm({ sessionId: "", maxTokens: 100000, maxCost: 1000 });
      flash("Guardrail created");
      loadGuardrails();
    } catch (err: any) { flash(err.message); }
  };

  const pauseGuardrail = async (id: string) => {
    try { const r = await resilienceApi.pauseGuardrail(id); flash(r.message); loadGuardrails(); } catch (err: any) { flash(err.message); }
  };

  const resumeGuardrail = async (id: string) => {
    try { const r = await resilienceApi.resumeGuardrail(id); flash(r.message); loadGuardrails(); } catch (err: any) { flash(err.message); }
  };

  // ── Snapshots ──
  const createSnapshot = async () => {
    if (!snapForm.name.trim()) return;
    try {
      await resilienceApi.createSnapshot(snapForm);
      setShowSnapshotForm(false);
      setSnapForm({ name: "", type: "full" });
      flash("Snapshot created");
      loadSnapshots();
    } catch (err: any) { flash(err.message); }
  };

  const restoreSnapshot = async (id: string) => {
    try {
      const r = await resilienceApi.restoreSnapshot(id);
      setRestoreMsg(r.message);
      flash(r.message);
      setTimeout(() => setRestoreMsg(""), 5000);
    } catch (err: any) { flash(err.message); }
  };

  const deleteSnapshot = async (id: string) => {
    try { await resilienceApi.deleteSnapshot(id); flash("Snapshot deleted"); loadSnapshots(); } catch (err: any) { flash(err.message); }
  };

  // ── Offline ──
  const updateOffline = async (data: Partial<OfflineConfig>) => {
    try {
      const cfg = await resilienceApi.updateOfflineConfig(data);
      setOfflineCfg(cfg);
      flash("Offline config updated");
    } catch (err: any) { flash(err.message); }
  };

  const syncNow = async () => {
    try {
      const r = await resilienceApi.syncOffline();
      flash(r.message);
      loadOffline();
    } catch (err: any) { flash(err.message); }
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "vault", label: "Secrets Vault", icon: "🔐" },
    { id: "guardrails", label: "Guardrails", icon: "🛑" },
    { id: "snapshots", label: "Backup & DR", icon: "💾" },
    { id: "offline", label: "Offline Mode", icon: "✈" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-lg">🛡</span>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-text">Enterprise Resilience</h1>
              <p className="text-[10px] text-text-muted">Secrets vault, guardrails, disaster recovery, offline mode</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text text-sm px-2 py-1 rounded-lg hover:bg-surface-dim transition-colors">✕</button>
        </div>

        {actionMsg && (
          <div className="mx-5 mt-2 px-3 py-1.5 bg-accent/10 text-accent text-[11px] rounded-lg">{actionMsg}</div>
        )}

        <div className="flex gap-1 px-5 pt-3 border-b border-border shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                tab === t.id ? "bg-accent/10 text-accent border-b-2 border-accent" : "text-text-muted hover:text-text hover:bg-surface-dim"
              }`}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <>
              <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg">
                <h3 className="text-[12px] font-bold text-text mb-1">🛡 Enterprise Resilience Suite</h3>
                <p className="text-[11px] text-text-muted">
                  AES-256-GCM enkripcija za sve osjetljive podatke, budget guardrails za zaštitu od beskonačnih petlji, automatski snapshot-ovi za disaster recovery, i potpuno offline/air-gapped režim za izolovana okruženja.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-surface-dim rounded-lg">
                  <div className="text-[10px] text-text-muted">Secrets in Vault</div>
                  <div className="text-2xl font-bold text-text mt-1">{status?.vault.totalSecrets || 0}</div>
                  <div className="text-[9px] text-text-muted mt-1">{status?.vault.encryption || "AES-256-GCM"}</div>
                </div>
                <div className="p-3 bg-surface-dim rounded-lg">
                  <div className="text-[10px] text-text-muted">Active Guardrails</div>
                  <div className="text-2xl font-bold text-text mt-1">{status?.guardrails.activeLimits || 0}</div>
                  <div className="text-[9px] text-text-muted mt-1">{status?.guardrails.hardStopEnabled ? "Hard-stop enabled" : "Disabled"}</div>
                </div>
                <div className="p-3 bg-surface-dim rounded-lg">
                  <div className="text-[10px] text-text-muted">Snapshots</div>
                  <div className="text-2xl font-bold text-text mt-1">{status?.disasterRecovery.snapshots || 0}</div>
                  <div className="text-[9px] text-text-muted mt-1">Point-in-time recovery</div>
                </div>
                <div className="p-3 bg-surface-dim rounded-lg">
                  <div className="text-[10px] text-text-muted">Offline Mode</div>
                  <div className="text-2xl font-bold text-text mt-1">{status?.offlineMode.enabled ? "ON" : "OFF"}</div>
                  <div className="text-[9px] text-text-muted mt-1">{status?.offlineMode.airGapped ? "Air-gapped" : status?.offlineMode.model || "N/A"}</div>
                </div>
              </div>
            </>
          )}

          {/* ── VAULT ── */}
          {tab === "vault" && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setShowSecretForm(!showSecretForm)}
                  className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">
                  {showSecretForm ? "Cancel" : "+ Store Secret"}
                </button>
              </div>

              {showSecretForm && (
                <div className="p-3 bg-surface-dim rounded-lg space-y-2 mb-3">
                  <input value={secretForm.name} onChange={(e) => setSecretForm((p) => ({ ...p, name: e.target.value }))} placeholder="Secret name (e.g. PROD_DB_PASSWORD)"
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                  <select value={secretForm.type} onChange={(e) => setSecretForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text">
                    {VAULT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ").toUpperCase()}</option>)}
                  </select>
                  <textarea value={secretForm.value} onChange={(e) => setSecretForm((p) => ({ ...p, value: e.target.value }))} placeholder="Secret value (will be encrypted with AES-256-GCM)" rows={2}
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                  <button onClick={createSecret} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Encrypt & Store</button>
                </div>
              )}

              {secrets.length === 0 ? (
                <div className="text-text-muted text-[11px] py-8 text-center">No secrets stored in vault</div>
              ) : (
                <div className="space-y-2">
                  {secrets.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-dim rounded-lg">
                      <span className="text-lg">
                        {s.type === "api_key" ? "🔑" : s.type === "ssh_key" ? "🔐" : s.type === "credential" ? "👤" : s.type === "certificate" ? "📜" : "🔒"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-text font-medium">{s.name}</div>
                        <div className="text-[10px] text-text-muted">{s.type} • {s.algorithm}{s.isActive ? " • active" : " • inactive"}</div>
                      </div>
                      {decryptedValue && (
                        <div className="text-[10px] text-accent font-mono max-w-[200px] truncate">{decryptedValue}</div>
                      )}
                      <button onClick={() => decryptSecret(s.id)} className="px-2 py-1 bg-surface border border-border text-text text-[10px] rounded-lg hover:bg-border">Decrypt</button>
                      <button onClick={() => deleteSecret(s.id)} className="text-red-400 hover:text-red-300 text-[11px]">Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── GUARDRAILS ── */}
          {tab === "guardrails" && (
            <>
              <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg mb-3">
                <p className="text-[11px] text-text-muted">
                  Guardrails automatically pause agent execution when budget or token limits are exceeded, preventing runaway costs from infinite loops or excessive API usage.
                </p>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setShowGuardForm(!showGuardForm)}
                  className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">
                  {showGuardForm ? "Cancel" : "+ Add Guardrail"}
                </button>
              </div>

              {showGuardForm && (
                <div className="p-3 bg-surface-dim rounded-lg space-y-2 mb-3">
                  <input value={guardForm.sessionId} onChange={(e) => setGuardForm((p) => ({ ...p, sessionId: e.target.value }))} placeholder="Session ID"
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="text-[9px] text-text-muted mb-1">Max Tokens</div>
                      <input value={guardForm.maxTokens} onChange={(e) => setGuardForm((p) => ({ ...p, maxTokens: Number(e.target.value) }))} type="number"
                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[9px] text-text-muted mb-1">Max Cost (cents)</div>
                      <input value={guardForm.maxCost} onChange={(e) => setGuardForm((p) => ({ ...p, maxCost: Number(e.target.value) }))} type="number"
                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text" />
                    </div>
                  </div>
                  <button onClick={createGuardrail} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Create</button>
                </div>
              )}

              {guardrails.length === 0 ? (
                <div className="text-text-muted text-[11px] py-8 text-center">No guardrails configured</div>
              ) : (
                <div className="space-y-2">
                  {guardrails.map((g) => {
                    const tokenPct = g.maxTokens ? Math.round((g.currentTokens / g.maxTokens) * 100) : 0;
                    const costPct = g.maxCost ? Math.round((g.currentCost / g.maxCost) * 100) : 0;
                    return (
                      <div key={g.id} className={`px-3 py-2.5 bg-surface-dim rounded-lg ${g.isPaused ? "ring-1 ring-red-500" : ""}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-text font-medium">
                              Session: {g.sessionId ? g.sessionId.substring(0, 8) + "..." : "N/A"}
                              {g.isPaused && <span className="ml-2 text-red-400 text-[10px]">⏸ PAUSED</span>}
                            </div>
                            <div className="space-y-1 mt-1">
                              <div className="flex items-center gap-2">
                                <div className="text-[9px] text-text-muted w-12">Tokens</div>
                                <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${tokenPct > 90 ? "bg-red-500" : tokenPct > 70 ? "bg-yellow-500" : "bg-accent"}`} style={{ width: `${Math.min(tokenPct, 100)}%` }} />
                                </div>
                                <div className="text-[9px] text-text-muted w-20 text-right">{g.currentTokens.toLocaleString()} / {g.maxTokens?.toLocaleString() || "∞"}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-[9px] text-text-muted w-12">Cost</div>
                                <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${costPct > 90 ? "bg-red-500" : costPct > 70 ? "bg-yellow-500" : "bg-accent"}`} style={{ width: `${Math.min(costPct, 100)}%` }} />
                                </div>
                                <div className="text-[9px] text-text-muted w-20 text-right">${(g.currentCost / 100).toFixed(2)} / ${(g.maxCost ? g.maxCost / 100 : 0).toFixed(2)}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            {g.isPaused ? (
                              <button onClick={() => resumeGuardrail(g.id)} className="px-2 py-1 bg-green-500/20 text-green-300 text-[10px] rounded-lg hover:bg-green-500/30">Resume</button>
                            ) : (
                              <button onClick={() => pauseGuardrail(g.id)} className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-[10px] rounded-lg hover:bg-yellow-500/30">Pause</button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── SNAPSHOTS ── */}
          {tab === "snapshots" && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setShowSnapshotForm(!showSnapshotForm)}
                  className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">
                  {showSnapshotForm ? "Cancel" : "+ Create Snapshot"}
                </button>
              </div>

              {showSnapshotForm && (
                <div className="p-3 bg-surface-dim rounded-lg space-y-2 mb-3">
                  <input value={snapForm.name} onChange={(e) => setSnapForm((p) => ({ ...p, name: e.target.value }))} placeholder="Snapshot name (e.g. pre-migration-backup)"
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                  <select value={snapForm.type} onChange={(e) => setSnapForm((p) => ({ ...p, type: e.target.value }))}
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text">
                    <option value="full">Full — DB + configs + sessions</option>
                    <option value="config">Config only</option>
                    <option value="session">Session metadata only</option>
                  </select>
                  <button onClick={createSnapshot} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Create Snapshot</button>
                </div>
              )}

              {restoreMsg && (
                <div className="px-3 py-2 bg-green-500/10 text-green-300 text-[11px] rounded-lg mb-3">{restoreMsg}</div>
              )}

              {snapshots.length === 0 ? (
                <div className="text-text-muted text-[11px] py-8 text-center">No snapshots yet. Create one for disaster recovery.</div>
              ) : (
                <div className="space-y-2">
                  {snapshots.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-dim rounded-lg">
                      <span className="text-lg">{s.type === "full" ? "💾" : s.type === "config" ? "⚙" : "📑"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-text font-medium">{s.name}</div>
                        <div className="text-[10px] text-text-muted">
                          {s.type} • {s.size ? `${(s.size / 1024 / 1024).toFixed(1)} MB` : "N/A"} • {s.checksum ? s.checksum.substring(0, 16) + "..." : "N/A"}
                        </div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${s.status === "completed" ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-300"}`}>{s.status}</span>
                      <div className="flex gap-1">
                        <button onClick={() => restoreSnapshot(s.id)} className="px-2 py-1 bg-accent/20 text-accent text-[10px] rounded-lg hover:bg-accent/30">Restore</button>
                        <button onClick={() => deleteSnapshot(s.id)} className="text-red-400 hover:text-red-300 text-[11px]">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── OFFLINE MODE ── */}
          {tab === "offline" && (
            <>
              <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg mb-3">
                <h3 className="text-[12px] font-bold text-text mb-1">✈ Offline / Air-Gapped Mode</h3>
                <p className="text-[11px] text-text-muted">
                  Potpuno izolovan režim rada bez internet pristupa. Koristi lokalne AI modele (Ollama, WebLLM), lokalni Git, i lokalni runtime. Idealno za vojne, državne i finansijske institucije.
                </p>
              </div>

              {!offlineCfg ? (
                <div className="text-text-muted text-[11px] py-8 text-center">Loading...</div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-surface-dim rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[12px] font-medium text-text">Offline Mode</div>
                        <div className="text-[10px] text-text-muted">{offlineCfg.isEnabled ? "Enabled — radi bez interneta" : "Disabled — normalan rad"}</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={offlineCfg.isEnabled} onChange={() => updateOffline({ isEnabled: !offlineCfg.isEnabled })} className="sr-only peer" />
                        <div className="w-10 h-5 bg-border rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:w-4 after:h-4 after:rounded-full after:bg-white transition-all"></div>
                      </label>
                    </div>

                    {offlineCfg.isEnabled && (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[12px] font-medium text-text">Air-Gapped</div>
                            <div className="text-[10px] text-text-muted">{offlineCfg.airGapped ? "Potpuna izolacija — nikakav spoljni saobraćaj" : "Dozvoljeni samo specificirani domeni"}</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={offlineCfg.airGapped} onChange={() => updateOffline({ airGapped: !offlineCfg.airGapped })} className="sr-only peer" />
                            <div className="w-10 h-5 bg-border rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:w-4 after:h-4 after:rounded-full after:bg-white transition-all"></div>
                          </label>
                        </div>

                        <div>
                          <div className="text-[9px] text-text-muted mb-1">Local AI Model Provider</div>
                          <select value={offlineCfg.localModelProvider} onChange={(e) => updateOffline({ localModelProvider: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text">
                            <option value="ollama">Ollama</option>
                            <option value="webllm">WebLLM (browser)</option>
                            <option value="llamacpp">llama.cpp</option>
                            <option value="vllm">vLLM</option>
                            <option value="localai">LocalAI</option>
                          </select>
                        </div>

                        <div>
                          <div className="text-[9px] text-text-muted mb-1">Local Model</div>
                          <input value={offlineCfg.localModelName} onChange={(e) => updateOffline({ localModelName: e.target.value })} placeholder="e.g. llama3, mistral, codellama"
                            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                        </div>

                        <div>
                          <div className="text-[9px] text-text-muted mb-1">Local Git Path</div>
                          <input value={offlineCfg.localGitPath || ""} onChange={(e) => updateOffline({ localGitPath: e.target.value })} placeholder="e.g. /mnt/local-git-mirror"
                            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                        </div>

                        <div>
                          <div className="text-[9px] text-text-muted mb-1">Local Runtime</div>
                          <select value={offlineCfg.localRuntime} onChange={(e) => updateOffline({ localRuntime: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text">
                            <option value="opencode">OpenCode</option>
                            <option value="crush">Crush</option>
                            <option value="claude-code">Claude Code</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] text-text-muted">Sync on Reconnect</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" checked={offlineCfg.syncOnReconnect} onChange={() => updateOffline({ syncOnReconnect: !offlineCfg.syncOnReconnect })} className="sr-only peer" />
                              <div className="w-7 h-4 bg-border rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:w-3 after:h-3 after:rounded-full after:bg-white transition-all"></div>
                            </label>
                          </div>
                        </div>

                        {offlineCfg.lastSyncAt && (
                          <div className="text-[10px] text-text-muted">Last sync: {new Date(offlineCfg.lastSyncAt).toLocaleString()}</div>
                        )}

                        <button onClick={syncNow} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Sync Now</button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
