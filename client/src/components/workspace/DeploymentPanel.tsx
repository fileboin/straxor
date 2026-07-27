import { useState, useEffect, useCallback } from "react";
import {
  fetchDeployments,
  triggerDeployment,
  fetchBuildLog,
  stopDeployment,
  type Deployment,
  type BuildLogEntry,
  type DeploymentTarget,
  TARGET_LABELS,
  STATUS_COLORS,
  STATUS_ICONS,
} from "../../lib/deployments";

interface Props {
  projectId: string;
  onClose: () => void;
}

const TARGETS: DeploymentTarget[] = ["vps", "docker", "render", "railway", "vercel", "netlify", "cloudflare"];

export default function DeploymentPanel({ projectId, onClose }: Props) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [selected, setSelected] = useState<Deployment | null>(null);
  const [buildLog, setBuildLog] = useState<BuildLogEntry[]>([]);
  const [showTrigger, setShowTrigger] = useState(false);
  const [triggerTarget, setTriggerTarget] = useState<DeploymentTarget>("vps");
  const [triggerBranch, setTriggerBranch] = useState("main");
  const [loading, setLoading] = useState(false);

  const loadDeployments = useCallback(async () => {
    try {
      const data = await fetchDeployments(projectId);
      setDeployments(data);
    } catch {}
  }, [projectId]);

  useEffect(() => {
    loadDeployments();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-xl w-[750px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text">Deployment</h2>
          <div className="flex items-center gap-2">
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

        {/* Trigger form */}
        {showTrigger && (
          <div className="px-4 py-3 border-b border-border bg-surface-2/30">
            <div className="text-[11px] font-medium text-text-secondary mb-2">Novi deployment</div>
            <div className="flex items-center gap-2">
              <select
                value={triggerTarget}
                onChange={(e) => setTriggerTarget(e.target.value as DeploymentTarget)}
                className="px-2 py-1.5 text-[11px] bg-bg border border-border rounded focus:outline-none focus:border-accent text-text"
              >
                {TARGETS.map((t) => (
                  <option key={t} value={t}>{TARGET_LABELS[t]}</option>
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
        <div className="flex flex-1 min-h-0">
          {/* Deployment list */}
          <div className="w-[280px] border-r border-border overflow-y-auto shrink-0">
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
          <div className="flex-1 flex flex-col min-w-0">
            {selected ? (
              <>
                {/* Status bar */}
                <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded border ${STATUS_COLORS[selected.status]}`}
                  >
                    {STATUS_ICONS[selected.status]} {selected.status.toUpperCase()}
                  </span>
                  <span className="text-[11px] text-text-secondary">
                    {TARGET_LABELS[selected.target]}
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
