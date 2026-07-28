import { useState, useEffect, useCallback } from "react";
import {
  fetchDeployments,
  triggerDeployment,
  fetchBuildLog,
  stopDeployment,
  fetchProviders,
  configureDeployProvider,
  type Deployment,
  type BuildLogEntry,
  type DeploymentTarget,
  type ProviderInfo,
  TARGET_LABELS,
  TARGET_ICONS,
  STATUS_COLORS,
  STATUS_ICONS,
} from "../../lib/deployments";

interface Props {
  projectId: string;
  onClose: () => void;
}

const TARGETS: DeploymentTarget[] = ["vps", "docker", "coolify", "dokploy", "caprover", "render", "railway", "flyio", "digitalocean", "vercel", "netlify", "cloudflare"];

export default function DeploymentPanel({ projectId, onClose }: Props) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selected, setSelected] = useState<Deployment | null>(null);
  const [buildLog, setBuildLog] = useState<BuildLogEntry[]>([]);
  const [showTrigger, setShowTrigger] = useState(false);
  const [triggerTarget, setTriggerTarget] = useState<DeploymentTarget>("vps");
  const [triggerBranch, setTriggerBranch] = useState("main");
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [showProviders, setShowProviders] = useState(false);
  const [configTarget, setConfigTarget] = useState<DeploymentTarget | null>(null);

  const loadDeployments = useCallback(async () => {
    try {
      const data = await fetchDeployments(projectId);
      setDeployments(data);
    } catch {}
  }, [projectId]);

  useEffect(() => {
    loadDeployments();
    fetchProviders().then(setProviders).catch(() => {});
  }, [loadDeployments]);

  const loadBuildLog = useCallback(async (deploymentId: string) => {
    try {
      const data = await fetchBuildLog(deploymentId);
      setBuildLog(data);
    } catch {
      setBuildLog([]);
    }
  }, []);

  useEffect(() => {
    if (selected) {
      loadBuildLog(selected.id);
    }
  }, [selected, loadBuildLog]);

  const handleTrigger = async () => {
    setLoading(true);
    try {
      const deployment = await triggerDeployment(projectId, triggerTarget, triggerBranch);
      setDeployments((prev) => [deployment, ...prev]);
      setSelected(deployment);
      setShowTrigger(false);
      loadBuildLog(deployment.id);
    } catch {}
    setLoading(false);
  };

  const handleStop = async (deploymentId: string) => {
    try {
      await stopDeployment(deploymentId);
      loadDeployments();
      if (selected?.id === deploymentId) {
        setSelected((prev) => (prev ? { ...prev, status: "stopped" } : null));
      }
    } catch {}
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "—";
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString("hr-HR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-[750px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text">Deployment</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowProviders(!showProviders)}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border bg-surface-2/50 text-text-secondary hover:text-text hover:border-border-light transition-colors"
            >
              ⚙ Provideri
            </button>
            <button
              onClick={() => setShowTrigger(!showTrigger)}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-accent bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              + Deploy
            </button>
            <button
              onClick={onClose}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border bg-transparent text-text-secondary hover:text-text hover:border-border-light transition-colors"
            >
              Zatvori
            </button>
          </div>
        </div>

        {/* Provider config */}
        {showProviders && (
          <div className="px-3 py-3 border-b border-border bg-surface-2/30 sm:px-4 space-y-2">
            <div className="text-[11px] font-medium text-text-secondary mb-2">Provideri — konfiguracija</div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
              {TARGETS.map((t) => {
                const p = providers.find((x) => x.id === t);
                const configured = p?.configured || false;
                return (
                  <button
                    key={t}
                    onClick={() => { setConfigTarget(t); }}
                    className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border text-[10px] transition-colors ${
                      configTarget === t
                        ? "border-accent bg-accent/10 text-accent"
                        : configured
                        ? "border-green-500/30 bg-green-500/5 text-text-secondary"
                        : "border-border bg-transparent text-text-muted"
                    }`}
                  >
                    <span className="text-sm">{TARGET_ICONS[t]}</span>
                    <span className="truncate w-full text-center">{TARGET_LABELS[t]}</span>
                    {configured && <span className="text-[8px] text-green-400">✓</span>}
                  </button>
                );
              })}
            </div>
            {configTarget && (
              <DeployProviderConfig
                target={configTarget}
                onSave={async (vals) => {
                  await configureDeployProvider(configTarget, vals);
                  const updated = await fetchProviders();
                  setProviders(updated);
                  setConfigTarget(null);
                }}
                onCancel={() => setConfigTarget(null)}
              />
            )}
          </div>
        )}

        {/* Trigger form */}
        {showTrigger && (
          <div className="px-3 py-3 border-b border-border bg-surface-2/30 sm:px-4">
            <div className="text-[11px] font-medium text-text-secondary mb-2">Novi deployment</div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={triggerTarget}
                onChange={(e) => setTriggerTarget(e.target.value as DeploymentTarget)}
                className="px-2 py-1.5 text-[11px] bg-bg border border-border rounded focus:outline-none focus:border-accent text-text"
              >
                {TARGETS.map((t) => (
                  <option key={t} value={t}>{TARGET_ICONS[t]} {TARGET_LABELS[t]}</option>
                ))}
              </select>
              <input
                type="text"
                value={triggerBranch}
                onChange={(e) => setTriggerBranch(e.target.value)}
                placeholder="branch"
                className="px-2 py-1.5 text-[11px] font-mono bg-bg border border-border rounded w-32 focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
              />
              <button
                onClick={handleTrigger}
                disabled={loading}
                className="px-3 py-1.5 text-[11px] font-medium rounded border border-accent bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
              >
                {loading ? "Deploying..." : "Pokreni"}
              </button>
              <button
                onClick={() => setShowTrigger(false)}
                className="px-2 py-1.5 text-[11px] text-text-muted hover:text-text transition-colors"
              >
                Odustani
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* Deployment list */}
          <div className={`border-b md:border-b-0 md:border-r border-border overflow-y-auto shrink-0 ${selected ? "hidden md:block md:w-[280px]" : "w-full md:w-[280px]"}`}>
            {deployments.length === 0 ? (
              <div className="p-4 text-center text-text-muted text-[11px]">
                Nema deploymenta.
              </div>
            ) : (
              deployments.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelected(d)}
                  className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors ${
                    selected?.id === d.id
                      ? "bg-surface-2"
                      : "hover:bg-surface-2/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] ${STATUS_COLORS[d.status].split(" ")[0]}`}>
                      {STATUS_ICONS[d.status]}
                    </span>
                    <span className="text-[11px] font-medium text-text">
                      {TARGET_LABELS[d.target]}
                    </span>
                    <span className="text-[10px] text-text-muted ml-auto">
                      {formatTime(d.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-text-muted font-mono">{d.branch}</span>
                    {d.duration != null && (
                      <span className="text-[10px] text-text-muted ml-auto">
                        {formatDuration(d.duration)}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Detail panel */}
          <div className={`flex-1 flex flex-col min-w-0 ${!selected ? "hidden md:flex" : "flex"}`}>
            {selected ? (
              <>
                {/* Status bar */}
                <div className="px-3 py-2.5 border-b border-border flex items-center gap-2 sm:px-4 sm:gap-3">
                  <button
                    onClick={() => setSelected(null)}
                    className="md:hidden px-2 py-1 text-[10px] rounded border border-border text-text-muted hover:text-text transition-colors"
                  >
                    ← Natrag
                  </button>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded border ${STATUS_COLORS[selected.status]}`}
                  >
                    {STATUS_ICONS[selected.status]} {selected.status.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-text-secondary">
                    {TARGET_ICONS[selected.target]} {TARGET_LABELS[selected.target]}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono">{selected.branch}</span>
                  {selected.commitHash && (
                    <span className="text-[10px] text-text-muted font-mono">
                      {selected.commitHash.slice(0, 7)}
                    </span>
                  )}
                  <div className="flex-1" />
                  {selected.liveUrl && (
                    <a
                      href={selected.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-accent hover:underline"
                    >
                      {selected.liveUrl}
                    </a>
                  )}
                  {selected.status === "building" && (
                    <button
                      onClick={() => handleStop(selected.id)}
                      className="px-2 py-1 text-[10px] rounded border border-red-500/20 text-red-400 hover:border-red-500/40 transition-colors"
                    >
                      Zaustavi
                    </button>
                  )}
                </div>

                {/* Build log */}
                <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-[1.6] bg-bg p-3">
                  {buildLog.length === 0 ? (
                    <div className="text-text-muted text-center py-4">Nema build logova</div>
                  ) : (
                    buildLog.map((entry, i) => (
                      <div key={i} className="flex gap-2 py-0.5">
                        <span className="text-text-muted shrink-0">
                          {new Date(entry.timestamp).toLocaleTimeString("hr-HR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                        <span
                          className={`shrink-0 w-3 text-center font-bold ${
                            entry.level === "error"
                              ? "text-red-400"
                              : entry.level === "warn"
                              ? "text-yellow-400"
                              : "text-text-secondary"
                          }`}
                        >
                          {entry.level === "error" ? "x" : entry.level === "warn" ? "!" : "i"}
                        </span>
                        <span className="text-text-secondary break-all">{entry.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-text-muted text-[11px]">
                Odaberi deployment za detalje
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const PROVIDER_CONFIG_FIELDS: Record<string, { key: string; label: string; secret?: boolean }[]> = {
  vps: [{ key: "host", label: "Host" }, { key: "port", label: "Port" }, { key: "user", label: "User" }, { key: "key", label: "SSH Key", secret: true }, { key: "deployPath", label: "Deploy Path" }],
  docker: [{ key: "host", label: "Docker Host" }, { key: "composeFile", label: "Compose File" }, { key: "serviceName", label: "Service Name" }],
  coolify: [{ key: "serverUrl", label: "Server URL" }, { key: "token", label: "API Token", secret: true }],
  dokploy: [{ key: "serverUrl", label: "Server URL" }, { key: "apiKey", label: "API Key", secret: true }],
  caprover: [{ key: "serverUrl", label: "Captain URL" }, { key: "apiKey", label: "API Key", secret: true }, { key: "appName", label: "App Name" }],
  render: [{ key: "token", label: "API Token", secret: true }],
  railway: [{ key: "token", label: "API Token", secret: true }],
  flyio: [{ key: "token", label: "API Token", secret: true }, { key: "org", label: "Organization" }],
  digitalocean: [{ key: "token", label: "API Token", secret: true }],
  vercel: [{ key: "token", label: "API Token", secret: true }],
  netlify: [{ key: "token", label: "API Token", secret: true }],
  cloudflare: [{ key: "token", label: "API Token", secret: true }, { key: "accountId", label: "Account ID" }],
};

function DeployProviderConfig({ target, onSave, onCancel }: {
  target: DeploymentTarget;
  onSave: (vals: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const fields = PROVIDER_CONFIG_FIELDS[target] || [];

  return (
    <div className="mt-2 p-3 bg-surface-2/50 rounded-lg border border-border space-y-2">
      <div className="text-[11px] font-medium text-text">{TARGET_ICONS[target]} {TARGET_LABELS[target]}</div>
      {fields.map((f) => (
        <div key={f.key}>
          <label className="text-[10px] text-text-muted block mb-0.5">{f.label}</label>
          <input
            type={f.secret ? "password" : "text"}
            value={vals[f.key] || ""}
            onChange={(e) => setVals((prev) => ({ ...prev, [f.key]: e.target.value }))}
            className="w-full px-2 py-1 text-[11px] bg-bg border border-border rounded focus:outline-none focus:border-accent text-text placeholder:text-text-muted"
          />
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          onClick={async () => { setSaving(true); await onSave(vals); setSaving(false); }}
          disabled={saving}
          className="px-3 py-1 text-[11px] font-medium rounded border border-accent bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Sačuvaj"}
        </button>
        <button onClick={onCancel} className="px-2 py-1 text-[11px] text-text-muted hover:text-text transition-colors">Odustani</button>
      </div>
    </div>
  );
}
