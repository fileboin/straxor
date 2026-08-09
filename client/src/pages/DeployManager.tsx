import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import { useTheme } from "../lib/theme.js";
import { fetchDeployments, triggerDeployment, fetchDeployment, fetchBuildLog, stopDeployment, fetchProviders, configureDeployProvider, type Deployment, type DeploymentTarget, STATUS_COLORS, STATUS_ICONS, TARGET_LABELS } from "../lib/deployments.js";
import { getPublishLinks, createPublishLink, updatePublishLink, deletePublishLink, type PublishLink } from "../lib/publish.js";
import { startPreview, stopPreview, getPreviewStatus, type PreviewStatus, DEVICE_PRESETS } from "../lib/preview.js";
import { listMachines, installCoolify, type MachineRecord, type CoolifyInstallEvent } from "../lib/machines.js";
import { listInfraConfigs, testInfraConfig, type InfraConfig, type InfraHealthCheck } from "../lib/infrastructure.js";

type Tab = "preview" | "publish" | "deploy";

const STATUS_STYLES: Record<string, string> = {
  building: "text-yellow-400 bg-yellow-500/10",
  running: "text-green-400 bg-green-500/10",
  failed: "text-red-400 bg-red-500/10",
  stopped: "text-text-muted bg-surface-2",
};

export default function DeployManager() {
  const { id: projectId } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const { toggleTheme, theme } = useTheme();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("preview");
  const [actionMsg, setActionMsg] = useState("");
  const flash = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(""), 2500); };

  // Preview
  const [machineId, setMachineId] = useState("");
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus | null>(null);
  const [previewDevice, setPreviewDevice] = useState("desktop");

  // Publish
  const [publishLinks, setPublishLinks] = useState<PublishLink[]>([]);
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [publishPassword, setPublishPassword] = useState("");
  const [publishExpires, setPublishExpires] = useState("");

  // Deploy
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<DeploymentTarget>("vps");
  const [deployBranch, setDeployBranch] = useState("main");
  const [activeDeployment, setActiveDeployment] = useState<Deployment | null>(null);
  const [buildLog, setBuildLog] = useState<any[]>([]);
  const [showProviderConfig, setShowProviderConfig] = useState(false);
  const [providerConfig, setProviderConfig] = useState<Record<string, string>>({});
  const [machines, setMachines] = useState<MachineRecord[]>([]);
  const [coolifyMachineId, setCoolifyMachineId] = useState("");
  const [coolifyEvents, setCoolifyEvents] = useState<CoolifyInstallEvent[]>([]);
  const [coolifyInstalling, setCoolifyInstalling] = useState(false);
  const [coolifyError, setCoolifyError] = useState("");
  const [infraConfigs, setInfraConfigs] = useState<InfraConfig[]>([]);
  const [coolifyHealth, setCoolifyHealth] = useState<InfraHealthCheck | null>(null);
  const [coolifyTesting, setCoolifyTesting] = useState(false);

  const loadPublish = useCallback(async () => {
    if (!projectId) return;
    try { setPublishLinks(await getPublishLinks(projectId)); } catch { flash("Error loading publish links"); }
  }, [projectId]);

  const loadDeployments = useCallback(async () => {
    if (!projectId) return;
    try { setDeployments(await fetchDeployments(projectId)); } catch { flash("Error loading deployments"); }
  }, [projectId]);

  const loadProviders = useCallback(async () => {
    try { setProviders(await fetchProviders()); } catch { flash("Error loading providers"); }
  }, []);

  const loadMachines = useCallback(async () => {
    try {
      const rows = await listMachines();
      setMachines(rows);
      setCoolifyMachineId((current) => current || rows.find((m) => m.projectId === projectId)?.id || rows[0]?.id || "");
    } catch {
      setMachines([]);
    }
  }, [projectId]);

  const loadInfraConfigs = useCallback(async () => {
    try {
      setInfraConfigs(await listInfraConfigs());
    } catch {
      setInfraConfigs([]);
    }
  }, []);

  const loadPreviewStatus = useCallback(async () => {
    if (!machineId) { setPreviewStatus(null); return; }
    try { setPreviewStatus(await getPreviewStatus(machineId)); } catch { setPreviewStatus(null); }
  }, [machineId]);

  useEffect(() => {
    if (tab === "preview") loadPreviewStatus();
    if (tab === "publish") loadPublish();
    if (tab === "deploy") { loadDeployments(); loadProviders(); loadMachines(); loadInfraConfigs(); }
  }, [tab, loadPreviewStatus, loadPublish, loadDeployments, loadProviders, loadMachines, loadInfraConfigs]);

  // ── Preview ──
  const handleStartPreview = async () => {
    if (!machineId) { flash("Enter machine ID (from project settings)"); return; }
    try {
      await startPreview({ machineId });
      flash("Preview started");
      loadPreviewStatus();
    } catch { flash("Error"); }
  };

  const handleStopPreview = async () => {
    if (!machineId) return;
    try { await stopPreview(machineId); flash("Preview stopped"); setPreviewStatus(null); } catch { flash("Error"); }
  };

  // ── Publish ──
  const handleCreateLink = async () => {
    if (!projectId) return;
    try {
      const expiresInHours = publishExpires ? parseInt(publishExpires) : undefined;
      await createPublishLink(projectId, { password: publishPassword || undefined, expiresInHours });
      flash("Publish link created");
      setShowPublishForm(false);
      setPublishPassword("");
      setPublishExpires("");
      loadPublish();
    } catch { flash("Error"); }
  };

  const handleToggleLink = async (link: PublishLink) => {
    if (!projectId) return;
    try { await updatePublishLink(projectId, link.id, { isEnabled: !link.isEnabled }); loadPublish(); } catch { flash("Error"); }
  };

  const handleDeleteLink = async (link: PublishLink) => {
    if (!projectId) return;
    try { await deletePublishLink(projectId, link.id); loadPublish(); } catch { flash("Error"); }
  };

  // ── Deploy ──
  const handleDeploy = async () => {
    if (!projectId) return;
    try {
      await triggerDeployment(projectId, selectedTarget, deployBranch);
      flash("Deployment triggered");
      loadDeployments();
    } catch { flash("Error"); }
  };

  const handleViewDeployment = async (d: Deployment) => {
    try {
      const detail = await fetchDeployment(d.id);
      setActiveDeployment(detail);
      const logs = await fetchBuildLog(d.id);
      setBuildLog(logs);
    } catch { flash("Error"); }
  };

  const handleStopDeployment = async (id: string) => {
    try { await stopDeployment(id); loadDeployments(); flash("Deployment stopped"); } catch { flash("Error"); }
  };

  const handleConfigureProvider = async (target: string) => {
    try {
      await configureDeployProvider(target as DeploymentTarget, providerConfig);
      flash("Provider configured");
      setShowProviderConfig(false);
      setProviderConfig({});
      loadProviders();
    } catch { flash("Error"); }
  };

  const handleInstallCoolify = async () => {
    if (!coolifyMachineId) {
      flash("Izaberi VPS mašinu za Coolify instalaciju");
      return;
    }
    setCoolifyInstalling(true);
    setCoolifyError("");
    setCoolifyEvents([]);
    try {
      await installCoolify(coolifyMachineId, (event) => {
        setCoolifyEvents((prev) => [...prev, event]);
      });
      flash("Coolify instalacija završena");
      loadMachines();
      loadInfraConfigs();
    } catch (err) {
      setCoolifyError(err instanceof Error ? err.message : "Coolify instalacija nije uspjela");
    } finally {
      setCoolifyInstalling(false);
    }
  };

  const handleTestCoolify = async () => {
    const config = infraConfigs.find((cfg) =>
      cfg.adapter === "coolify" && (
        (coolifyMachineId && cfg.machineId === coolifyMachineId) ||
        (projectId && cfg.projectId === projectId)
      )
    );

    if (!config) {
      setCoolifyHealth(null);
      setCoolifyError("Nema sačuvanog Coolify infrastructure config-a za ovu mašinu/projekat.");
      return;
    }

    setCoolifyTesting(true);
    setCoolifyError("");
    try {
      const result = await testInfraConfig(config.id);
      setCoolifyHealth(result);
      flash("Coolify connection tested");
    } catch (err) {
      setCoolifyHealth(null);
      setCoolifyError(err instanceof Error ? err.message : "Coolify test nije uspio");
    } finally {
      setCoolifyTesting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-text">Publish & Deploy</h1>
        </div>
        <div className="flex items-center gap-2">
          {actionMsg && <span className="text-[11px] text-accent animate-pulse hidden sm:inline">{actionMsg}</span>}
          <button onClick={() => navigate(`/project/${projectId}`)} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text">← Workspace</button>
          <button onClick={toggleTheme} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-text hover:bg-surface-2">{theme === "dark" ? "☀" : "☾"}</button>
          <button onClick={logout} className="text-[11px] text-text-muted hover:text-text">Logout</button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-44 shrink-0 border-r border-border bg-surface-2/50 overflow-y-auto">
          <nav className="p-2 space-y-0.5">
            {([
              ["preview", "👁", "Preview"],
              ["publish", "🔗", "Publish"],
              ["deploy", "🚀", "Deploy"],
            ] as const).map(([id, icon, label]) => (
              <button key={id} onClick={() => setTab(id as Tab)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors text-left ${tab === id ? "bg-accent/15 text-accent border border-accent/20" : "text-text-secondary hover:text-text hover:bg-surface-2 border border-transparent"}`}>
                <span>{icon}</span><span>{label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* ── Preview ── */}
          {tab === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between"><h2 className="text-[16px] font-bold text-text">Live Preview</h2></div>
              <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="text" value={machineId} onChange={(e) => setMachineId(e.target.value)} placeholder="Machine ID" className="flex-1 min-w-[200px] px-3 py-2 bg-surface-3 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" />
                  <button onClick={handleStartPreview} className="px-3 py-2 rounded-lg bg-accent text-white text-[11px] hover:bg-accent-light">Start Preview</button>
                  <button onClick={handleStopPreview} className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-[11px] hover:bg-red-500/20">Stop</button>
                </div>
              </div>
              {previewStatus?.running && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] text-green-400 font-medium">● Running</span>
                    <a href={previewStatus.url || "#"} target="_blank" rel="noopener noreferrer" className="text-[12px] text-accent underline">{previewStatus.url}</a>
                    <span className="text-[11px] text-text-muted">{previewStatus.framework && `Framework: ${previewStatus.framework}`}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {DEVICE_PRESETS.map((d) => (
                      <button key={d.id} onClick={() => setPreviewDevice(d.id)} className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors ${previewDevice === d.id ? "bg-accent/15 border-accent/30 text-accent" : "bg-surface-2 border-border text-text-secondary hover:text-text"}`}>
                        {d.icon} {d.label}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-xl border border-border overflow-hidden bg-white" style={{ maxWidth: previewDevice === "mobile" ? "400px" : previewDevice === "tablet" ? "800px" : "100%" }}>
                    <div className="bg-surface-2 px-3 py-1.5 text-[10px] text-text-muted flex items-center justify-between border-b border-border">
                      <span>{DEVICE_PRESETS.find((d) => d.id === previewDevice)?.label || "Desktop"}</span>
                      <span>{previewStatus.url || "Preview"}</span>
                    </div>
                    <iframe src={previewStatus.url || undefined} className="w-full bg-white" style={{ height: previewDevice === "mobile" ? "700px" : previewDevice === "tablet" ? "900px" : "600px" }} title="Preview" />
                  </div>
                </div>
              )}
              {!previewStatus?.running && (
                <div className="text-[12px] text-text-muted px-4 py-8 text-center">Preview not running. Enter a machine ID and start preview.</div>
              )}
            </div>
          )}

          {/* ── Publish ── */}
          {tab === "publish" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between"><h2 className="text-[16px] font-bold text-text">Publish Links</h2><button onClick={() => setShowPublishForm(true)} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ New Link</button></div>
              <div className="space-y-1.5">
                {publishLinks.length === 0 && <div className="text-[12px] text-text-muted px-4 py-8 text-center">No publish links yet.</div>}
                {publishLinks.map((l) => (
                  <div key={l.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-2 border border-border">
                    <div className="flex-1 min-w-0">
                      <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-accent hover:underline truncate block">{l.url}</a>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${l.isEnabled ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{l.isEnabled ? "Enabled" : "Disabled"}</span>
                        {l.hasPassword && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400">🔒 Password</span>}
                        {l.expiresAt && <span className="text-[10px] text-text-muted">Expires: {new Date(l.expiresAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => handleToggleLink(l)} className={`text-[10px] px-2 py-1 rounded ${l.isEnabled ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>{l.isEnabled ? "Disable" : "Enable"}</button>
                      <button onClick={() => handleDeleteLink(l)} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {showPublishForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4">
                    <h4 className="text-[13px] font-bold">New Publish Link</h4>
                    <div><label className="text-[11px] text-text-muted block mb-1">Password Protection (optional)</label><input type="text" value={publishPassword} onChange={(e) => setPublishPassword(e.target.value)} placeholder="Leave empty for public" className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Expiration (hours, optional)</label><input type="number" value={publishExpires} onChange={(e) => setPublishExpires(e.target.value)} placeholder="Leave empty for no expiry" className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
                    <div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => setShowPublishForm(false)} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleCreateLink} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Create</button></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Deploy ── */}
          {tab === "deploy" && (
            <div className="space-y-6">
              <h2 className="text-[16px] font-bold text-text">Deploy Manager</h2>

              {/* Provider selection + config */}
              <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-3">
                <h4 className="text-[12px] font-semibold text-text">Deploy Target</h4>
                <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-[11px] text-text-secondary space-y-1.5">
                  <div className="font-semibold text-text">Coolify prep za VPS hostovanje</div>
                  <div>1. Poveži aktivni VPS kroz <code>Machines</code> i potvrdi javni host / SSH pristup.</div>
                  <div>2. U <code>Infrastructure</code> dodaj <code>Coolify</code> config sa URL-om i API tokenom.</div>
                  <div>3. Na VPS-u instaliraj Coolify i veži domen ili poddomen za aktivni projekat.</div>
                  <div>4. Poveži repo ili deploy source, zatim koristi ovaj ekran za branch/deploy tok i praćenje logova.</div>
                  <div>5. Nakon deploy-a dodaj monitor i alert config da produkcioni projekti ostanu pod nadzorom.</div>
                </div>
                <div className="rounded-xl border border-border bg-surface-3 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-[12px] font-semibold text-text">Install Coolify on VPS</div>
                      <div className="text-[11px] text-text-muted">Automatska SSH instalacija Docker + Coolify control plane-a na izabranoj mašini.</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={coolifyMachineId}
                        onChange={(e) => setCoolifyMachineId(e.target.value)}
                        className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-[12px] text-text outline-none"
                      >
                        <option value="">Izaberi VPS</option>
                        {machines.map((machine) => (
                          <option key={machine.id} value={machine.id}>
                            {machine.name} · {machine.host}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleInstallCoolify}
                        disabled={!coolifyMachineId || coolifyInstalling}
                        className="px-3 py-2 rounded-lg bg-accent text-white text-[11px] hover:bg-accent-light disabled:opacity-50"
                      >
                        {coolifyInstalling ? "Installing..." : "🧊 Install Coolify"}
                      </button>
                      <button
                        onClick={handleTestCoolify}
                        disabled={!coolifyMachineId || coolifyTesting}
                        className="px-3 py-2 rounded-lg border border-border bg-surface-2 text-text text-[11px] hover:border-accent/30 hover:text-accent disabled:opacity-50"
                      >
                        {coolifyTesting ? "Testing..." : "🔎 Test Coolify"}
                      </button>
                    </div>
                  </div>
                  {(coolifyEvents.length > 0 || coolifyError || coolifyHealth) && (
                    <div className="rounded-xl border border-border bg-surface p-3 space-y-2">
                      <div className="text-[12px] font-semibold text-text">Coolify install / connection status</div>
                      <div className="space-y-1 max-h-56 overflow-auto">
                        {coolifyEvents.map((event, index) => (
                          <div key={`${event.status}-${index}`} className="flex items-start gap-2 text-[11px] font-mono">
                            <span className={`mt-0.5 inline-block w-2 h-2 rounded-full ${event.status === 'ready' ? 'bg-green-500' : event.status === 'error' ? 'bg-red-500' : 'bg-accent animate-pulse'}`} />
                            <div>
                              <div className="text-text">{event.message}</div>
                              {event.details && <div className="text-text-muted">{event.details}</div>}
                            </div>
                          </div>
                        ))}
                        {coolifyHealth && (
                          <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-2 h-2 rounded-full ${coolifyHealth.status === 'ok' ? 'bg-green-500' : coolifyHealth.status === 'degraded' ? 'bg-yellow-400' : coolifyHealth.status === 'down' ? 'bg-red-500' : 'bg-text-muted'}`} />
                              <span className="text-text">Health: {coolifyHealth.status}</span>
                              {coolifyHealth.latency != null && <span className="text-text-muted">{coolifyHealth.latency}ms</span>}
                            </div>
                            {coolifyHealth.message && <div className="mt-1 text-text-muted">{coolifyHealth.message}</div>}
                          </div>
                        )}
                        {coolifyError && <div className="text-[11px] text-red-400">{coolifyError}</div>}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value as DeploymentTarget)} className="bg-surface-3 border border-border rounded-lg px-3 py-2 text-[12px] text-text outline-none">
                    {Object.entries(TARGET_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <input type="text" value={deployBranch} onChange={(e) => setDeployBranch(e.target.value)} placeholder="Branch" className="w-28 px-3 py-2 bg-surface-3 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" />
                  <button onClick={handleDeploy} className="px-4 py-2 rounded-lg bg-accent text-white text-[11px] hover:bg-accent-light font-medium">🚀 Deploy Now</button>
                </div>
                {/* Provider status */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-2">
                  {providers.map((p) => (
                    <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] ${p.configured ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-surface-3 border-border text-text-muted"}`}>
                      <span>{p.icon || TARGET_LABELS[p.id as DeploymentTarget]?.[0] || "?"}</span>
                      <span className="truncate">{p.name || p.id}</span>
                      {p.configured && <span className="ml-auto text-[9px]">✓</span>}
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowProviderConfig(!showProviderConfig)} className="text-[11px] text-accent hover:underline">Configure provider →</button>
                {showProviderConfig && (
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value as DeploymentTarget)} className="bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[11px] text-text outline-none">
                        {Object.entries(TARGET_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <input type="text" value={providerConfig.apiKey || ""} onChange={(e) => { const v = e.target.value; setProviderConfig((p) => ({ ...p, apiKey: v })); }} placeholder="API Key" className="flex-1 min-w-[150px] px-3 py-1.5 bg-surface-3 border border-border rounded-lg text-[11px] text-text outline-none focus:border-accent" />
                      <input type="text" value={providerConfig.token || ""} onChange={(e) => { const v = e.target.value; setProviderConfig((p) => ({ ...p, token: v })); }} placeholder="Token" className="flex-1 min-w-[150px] px-3 py-1.5 bg-surface-3 border border-border rounded-lg text-[11px] text-text outline-none focus:border-accent" />
                      <button onClick={() => handleConfigureProvider(selectedTarget)} className="px-3 py-1.5 rounded-lg bg-accent text-white text-[11px] hover:bg-accent-light">Save</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Active deployment detail */}
              {activeDeployment && (
                <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-3">
                  <div className="flex items-center justify-between"><h4 className="text-[12px] font-semibold text-text">Deployment #{activeDeployment.id.slice(0, 8)}</h4><button onClick={() => setActiveDeployment(null)} className="text-[10px] text-text-muted hover:text-text">Close</button></div>
                  <div className="flex items-center gap-3 flex-wrap text-[11px]">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[activeDeployment.status]}`}>{STATUS_ICONS[activeDeployment.status]} {activeDeployment.status}</span>
                    <span className="text-text-muted">Target: {TARGET_LABELS[activeDeployment.target] || activeDeployment.target}</span>
                    {activeDeployment.liveUrl && <a href={activeDeployment.liveUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">Live URL</a>}
                    <span className="text-text-muted">{activeDeployment.branch && `Branch: ${activeDeployment.branch}`}</span>
                    {activeDeployment.duration && <span className="text-text-muted">Duration: {activeDeployment.duration}s</span>}
                  </div>
                  {activeDeployment.commitMessage && <div className="text-[11px] text-text-muted">{activeDeployment.commitMessage}</div>}
                  {/* Build log */}
                  <div className="space-y-1">{buildLog.length === 0 && <div className="text-[11px] text-text-muted">No build log entries.</div>}
                    {buildLog.map((l, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                        <span className="text-text-muted shrink-0">{new Date(l.timestamp).toLocaleTimeString()}</span>
                        <span className={`shrink-0 ${l.level === "error" ? "text-red-400" : l.level === "warn" ? "text-yellow-400" : "text-text-muted"}`}>{l.level}</span>
                        <span className="text-text">{l.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deployment history */}
              <div className="space-y-2">
                <h4 className="text-[12px] font-semibold text-text mb-2">Deployment History</h4>
                {deployments.length === 0 && <div className="text-[12px] text-text-muted px-4 py-6 text-center">No deployments yet.</div>}
                <div className="space-y-1.5">
                  {deployments.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-2 border border-border cursor-pointer hover:bg-surface-3 transition-colors" onClick={() => handleViewDeployment(d)}>
                      <div className="flex items-center gap-3">
                        <span className={`text-[14px] ${d.status === "running" ? "animate-pulse" : ""}`}>{STATUS_ICONS[d.status]}</span>
                        <div>
                          <div className="text-[12px] font-medium text-text">{TARGET_LABELS[d.target] || d.target} {d.branch && `· ${d.branch}`}</div>
                          <div className="text-[10px] text-text-muted">{new Date(d.createdAt).toLocaleString()} {d.duration && `· ${d.duration}s`}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status].split(" ")[0]} ${STATUS_COLORS[d.status].split(" ")[1]}`}>{d.status}</span>
                        {d.status === "building" && <button onClick={(e) => { e.stopPropagation(); handleStopDeployment(d.id); }} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">Stop</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
