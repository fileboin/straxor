import { useState, useEffect, useCallback } from "react";
import {
  listInfraProviders,
  listInfraConfigs,
  addInfraConfig,
  updateInfraConfig,
  deleteInfraConfig,
  testInfraConfig,
  TYPE_META,
  type InfraType,
  type InfraConfig,
  type InfraProviderDef,
  type InfraHealthCheck,
} from "../../lib/infrastructure";

interface Props {
  onClose: () => void;
  projectId?: string;
  machineId?: string | null;
}

const TYPES: InfraType[] = ["dns", "ssl", "proxy", "tunnel", "monitor", "alert"];

export default function InfrastructurePanel({ onClose, projectId, machineId }: Props) {
  const [providers, setProviders] = useState<InfraProviderDef[]>([]);
  const [configs, setConfigs] = useState<InfraConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [type, setType] = useState<InfraType>("dns");
  const [showAdd, setShowAdd] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [healthResults, setHealthResults] = useState<Record<string, InfraHealthCheck>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, c] = await Promise.all([listInfraProviders(), listInfraConfigs()]);
      setProviders(p);
      setConfigs(c);
    } catch (err: any) {
      setError(err.message || "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  };

  const handleTest = async (config: InfraConfig) => {
    setTestingId(config.id);
    try {
      const result = await testInfraConfig(config.id);
      setHealthResults((prev) => ({ ...prev, [config.id]: result }));
      flash(result.status === "ok" ? "OK" : `Status: ${result.status}`);
    } catch (err: any) {
      flash(`Greška: ${err.message}`);
    }
    setTestingId(null);
    load();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInfraConfig(id);
      setConfigs((prev) => prev.filter((c) => c.id !== id));
      flash("Obrisano");
    } catch (err: any) {
      flash(`Greška: ${err.message}`);
    }
  };

  const filtered = configs.filter((c) => c.type === type);
  const typeMeta = TYPE_META[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-6xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-lg">{typeMeta.icon}</span>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-text">Infrastructure</h1>
              <p className="text-[10px] text-text-muted">{configs.length} configs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {actionMsg && (
              <span className="text-[10px] text-accent px-2 py-1 rounded bg-accent/10">{actionMsg}</span>
            )}
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1 text-[11px] text-white bg-accent hover:bg-accent-light px-3 py-1.5 rounded-lg transition-colors"
            >
              + Dodaj
            </button>
            <button
              onClick={load}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-surface-3 text-text-secondary hover:text-text text-xs transition-colors"
              title="Osveži"
            >
              ↻
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Type tabs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-border/50 bg-surface-2/20 shrink-0 overflow-x-auto">
          {TYPES.map((t) => {
            const m = TYPE_META[t];
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  type === t
                    ? "bg-accent/15 text-accent"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <span>{m.icon}</span>
                {m.label}
                <span className="text-[10px] text-text-muted/60">({configs.filter((c) => c.type === t).length})</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[11px] text-text-muted">Učitavanje...</div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-32 text-[11px] text-red-400">
              <span className="text-2xl mb-2">⚠</span>
              {error}
              <button onClick={load} className="mt-2 text-accent hover:underline">Pokušaj ponovo</button>
            </div>
          ) : (
            <>
              {/* Description */}
              <div className="text-[11px] text-text-secondary mb-4 bg-surface-2/50 border border-border/50 rounded-xl px-4 py-2.5">
                {typeMeta.icon} <strong>{typeMeta.label}</strong> — {typeMeta.description}
              </div>

              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-[11px] text-text-muted">
                  <span className="text-3xl mb-2">{typeMeta.icon}</span>
                  Nema konfiguracija za {typeMeta.label.toLowerCase()}
                  <button onClick={() => { setShowAdd(true); setType(type); }} className="mt-2 text-accent hover:underline">
                    + Dodaj {typeMeta.label.toLowerCase()} config
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((config) => {
                    const provider = providers.find((p) => p.id === config.adapter);
                    const health = healthResults[config.id];

                    return (
                      <InfraConfigRow
                        key={config.id}
                        config={config}
                        provider={provider}
                        health={health}
                        testing={testingId === config.id}
                        onTest={handleTest}
                        onDelete={handleDelete}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-border shrink-0">
          <div className="text-[9px] text-text-muted">
            Infrastructure adapters — DNS, SSL, Proxy, Tunnel, Monitoring
          </div>
          <button onClick={load} className="text-[10px] text-accent hover:underline">↻ Osveži</button>
        </div>
      </div>

      {/* Add modal */}
      {showAdd && (
        <AddInfraModal
          type={type}
          providers={providers.filter((p) => p.type === type)}
          projectId={projectId}
          machineId={machineId}
          onSave={async (data) => {
            try {
              const created = await addInfraConfig(data);
              setConfigs((prev) => [...prev, created]);
              flash("Dodato");
              setShowAdd(false);
            } catch (err: any) {
              flash(`Greška: ${err.message}`);
            }
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

// ── Infra Config Row ──

function InfraConfigRow({
  config,
  provider,
  health,
  testing,
  onTest,
  onDelete,
}: {
  config: InfraConfig;
  provider?: InfraProviderDef;
  health?: InfraHealthCheck;
  testing: boolean;
  onTest: (c: InfraConfig) => void;
  onDelete: (id: string) => void;
}) {
  const statusDot =
    config.status === "active" ? "bg-green-500" :
    config.status === "error" ? "bg-red-500" :
    config.status === "disabled" ? "bg-gray-500" :
    "bg-yellow-500";

  return (
    <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3 hover:border-border-light transition-colors group">
      {/* Status dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot}`} title={config.status} />

      {/* Provider icon */}
      <span className="text-lg shrink-0">{provider?.icon || "🔌"}</span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-text">{config.name}</span>
          {config.domain && (
            <span className="text-[10px] text-text-muted font-mono">{config.domain}</span>
          )}
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
            config.status === "active" ? "bg-green-500/10 text-green-400" :
            config.status === "error" ? "bg-red-500/10 text-red-400" :
            "bg-surface-3 text-text-muted"
          }`}>
            {config.status}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-text-muted">{provider?.name || config.adapter}</span>
          {config.lastChecked && (
            <span className="text-[9px] text-text-muted/60">Last: {timeAgo(config.lastChecked)}</span>
          )}
          {config.lastError && (
            <span className="text-[9px] text-red-400/80 truncate max-w-[200px]" title={config.lastError}>
              ⚠ {config.lastError}
            </span>
          )}
          {health && (
            <span className={`text-[9px] ${
              health.status === "ok" ? "text-green-400" :
              health.status === "down" ? "text-red-400" :
              "text-yellow-400"
            }`}>
              {health.status}
              {health.latency ? ` (${health.latency}ms)` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onTest(config)}
          disabled={testing}
          className="text-[9px] px-2 py-1 rounded-lg border border-border bg-surface-2 text-text-muted hover:text-accent hover:border-accent/30 transition-colors disabled:opacity-40"
        >
          {testing ? "..." : "🧪 Test"}
        </button>
        <button
          onClick={() => onDelete(config.id)}
          className="text-[9px] px-2 py-1 rounded-lg border border-border bg-surface-2 text-text-muted hover:text-red-400 hover:border-red-500/30 transition-colors"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// ── Add Modal ──

function AddInfraModal({
  type,
  providers,
  projectId,
  machineId,
  onSave,
  onClose,
}: {
  type: InfraType;
  providers: InfraProviderDef[];
  projectId?: string;
  machineId?: string | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [config, setConfig] = useState<Record<string, any>>({});
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const provider = providers.find((p) => p.id === selectedProvider);

  useEffect(() => {
    if (providers.length > 0 && !selectedProvider) {
      setSelectedProvider(providers[0].id);
    }
  }, [providers, selectedProvider]);

  useEffect(() => {
    // Reset form when provider changes
    setConfig({});
    setCredentials({});
    if (provider) {
      for (const f of provider.configFields) {
        if (f.type === "select" && f.options && f.options.length > 0) {
          setConfig((prev) => ({ ...prev, [f.key]: f.options[0].value }));
        }
      }
    }
  }, [selectedProvider]);

  const handleSave = async () => {
    if (!selectedProvider || !name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        type,
        adapter: selectedProvider,
        name: name.trim(),
        domain: domain.trim() || undefined,
        projectId,
        machineId: machineId || undefined,
        config,
        credentials: Object.fromEntries(Object.entries(credentials).filter(([_, v]) => v)),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-[13px] font-semibold text-text">Dodaj {TYPE_META[type].label.toLowerCase()} config</span>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">✕</button>
        </div>

        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Provider */}
          <div>
            <label className="text-[10px] text-text-muted block mb-1">Provider</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="text-[10px] text-text-muted block mb-1">Naziv *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50"
              placeholder={provider?.name || "My config"}
            />
          </div>

          {/* Domain */}
          {(type === "dns" || type === "ssl" || type === "proxy" || type === "tunnel") && (
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Domain</label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text font-mono focus:outline-none focus:border-accent/50"
                placeholder="example.com"
              />
            </div>
          )}

          {/* Config fields */}
          {provider?.configFields.length > 0 && (
            <div className="border-t border-border pt-3">
              <label className="text-[10px] text-text-muted block mb-2 font-medium">Konfiguracija</label>
              {provider.configFields.map((field) => (
                <div key={field.key} className="mb-2">
                  <label className="text-[10px] text-text-muted block mb-1">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  {field.type === "select" && field.options ? (
                    <select
                      value={(config[field.key] as string) || ""}
                      onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50"
                    >
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      value={(config[field.key] as string) || ""}
                      onChange={(e) => setConfig((prev) => ({ ...prev, [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value }))}
                      className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50"
                      placeholder={field.placeholder || ""}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Credential fields */}
          {provider?.credentialFields.length > 0 && (
            <div className="border-t border-border pt-3">
              <label className="text-[10px] text-text-muted block mb-2 font-medium">Kredencijali (enkriptovani)</label>
              {provider.credentialFields.map((field) => (
                <div key={field.key} className="mb-2">
                  <label className="text-[10px] text-text-muted block mb-1">
                    {field.label} {field.required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type={field.type === "password" ? "password" : "text"}
                    value={credentials[field.key] || ""}
                    onChange={(e) => setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50"
                    placeholder={field.placeholder || ""}
                  />
                </div>
              ))}
            </div>
          )}

          {provider?.docsUrl && (
            <div className="border-t border-border pt-3">
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-accent hover:underline"
              >
                📄 {provider.docsUrl}
              </a>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="text-[11px] text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-surface-2">
            Otkaži
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !selectedProvider || saving}
            className="text-[11px] text-white bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg transition-colors"
          >
            {saving ? "Čuvanje..." : "Dodaj"}
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "upravo";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
