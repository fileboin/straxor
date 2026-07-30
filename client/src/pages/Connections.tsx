import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  listAdapters, listInstances, createInstance, deleteInstance,
  getConnectionStats, getConnectionCategories, testConnection, executeConnection,
  updateInstance, getAdapter,
} from "../lib/connections";
import type { AdapterInfo, ConnectionInstance } from "../lib/connections";

type Tab = "browse" | "instances" | "new" | "detail";

const CATEGORIES = [
  { id: "automation", name: "Automation", icon: "⚡" },
  { id: "hardware", name: "Hardware", icon: "🔧" },
  { id: "network", name: "Network", icon: "🌐" },
  { id: "cloud", name: "Cloud", icon: "☁️" },
  { id: "ai", name: "AI", icon: "🤖" },
  { id: "custom", name: "Custom", icon: "🧩" },
];

export default function Connections() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("browse");
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [instances, setInstances] = useState<ConnectionInstance[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedAdapter, setSelectedAdapter] = useState<AdapterInfo | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<ConnectionInstance | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // New connection form
  const [formName, setFormName] = useState("");
  const [formConfig, setFormConfig] = useState<Record<string, string>>({});
  const [formResult, setFormResult] = useState<any>(null);

  // Execute form
  const [execOperation, setExecOperation] = useState("");
  const [execPayload, setExecPayload] = useState("");
  const [execResult, setExecResult] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [adapterRes, instanceRes, statsRes] = await Promise.all([
        listAdapters(activeCategory || undefined),
        listInstances(activeCategory || undefined),
        getConnectionStats(),
      ]);
      setAdapters(adapterRes.adapters);
      setInstances(instanceRes.instances);
      setStats(statsRes);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, [activeCategory]);

  useEffect(() => { load(); }, [load]);

  const openNew = async (adapter: AdapterInfo) => {
    setSelectedAdapter(adapter);
    setFormName("");
    setFormConfig({});
    setFormResult(null);
    setTab("new");
  };

  const openDetail = async (inst: ConnectionInstance) => {
    setSelectedInstance(inst);
    setExecOperation("");
    setExecPayload("");
    setExecResult(null);
    setTab("detail");
  };

  const handleCreate = async () => {
    if (!selectedAdapter || !formName) return;
    setLoading(true);
    setError("");
    try {
      const instance = await createInstance(selectedAdapter.name, formName, formConfig);
      setSelectedInstance(instance);
      setTab("detail");
      load();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handleTest = async (id: string) => {
    setLoading(true);
    try {
      const result = await testConnection(id);
      setFormResult(result);
      load();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handleExecute = async () => {
    if (!selectedInstance || !execOperation) return;
    setLoading(true);
    try {
      let payload = undefined;
      if (execPayload) { try { payload = JSON.parse(execPayload); } catch { payload = execPayload; } }
      const result = await executeConnection(selectedInstance.id, execOperation, payload);
      setExecResult(result);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this connection?")) return;
    setLoading(true);
    try {
      await deleteInstance(id);
      setTab("instances");
      load();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="connections page">
      <div className="page-header">
        <h1>Universal Connections</h1>
        <p className="text-secondary">Connect STRAXOR with any service, device, or API</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {stats && (
        <div className="stats-bar">
          <div className="stat-item"><span className="stat-value">{stats.totalAdapters}</span><span className="stat-label">Adapters</span></div>
          <div className="stat-item"><span className="stat-value">{stats.totalInstances}</span><span className="stat-label">Connections</span></div>
          <div className="stat-item"><span className="stat-value stats-green">{stats.connected}</span><span className="stat-label">Connected</span></div>
          <div className="stat-item"><span className="stat-value stats-red">{stats.errors}</span><span className="stat-label">Errors</span></div>
        </div>
      )}

      {tab === "browse" && (
        <div className="connections-browse">
          <div className="category-tabs">
            <button className={`category-tab ${!activeCategory ? "active" : ""}`} onClick={() => setActiveCategory(null)}>All</button>
            {CATEGORIES.map(cat => (
              <button key={cat.id} className={`category-tab ${activeCategory === cat.id ? "active" : ""}`} onClick={() => setActiveCategory(cat.id)}>
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          <section>
            <h2>Available Adapters ({adapters.length})</h2>
            <div className="adapter-grid">
              {adapters.map(a => (
                <div key={a.name} className="adapter-card" onClick={() => openNew(a)}>
                  <div className="adapter-icon">{a.icon}</div>
                  <div className="adapter-info">
                    <h3>{a.displayName}</h3>
                    <p>{a.description}</p>
                  </div>
                  <div className="adapter-meta">
                    <span className="badge">{a.category}</span>
                    <span className="badge">{a.authType}</span>
                  </div>
                </div>
              ))}
              {adapters.length === 0 && <p className="text-secondary">No adapters found.</p>}
            </div>
          </section>

          <section>
            <h2>Your Connections ({instances.length})</h2>
            <div className="instance-list">
              {instances.map(inst => (
                <div key={inst.id} className="instance-card" onClick={() => openDetail(inst)}>
                  <div className="instance-header">
                    <strong>{inst.name}</strong>
                    <span className={`badge badge-${inst.status}`}>{inst.status}</span>
                  </div>
                  <div className="instance-meta">
                    <span>{inst.adapterName}</span>
                    <span className="text-secondary">{new Date(inst.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {instances.length === 0 && <p className="text-secondary">No connections yet. Click an adapter above to create one.</p>}
            </div>
          </section>
        </div>
      )}

      {tab === "new" && selectedAdapter && (
        <div className="connections-new">
          <button className="btn" onClick={() => setTab("browse")}>← Back</button>
          <h2>New {selectedAdapter.displayName} Connection</h2>
          <div className="new-form">
            <div className="form-group">
              <label>Connection Name</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="My Connection" />
            </div>
            {selectedAdapter.configSchema.map(field => (
              <div key={field.key} className="form-group">
                <label>{field.label} {field.required && "*"}</label>
                {field.type === "boolean" ? (
                  <input type="checkbox" checked={!!formConfig[field.key]} onChange={e => setFormConfig(p => ({ ...p, [field.key]: String(e.target.checked) }))} />
                ) : field.type === "select" ? (
                  <select value={formConfig[field.key] || ""} onChange={e => setFormConfig(p => ({ ...p, [field.key]: e.target.value }))}>
                    <option value="">-- Select --</option>
                    {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input type={field.type === "password" ? "password" : "text"} value={formConfig[field.key] || ""} onChange={e => setFormConfig(p => ({ ...p, [field.key]: e.target.value }))} placeholder={field.placeholder} />
                )}
                {field.description && <span className="field-desc">{field.description}</span>}
              </div>
            ))}
            <button className="btn btn-primary" onClick={handleCreate} disabled={loading || !formName}>
              {loading ? "Creating..." : "Create Connection"}
            </button>
          </div>
        </div>
      )}

      {tab === "detail" && selectedInstance && (
        <div className="connections-detail">
          <button className="btn" onClick={() => setTab("browse")}>← Back</button>

          <div className="detail-header">
            <h2>{selectedInstance.name}</h2>
            <span className={`badge badge-${selectedInstance.status}`}>{selectedInstance.status}</span>
          </div>

          <div className="detail-meta">
            <span>Adapter: {selectedInstance.adapterName}</span>
            <span>Category: {selectedInstance.category}</span>
            <span>Created: {new Date(selectedInstance.createdAt).toLocaleDateString()}</span>
            {selectedInstance.lastError && <span className="text-red">Error: {selectedInstance.lastError}</span>}
          </div>

          <div className="detail-actions">
            <h3>Actions</h3>
            <div className="action-buttons">
              <button className="btn" onClick={() => handleTest(selectedInstance.id)} disabled={loading}>
                {loading ? "Testing..." : "Test Connection"}
              </button>
            </div>
            {formResult && (
              <div className={`test-result ${formResult.success ? "success" : "fail"}`}>
                {formResult.success ? "✓ " : "✗ "}{formResult.message}
                <span className="latency">{formResult.latency}ms</span>
              </div>
            )}
          </div>

          <div className="detail-execute">
            <h3>Execute Operation</h3>
            <div className="form-group">
              <label>Operation</label>
              <input type="text" value={execOperation} onChange={e => setExecOperation(e.target.value)} placeholder="e.g. chat, deploy, send" />
            </div>
            <div className="form-group">
              <label>Payload (JSON)</label>
              <textarea value={execPayload} onChange={e => setExecPayload(e.target.value)} placeholder='{"key": "value"}' rows={4} />
            </div>
            <button className="btn btn-primary" onClick={handleExecute} disabled={loading || !execOperation}>
              {loading ? "Executing..." : "Execute"}
            </button>
            {execResult && (
              <div className="exec-result">
                <h4>Result ({execResult.duration}ms)</h4>
                <pre>{JSON.stringify(execResult, null, 2)}</pre>
              </div>
            )}
          </div>

          <div className="detail-config">
            <h3>Configuration</h3>
            <pre>{JSON.stringify(selectedInstance.config, null, 2)}</pre>
          </div>

          <button className="btn btn-danger" onClick={() => handleDelete(selectedInstance.id)}>Delete Connection</button>
        </div>
      )}

      {loading && <div className="loading-spinner" />}
    </div>
  );
}
