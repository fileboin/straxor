import { useState, useEffect, useCallback } from "react";
import {
  scaleApi,
  type ClusterStatus,
  type RuntimeNode,
  type LoadBalancerConfig,
  type FailoverConfig,
  type ScalingPolicy,
} from "../../lib/scale";

interface Props {
  onClose: () => void;
}

type Tab = "overview" | "nodes" | "loadbalancer" | "failover" | "scaling";

type SubTab = "list" | "create" | "detail";

const STRATEGY_OPTIONS = ["round-robin", "least-connections", "weighted", "random", "latency-based"];
const FAILOVER_STRATEGIES = ["auto", "manual", "priority-based", "geo-based"];
const SCALING_METRICS = ["concurrent_sessions", "cpu_usage", "memory_usage", "queue_depth", "latency_p99"];
const SCALING_TARGETS = ["multi-agent", "gateway", "runtime", "deployments"];

export default function GlobalScalePanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [status, setStatus] = useState<ClusterStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");

  // Sub-tabs for CRUD
  const [nodeSub, setNodeSub] = useState<SubTab>("list");
  const [lbSub, setLbSub] = useState<SubTab>("list");
  const [foSub, setFoSub] = useState<SubTab>("list");
  const [spSub, setSpSub] = useState<SubTab>("list");

  // Node form
  const [nodeForm, setNodeForm] = useState({ name: "", url: "", region: "default", capabilities: "", version: "1.0.0", priority: 0 });

  // LB form
  const [lbForm, setLbForm] = useState({ name: "", provider: "", strategy: "round-robin", targets: "", rules: "" });

  // Failover form
  const [foForm, setFoForm] = useState({ name: "", provider: "", primaryEndpoint: "", backupEndpoints: "", strategy: "auto", healthCheckInterval: 30, maxRetries: 3, cooldownPeriod: 60 });

  // Scaling policy form
  const [spForm, setSpForm] = useState({ name: "", target: "multi-agent", metric: "concurrent_sessions", minInstances: 1, maxInstances: 10, scaleUpThreshold: 80, scaleDownThreshold: 30, cooldownSeconds: 120 });

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await scaleApi.getStatus();
      setStatus(s);
    } catch (err: any) { flash(err.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Node CRUD ──
  const createNode = async () => {
    if (!nodeForm.name.trim()) return;
    try {
      await scaleApi.createNode({ ...nodeForm, capabilities: nodeForm.capabilities.split(",").map((s) => s.trim()).filter(Boolean) });
      flash("Node created");
      setNodeForm({ name: "", url: "", region: "default", capabilities: "", version: "1.0.0", priority: 0 });
      setNodeSub("list");
      load();
    } catch (err: any) { flash(err.message); }
  };
  const deleteNode = async (id: string) => {
    try { await scaleApi.deleteNode(id); flash("Node deleted"); load(); } catch (err: any) { flash(err.message); }
  };

  // ── LB CRUD ──
  const createLb = async () => {
    if (!lbForm.name.trim()) return;
    try {
      await scaleApi.createLoadBalancer({
        ...lbForm,
        targets: lbForm.targets ? lbForm.targets.split(",").map((s) => s.trim()) : [],
        rules: lbForm.rules ? lbForm.rules.split("\n").filter(Boolean) : [],
      });
      flash("Load balancer created");
      setLbForm({ name: "", provider: "", strategy: "round-robin", targets: "", rules: "" });
      setLbSub("list");
      load();
    } catch (err: any) { flash(err.message); }
  };
  const toggleLb = async (lb: LoadBalancerConfig) => {
    try { await scaleApi.updateLoadBalancer(lb.id, { isActive: !lb.isActive }); load(); } catch (err: any) { flash(err.message); }
  };
  const deleteLb = async (id: string) => {
    try { await scaleApi.deleteLoadBalancer(id); flash("Load balancer deleted"); load(); } catch (err: any) { flash(err.message); }
  };

  // ── Failover CRUD ──
  const createFo = async () => {
    if (!foForm.name.trim() || !foForm.provider.trim()) return;
    try {
      await scaleApi.createFailoverConfig({
        ...foForm,
        backupEndpoints: foForm.backupEndpoints ? foForm.backupEndpoints.split(",").map((s) => s.trim()) : [],
      });
      flash("Failover config created");
      setFoForm({ name: "", provider: "", primaryEndpoint: "", backupEndpoints: "", strategy: "auto", healthCheckInterval: 30, maxRetries: 3, cooldownPeriod: 60 });
      setFoSub("list");
      load();
    } catch (err: any) { flash(err.message); }
  };
  const toggleFo = async (fo: FailoverConfig) => {
    try { await scaleApi.updateFailoverConfig(fo.id, { isActive: !fo.isActive }); load(); } catch (err: any) { flash(err.message); }
  };
  const deleteFo = async (id: string) => {
    try { await scaleApi.deleteFailoverConfig(id); flash("Failover deleted"); load(); } catch (err: any) { flash(err.message); }
  };
  const triggerFo = async (id: string) => {
    try { const r = await scaleApi.triggerFailover(id); flash(r.message); } catch (err: any) { flash(err.message); }
  };

  // ── Scaling Policy CRUD ──
  const createSp = async () => {
    if (!spForm.name.trim()) return;
    try {
      await scaleApi.createScalingPolicy(spForm);
      flash("Scaling policy created");
      setSpForm({ name: "", target: "multi-agent", metric: "concurrent_sessions", minInstances: 1, maxInstances: 10, scaleUpThreshold: 80, scaleDownThreshold: 30, cooldownSeconds: 120 });
      setSpSub("list");
      load();
    } catch (err: any) { flash(err.message); }
  };
  const toggleSp = async (sp: ScalingPolicy) => {
    try { await scaleApi.updateScalingPolicy(sp.id, { isActive: !sp.isActive }); load(); } catch (err: any) { flash(err.message); }
  };
  const deleteSp = async (id: string) => {
    try { await scaleApi.deleteScalingPolicy(id); flash("Policy deleted"); load(); } catch (err: any) { flash(err.message); }
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "nodes", label: "Runtime Nodes", icon: "🖥" },
    { id: "loadbalancer", label: "Load Balancer", icon: "⚖" },
    { id: "failover", label: "Failover", icon: "🔄" },
    { id: "scaling", label: "Scaling", icon: "📈" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-lg">🌍</span>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-text">Global Scale & HA</h1>
              <p className="text-[10px] text-text-muted">Distribuirani runtime, load balancing, failover, auto-scaling</p>
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
          {loading && !status ? (
            <div className="text-text-muted text-[11px] py-8 text-center">Loading...</div>
          ) : !status ? (
            <div className="text-text-muted text-[11px] py-8 text-center">Failed to load cluster status</div>
          ) : (
            <>
              {/* ── OVERVIEW ── */}
              {tab === "overview" && (
                <>
                  <div className={`p-3 rounded-lg text-[11px] font-medium ${
                    status.health === "healthy" ? "bg-green-500/10 text-green-300" :
                    status.health === "degraded" ? "bg-yellow-500/10 text-yellow-300" :
                    "bg-red-500/10 text-red-300"
                  }`}>
                    Cluster status: <strong>{status.health.toUpperCase()}</strong>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-surface-dim rounded-lg">
                      <div className="text-[10px] text-text-muted">Runtime Nodes</div>
                      <div className="text-2xl font-bold text-text mt-1">{status.nodes.online}<span className="text-text-muted text-sm">/{status.nodes.total}</span></div>
                      <div className="text-[9px] text-text-muted mt-1">{status.nodes.offline} offline</div>
                    </div>
                    <div className="p-3 bg-surface-dim rounded-lg">
                      <div className="text-[10px] text-text-muted">Load Balancers</div>
                      <div className="text-2xl font-bold text-text mt-1">{status.loadBalancers.active}<span className="text-text-muted text-sm">/{status.loadBalancers.total}</span></div>
                      <div className="text-[9px] text-text-muted mt-1">{status.loadBalancers.total - status.loadBalancers.active} inactive</div>
                    </div>
                    <div className="p-3 bg-surface-dim rounded-lg">
                      <div className="text-[10px] text-text-muted">Failover Configs</div>
                      <div className="text-2xl font-bold text-text mt-1">{status.failover.active}<span className="text-text-muted text-sm">/{status.failover.total}</span></div>
                      <div className="text-[9px] text-text-muted mt-1">{status.failover.total - status.failover.active} inactive</div>
                    </div>
                    <div className="p-3 bg-surface-dim rounded-lg">
                      <div className="text-[10px] text-text-muted">Scaling Policies</div>
                      <div className="text-2xl font-bold text-text mt-1">{status.scalingPolicies.active}<span className="text-text-muted text-sm">/{status.scalingPolicies.total}</span></div>
                      <div className="text-[9px] text-text-muted mt-1">{status.scalingPolicies.total - status.scalingPolicies.active} inactive</div>
                    </div>
                  </div>

                  <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg">
                    <h3 className="text-[12px] font-bold text-text mb-1">🌍 Global Scale Architecture</h3>
                    <p className="text-[11px] text-text-muted">
                      Runtime Nodes pružaju distribuirani execution layer. Load Balancer raspoređuje zahtjeve po strategiji (round-robin, least-connections, weighted, random, latency-based). Failover automatski prebacuje na backup endpoint-e kada primarni padne. Scaling Policies definišu auto-scaling pravila za multi-agent sisteme i gateway.
                    </p>
                  </div>
                </>
              )}

              {/* ── RUNTIME NODES ── */}
              {tab === "nodes" && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setNodeSub(nodeSub === "create" ? "list" : "create")}
                      className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">
                      {nodeSub === "create" ? "View List" : "+ Add Node"}
                    </button>
                    <button onClick={load} className="px-3 py-1.5 bg-surface-dim border border-border text-text text-[11px] rounded-lg hover:bg-border">Refresh</button>
                  </div>

                  {nodeSub === "create" && (
                    <div className="p-3 bg-surface-dim rounded-lg space-y-2 mb-3">
                      <input value={nodeForm.name} onChange={(e) => setNodeForm((p) => ({ ...p, name: e.target.value }))} placeholder="Node name"
                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                      <input value={nodeForm.url} onChange={(e) => setNodeForm((p) => ({ ...p, url: e.target.value }))} placeholder="URL (http://node-1:3001)"
                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                      <div className="flex gap-2">
                        <input value={nodeForm.region} onChange={(e) => setNodeForm((p) => ({ ...p, region: e.target.value }))} placeholder="Region"
                          className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                        <input value={nodeForm.priority} onChange={(e) => setNodeForm((p) => ({ ...p, priority: Number(e.target.value) }))} type="number" placeholder="Priority"
                          className="w-24 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                      </div>
                      <input value={nodeForm.capabilities} onChange={(e) => setNodeForm((p) => ({ ...p, capabilities: e.target.value }))} placeholder="Capabilities (deploy,agent,file,search — comma separated)"
                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                      <button onClick={createNode} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Create</button>
                    </div>
                  )}

                  {status.nodes.list.length === 0 ? (
                    <div className="text-text-muted text-[11px] py-8 text-center">No runtime nodes configured</div>
                  ) : (
                    <div className="space-y-2">
                      {status.nodes.list.map((node) => (
                        <div key={node.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-dim rounded-lg">
                          <div className={`w-2 h-2 rounded-full ${node.status === "online" ? "bg-green-400" : node.status === "offline" ? "bg-red-400" : "bg-yellow-400"}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-text font-medium">{node.name}</div>
                            <div className="text-[10px] text-text-muted">
                              {node.region} • v{node.version} • priority {node.priority}
                              {node.lastHeartbeat ? ` • last heartbeat: ${new Date(node.lastHeartbeat).toLocaleString()}` : ""}
                            </div>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                            node.status === "online" ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"
                          }`}>{node.status}</span>
                          <button onClick={() => deleteNode(node.id)} className="text-red-400 hover:text-red-300 text-[11px]">Delete</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── LOAD BALANCER ── */}
              {tab === "loadbalancer" && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setLbSub(lbSub === "create" ? "list" : "create")}
                      className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">
                      {lbSub === "create" ? "View List" : "+ Add LB"}
                    </button>
                  </div>

                  {lbSub === "create" && (
                    <div className="p-3 bg-surface-dim rounded-lg space-y-2 mb-3">
                      <input value={lbForm.name} onChange={(e) => setLbForm((p) => ({ ...p, name: e.target.value }))} placeholder="LB name"
                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                      <div className="flex gap-2">
                        <input value={lbForm.provider} onChange={(e) => setLbForm((p) => ({ ...p, provider: e.target.value }))} placeholder="Provider (e.g. anthropic, openai)"
                          className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                        <select value={lbForm.strategy} onChange={(e) => setLbForm((p) => ({ ...p, strategy: e.target.value }))}
                          className="px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text">
                          {STRATEGY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <input value={lbForm.targets} onChange={(e) => setLbForm((p) => ({ ...p, targets: e.target.value }))} placeholder="Targets (endpoint1, endpoint2, endpoint3)"
                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                      <button onClick={createLb} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Create</button>
                    </div>
                  )}

                  {status.loadBalancers.list.length === 0 ? (
                    <div className="text-text-muted text-[11px] py-8 text-center">No load balancers configured</div>
                  ) : (
                    <div className="space-y-2">
                      {status.loadBalancers.list.map((lb) => (
                        <div key={lb.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-dim rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-text font-medium">{lb.name}</div>
                            <div className="text-[10px] text-text-muted">
                              {lb.strategy}{lb.provider ? ` • ${lb.provider}` : ""}
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={lb.isActive} onChange={() => toggleLb(lb)} className="sr-only peer" />
                            <div className="w-7 h-4 bg-border rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:w-3 after:h-3 after:rounded-full after:bg-white transition-all"></div>
                          </label>
                          <button onClick={() => deleteLb(lb.id)} className="text-red-400 hover:text-red-300 text-[11px]">Delete</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── FAILOVER ── */}
              {tab === "failover" && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setFoSub(foSub === "create" ? "list" : "create")}
                      className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">
                      {foSub === "create" ? "View List" : "+ Add Failover"}
                    </button>
                  </div>

                  {foSub === "create" && (
                    <div className="p-3 bg-surface-dim rounded-lg space-y-2 mb-3">
                      <div className="flex gap-2">
                        <input value={foForm.name} onChange={(e) => setFoForm((p) => ({ ...p, name: e.target.value }))} placeholder="Config name"
                          className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                        <input value={foForm.provider} onChange={(e) => setFoForm((p) => ({ ...p, provider: e.target.value }))} placeholder="Provider"
                          className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                      </div>
                      <input value={foForm.primaryEndpoint} onChange={(e) => setFoForm((p) => ({ ...p, primaryEndpoint: e.target.value }))} placeholder="Primary endpoint"
                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                      <input value={foForm.backupEndpoints} onChange={(e) => setFoForm((p) => ({ ...p, backupEndpoints: e.target.value }))} placeholder="Backup endpoints (comma separated)"
                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                      <div className="flex gap-2">
                        <select value={foForm.strategy} onChange={(e) => setFoForm((p) => ({ ...p, strategy: e.target.value }))}
                          className="px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text">
                          {FAILOVER_STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input value={foForm.healthCheckInterval} onChange={(e) => setFoForm((p) => ({ ...p, healthCheckInterval: Number(e.target.value) }))} type="number" placeholder="HC interval (s)"
                          className="w-24 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                        <input value={foForm.maxRetries} onChange={(e) => setFoForm((p) => ({ ...p, maxRetries: Number(e.target.value) }))} type="number" placeholder="Max retries"
                          className="w-20 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                      </div>
                      <button onClick={createFo} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Create</button>
                    </div>
                  )}

                  {status.failover.list.length === 0 ? (
                    <div className="text-text-muted text-[11px] py-8 text-center">No failover configs</div>
                  ) : (
                    <div className="space-y-2">
                      {status.failover.list.map((fo) => (
                        <div key={fo.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-dim rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-text font-medium">{fo.name}</div>
                            <div className="text-[10px] text-text-muted">
                              {fo.provider} • {fo.strategy} • HC: {fo.healthCheckInterval}s • retries: {fo.maxRetries}
                            </div>
                          </div>
                          <button onClick={() => triggerFo(fo.id)} className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-[10px] rounded-lg hover:bg-yellow-500/30">Test</button>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={fo.isActive} onChange={() => toggleFo(fo)} className="sr-only peer" />
                            <div className="w-7 h-4 bg-border rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:w-3 after:h-3 after:rounded-full after:bg-white transition-all"></div>
                          </label>
                          <button onClick={() => deleteFo(fo.id)} className="text-red-400 hover:text-red-300 text-[11px]">Delete</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── SCALING POLICIES ── */}
              {tab === "scaling" && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setSpSub(spSub === "create" ? "list" : "create")}
                      className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">
                      {spSub === "create" ? "View List" : "+ Add Policy"}
                    </button>
                  </div>

                  {spSub === "create" && (
                    <div className="p-3 bg-surface-dim rounded-lg space-y-2 mb-3">
                      <input value={spForm.name} onChange={(e) => setSpForm((p) => ({ ...p, name: e.target.value }))} placeholder="Policy name"
                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                      <div className="flex gap-2">
                        <select value={spForm.target} onChange={(e) => setSpForm((p) => ({ ...p, target: e.target.value }))}
                          className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text">
                          {SCALING_TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select value={spForm.metric} onChange={(e) => setSpForm((p) => ({ ...p, metric: e.target.value }))}
                          className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text">
                          {SCALING_METRICS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <div className="text-[9px] text-text-muted mb-1">Min / Max instances</div>
                          <div className="flex gap-2">
                            <input value={spForm.minInstances} onChange={(e) => setSpForm((p) => ({ ...p, minInstances: Number(e.target.value) }))} type="number" placeholder="Min"
                              className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text" />
                            <input value={spForm.maxInstances} onChange={(e) => setSpForm((p) => ({ ...p, maxInstances: Number(e.target.value) }))} type="number" placeholder="Max"
                              className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-[9px] text-text-muted mb-1">Scale up / down threshold (%)</div>
                          <div className="flex gap-2">
                            <input value={spForm.scaleUpThreshold} onChange={(e) => setSpForm((p) => ({ ...p, scaleUpThreshold: Number(e.target.value) }))} type="number" placeholder="Up %"
                              className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text" />
                            <input value={spForm.scaleDownThreshold} onChange={(e) => setSpForm((p) => ({ ...p, scaleDownThreshold: Number(e.target.value) }))} type="number" placeholder="Down %"
                              className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text" />
                          </div>
                        </div>
                      </div>
                      <input value={spForm.cooldownSeconds} onChange={(e) => setSpForm((p) => ({ ...p, cooldownSeconds: Number(e.target.value) }))} type="number" placeholder="Cooldown (s)"
                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text" />
                      <button onClick={createSp} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Create</button>
                    </div>
                  )}

                  {status.scalingPolicies.list.length === 0 ? (
                    <div className="text-text-muted text-[11px] py-8 text-center">No scaling policies configured</div>
                  ) : (
                    <div className="space-y-2">
                      {status.scalingPolicies.list.map((sp) => (
                        <div key={sp.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-dim rounded-lg">
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] text-text font-medium">{sp.name}</div>
                            <div className="text-[10px] text-text-muted">
                              {sp.target} • {sp.metric} • {sp.minInstances}-{sp.maxInstances} instances • up @{sp.scaleUpThreshold}% / down @{sp.scaleDownThreshold}%
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={sp.isActive} onChange={() => toggleSp(sp)} className="sr-only peer" />
                            <div className="w-7 h-4 bg-border rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:w-3 after:h-3 after:rounded-full after:bg-white transition-all"></div>
                          </label>
                          <button onClick={() => deleteSp(sp.id)} className="text-red-400 hover:text-red-300 text-[11px]">Delete</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
