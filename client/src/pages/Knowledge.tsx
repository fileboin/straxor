import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import { useTheme } from "../lib/theme.js";
import {
  getProjectKnowledge, saveProjectKnowledge,
  listKnowledge, createKnowledge, deleteKnowledge,
  getGraphNodes, createGraphNode, deleteGraphNode,
  getGraphEdges, createGraphEdge,
  listDecisions, createDecision, deleteDecision,
  listDocs, createDoc, deleteDoc,
  listVersions,
  searchKnowledge, buildContext,
} from "../lib/knowledge.js";

type KnowledgeTab = "overview" | "knowledge" | "graph" | "decisions" | "docs" | "versions" | "search";

export default function Knowledge() {
  const { id: projectId } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const { toggleTheme, theme } = useTheme();
  const navigate = useNavigate();

  const [tab, setTab] = useState<KnowledgeTab>("overview");
  const [actionMsg, setActionMsg] = useState("");
  const flash = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(""), 2500); };

  const [project, setProject] = useState<any>({});
  const [items, setItems] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [contextResult, setContextResult] = useState<any>(null);

  const [showItemForm, setShowItemForm] = useState(false);
  const [itemForm, setItemForm] = useState({ key: "", type: "architecture", summary: "", value: "" });
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [decisionForm, setDecisionForm] = useState({ title: "", context: "", decision: "", reason: "", alternatives: "", consequences: "", tags: "" });
  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm] = useState({ category: "architecture", title: "", content: "" });
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [nodeForm, setNodeForm] = useState({ label: "", type: "default", properties: "" });
  const [showEdgeForm, setShowEdgeForm] = useState(false);
  const [edgeForm, setEdgeForm] = useState({ sourceId: "", targetId: "", relation: "" });

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try { setProject(await getProjectKnowledge(projectId)); } catch { flash("Error loading project"); }
  }, [projectId]);
  const loadItems = useCallback(async () => {
    if (!projectId) return;
    try { setItems(await listKnowledge(projectId)); } catch { flash("Error"); }
  }, [projectId]);
  const loadNodes = useCallback(async () => {
    if (!projectId) return;
    try { setNodes(await getGraphNodes(projectId)); setEdges(await getGraphEdges(projectId)); } catch { flash("Error"); }
  }, [projectId]);
  const loadDecisions = useCallback(async () => {
    if (!projectId) return;
    try { setDecisions(await listDecisions(projectId)); } catch { flash("Error"); }
  }, [projectId]);
  const loadDocs = useCallback(async () => {
    if (!projectId) return;
    try { setDocs(await listDocs(projectId)); } catch { flash("Error"); }
  }, [projectId]);
  const loadVersions = useCallback(async () => {
    if (!projectId) return;
    try { setVersions(await listVersions(projectId)); } catch { flash("Error"); }
  }, [projectId]);

  useEffect(() => {
    if (tab === "overview") loadProject();
    else if (tab === "knowledge") loadItems();
    else if (tab === "graph") loadNodes();
    else if (tab === "decisions") loadDecisions();
    else if (tab === "docs") loadDocs();
    else if (tab === "versions") loadVersions();
  }, [tab, loadProject, loadItems, loadNodes, loadDecisions, loadDocs, loadVersions]);

  const handleSaveProject = async () => {
    if (!projectId) return;
    try { await saveProjectKnowledge(projectId, project); flash("Project saved"); } catch { flash("Error"); }
  };

  const handleCreateItem = async () => {
    if (!projectId || !itemForm.key) return;
    try {
      let value = itemForm.value;
      try { value = JSON.parse(itemForm.value); } catch { /* keep as string */ }
      await createKnowledge(projectId, { key: itemForm.key, type: itemForm.type, summary: itemForm.summary, value, source: "manual", confidence: 5, owner: user?.email || "unknown", tags: [], verificationStatus: "verified" });
      flash("Created"); setShowItemForm(false); setItemForm({ key: "", type: "architecture", summary: "", value: "" }); loadItems();
    } catch { flash("Error"); }
  };

  const handleDeleteItem = async (key: string) => {
    if (!projectId) return;
    try { await deleteKnowledge(projectId, key); flash("Deleted"); loadItems(); } catch { flash("Error"); }
  };

  const handleCreateDecision = async () => {
    if (!projectId || !decisionForm.title) return;
    try {
      await createDecision(projectId, { title: decisionForm.title, context: decisionForm.context, decision: decisionForm.decision, reason: decisionForm.reason, alternatives: decisionForm.alternatives.split("\n").filter(Boolean), consequences: decisionForm.consequences.split("\n").filter(Boolean), tags: decisionForm.tags.split(",").map((t) => t.trim()).filter(Boolean), owner: user?.email || "unknown" });
      flash("Created"); setShowDecisionForm(false); setDecisionForm({ title: "", context: "", decision: "", reason: "", alternatives: "", consequences: "", tags: "" }); loadDecisions();
    } catch { flash("Error"); }
  };

  const handleCreateDoc = async () => {
    if (!projectId || !docForm.title) return;
    try { await createDoc(projectId, docForm); flash("Created"); setShowDocForm(false); setDocForm({ category: "architecture", title: "", content: "" }); loadDocs(); } catch { flash("Error"); }
  };

  const handleCreateNode = async () => {
    if (!projectId || !nodeForm.label) return;
    try {
      const properties = nodeForm.properties ? JSON.parse(nodeForm.properties) : {};
      await createGraphNode(projectId, { label: nodeForm.label, type: nodeForm.type, properties });
      flash("Created"); setShowNodeForm(false); setNodeForm({ label: "", type: "default", properties: "" }); loadNodes();
    } catch { flash("Error"); }
  };

  const handleCreateEdge = async () => {
    if (!projectId || !edgeForm.sourceId || !edgeForm.targetId) return;
    try { await createGraphEdge(projectId, edgeForm); flash("Created"); setShowEdgeForm(false); setEdgeForm({ sourceId: "", targetId: "", relation: "" }); loadNodes(); } catch { flash("Error"); }
  };

  const handleSearch = async () => {
    if (!projectId || !searchQuery) return;
    try { setSearchResults(await searchKnowledge(projectId, searchQuery)); } catch { flash("Error"); }
  };

  const handleBuildContext = async () => {
    if (!projectId) return;
    try { setContextResult(await buildContext(projectId)); flash("Context built"); } catch { flash("Error"); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3"><h1 className="text-[15px] font-bold text-text">Knowledge Core</h1></div>
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
            {(["overview", "knowledge", "graph", "decisions", "docs", "versions", "search"] as const).map((id) => {
              const labels: Record<string, string> = { overview: "📋 Overview", knowledge: "🧠 Knowledge", graph: "🔗 Graph", decisions: "⚖ Decisions", docs: "📄 Docs", versions: "🕐 Versions", search: "🔍 Search" };
              return (<button key={id} onClick={() => setTab(id)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors text-left ${tab === id ? "bg-accent/15 text-accent border border-accent/20" : "text-text-secondary hover:text-text hover:bg-surface-2 border border-transparent"}`}>{labels[id]}</button>);
            })}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* ── Overview ── */}
          {tab === "overview" && (
            <div className="space-y-4 max-w-2xl">
              <h2 className="text-[16px] font-bold text-text">Project Overview</h2>
              <div className="flex items-center gap-2"><button onClick={handleSaveProject} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Save</button><button onClick={handleBuildContext} className="text-[11px] px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text">Build AI Context</button></div>
              {contextResult && (
                <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-2">
                  <div className="flex items-center justify-between"><h4 className="text-[12px] font-semibold text-text">AI Context ({contextResult.tokens} tokens)</h4><button onClick={() => setContextResult(null)} className="text-[10px] text-text-muted hover:text-text">Close</button></div>
                  <pre className="text-[11px] text-text font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">{contextResult.context}</pre>
                </div>
              )}
              {(["name", "description", "architecture"].map((f) => (
                <div key={f}><label className="text-[11px] text-text-muted block mb-1 capitalize">{f}</label><input type="text" value={project[f] || ""} onChange={(e) => setProject((p: any) => ({ ...p, [f]: e.target.value }))} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
              )))}
              {(["frameworks", "languages", "modules", "services", "databaseSchema", "deploymentTargets", "projectGoals"].map((f) => (
                <div key={f}><label className="text-[11px] text-text-muted block mb-1 capitalize">{f.replace(/([A-Z])/g, " $1").trim()}</label><input type="text" value={(project[f] || []).join(", ")} onChange={(e) => setProject((p: any) => ({ ...p, [f]: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) }))} className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
              )))}
            </div>
          )}

          {/* ── Knowledge Items ── */}
          {tab === "knowledge" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="text-[16px] font-bold text-text">Knowledge Items ({items.length})</h2><button onClick={() => setShowItemForm(true)} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ Add</button></div>
              <div className="space-y-1.5">{items.map((item) => (
                <div key={item.key} className="flex items-start justify-between px-4 py-3 rounded-xl bg-surface-2 border border-border">
                  <div className="flex-1 min-w-0"><div className="text-[12px] font-medium text-text">{item.key}</div><div className="text-[10px] text-text-muted mt-0.5">{item.type} · {item.summary} · confidence: {item.confidence}/5 · {item.source}</div></div>
                  <button onClick={() => handleDeleteItem(item.key)} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 shrink-0">Delete</button>
                </div>
              ))}</div>
              {showItemForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-full max-w-md mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4">
                    <h4 className="text-[13px] font-bold">New Knowledge Item</h4>
                    <div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] text-text-muted block mb-1">Key</label><input type="text" value={itemForm.key} onChange={(e) => setItemForm((p) => ({ ...p, key: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none" /></div><div><label className="text-[11px] text-text-muted block mb-1">Type</label><select value={itemForm.type} onChange={(e) => setItemForm((p) => ({ ...p, type: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none"><option value="architecture">Architecture</option><option value="framework">Framework</option><option value="language">Language</option><option value="module">Module</option><option value="service">Service</option><option value="api_endpoint">API</option><option value="database_table">Database</option><option value="business_logic">Business Logic</option><option value="technical_decision">Decision</option><option value="coding_standard">Coding Standard</option><option value="environment_variable">Env Var</option></select></div></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Summary</label><input type="text" value={itemForm.summary} onChange={(e) => setItemForm((p) => ({ ...p, summary: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none" /></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Value (JSON or text)</label><textarea value={itemForm.value} onChange={(e) => setItemForm((p) => ({ ...p, value: e.target.value }))} rows={3} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[11px] text-text outline-none font-mono" /></div>
                    <div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => setShowItemForm(false)} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleCreateItem} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Create</button></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Graph ── */}
          {tab === "graph" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap"><h2 className="text-[16px] font-bold text-text mr-auto">Knowledge Graph</h2><button onClick={() => setShowNodeForm(true)} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ Node</button><button onClick={() => setShowEdgeForm(true)} className="text-[11px] px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text">+ Edge</button></div>
              <div className="text-[11px] text-text-muted mb-2">{nodes.length} nodes · {edges.length} edges</div>
              <div className="space-y-1.5">{nodes.map((n) => (
                <div key={n.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-2 border border-border">
                  <div><div className="text-[12px] font-medium text-text">{n.label}</div><div className="text-[10px] text-text-muted">{n.type} · {n.id.slice(0, 8)}</div></div>
                  <button onClick={() => deleteGraphNode(projectId!, n.id).then(loadNodes).catch(() => flash("Error"))} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">Delete</button>
                </div>
              ))}</div>
              {showNodeForm && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"><div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4"><h4 className="text-[13px] font-bold">New Node</h4><div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] text-text-muted block mb-1">Label</label><input type="text" value={nodeForm.label} onChange={(e) => setNodeForm((p) => ({ ...p, label: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none" /></div><div><label className="text-[11px] text-text-muted block mb-1">Type</label><input type="text" value={nodeForm.type} onChange={(e) => setNodeForm((p) => ({ ...p, type: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none" /></div></div><div><label className="text-[11px] text-text-muted block mb-1">Properties (JSON)</label><textarea value={nodeForm.properties} onChange={(e) => setNodeForm((p) => ({ ...p, properties: e.target.value }))} rows={3} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[11px] text-text outline-none font-mono" /></div><div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => setShowNodeForm(false)} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleCreateNode} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Create</button></div></div></div>)}
              {showEdgeForm && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"><div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4"><h4 className="text-[13px] font-bold">New Edge</h4><div><label className="text-[11px] text-text-muted block mb-1">Source Node ID</label><input type="text" value={edgeForm.sourceId} onChange={(e) => setEdgeForm((p) => ({ ...p, sourceId: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none" /></div><div><label className="text-[11px] text-text-muted block mb-1">Target Node ID</label><input type="text" value={edgeForm.targetId} onChange={(e) => setEdgeForm((p) => ({ ...p, targetId: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none" /></div><div><label className="text-[11px] text-text-muted block mb-1">Relation</label><input type="text" value={edgeForm.relation} onChange={(e) => setEdgeForm((p) => ({ ...p, relation: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none" /></div><div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => setShowEdgeForm(false)} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleCreateEdge} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Create</button></div></div></div>)}
            </div>
          )}

          {/* ── Decisions ── */}
          {tab === "decisions" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="text-[16px] font-bold text-text">Technical Decisions ({decisions.length})</h2><button onClick={() => setShowDecisionForm(true)} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ Record</button></div>
              <div className="space-y-2">{decisions.map((d) => (
                <div key={d.id} className="p-4 rounded-xl bg-surface-2 border border-border space-y-2">
                  <div className="flex items-center justify-between"><h4 className="text-[13px] font-bold text-text">{d.title}</h4><span className={`text-[10px] px-2 py-0.5 rounded-full ${d.status === "accepted" ? "bg-green-500/20 text-green-400" : d.status === "proposed" ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>{d.status}</span></div>
                  <div className="text-[11px] text-text-muted"><strong>Context:</strong> {d.context}</div><div className="text-[11px] text-text-muted"><strong>Decision:</strong> {d.decision}</div><div className="text-[11px] text-text-muted"><strong>Reason:</strong> {d.reason}</div>
                  {d.alternatives?.length > 0 && <div className="text-[11px] text-text-muted"><strong>Alternatives:</strong> {d.alternatives.join(", ")}</div>}
                  {d.tags?.length > 0 && <div className="flex gap-1 flex-wrap">{d.tags.map((t: string) => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted">{t}</span>)}</div>}
                  <button onClick={() => deleteDecision(projectId!, d.id).then(loadDecisions).catch(() => flash("Error"))} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">Delete</button>
                </div>
              ))}</div>
              {showDecisionForm && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"><div className="w-full max-w-lg mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto"><h4 className="text-[13px] font-bold">Record Decision</h4>
                {["title", "context", "decision", "reason"].map((f) => (<div key={f}><label className="text-[11px] text-text-muted block mb-1 capitalize">{f}</label><textarea value={(decisionForm as any)[f]} onChange={(e) => setDecisionForm((p) => ({ ...p, [f]: e.target.value }))} rows={f === "title" ? 1 : 2} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none" /></div>))}
                {["alternatives", "consequences"].map((f) => (<div key={f}><label className="text-[11px] text-text-muted block mb-1 capitalize">{f} (one per line)</label><textarea value={(decisionForm as any)[f]} onChange={(e) => setDecisionForm((p) => ({ ...p, [f]: e.target.value }))} rows={2} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none" /></div>))}
                <div><label className="text-[11px] text-text-muted block mb-1">Tags (comma separated)</label><input type="text" value={decisionForm.tags} onChange={(e) => setDecisionForm((p) => ({ ...p, tags: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none" /></div>
                <div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => setShowDecisionForm(false)} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleCreateDecision} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Save</button></div></div></div>)}
            </div>
          )}

          {/* ── Documentation ── */}
          {tab === "docs" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="text-[16px] font-bold text-text">Documentation ({docs.length})</h2><button onClick={() => setShowDocForm(true)} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ New Doc</button></div>
              <div className="space-y-1.5">{docs.length === 0 && <div className="text-[12px] text-text-muted px-4 py-8 text-center">No documentation yet.</div>}
                {docs.map((d) => (<div key={d.id} className="p-4 rounded-xl bg-surface-2 border border-border"><div className="flex items-center justify-between mb-1"><h4 className="text-[12px] font-semibold text-text">{d.title}</h4><span className="text-[10px] text-text-muted">{d.category}</span></div><pre className="text-[11px] text-text font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">{d.content.substring(0, 500)}</pre><button onClick={() => deleteDoc(projectId!, d.id).then(loadDocs).catch(() => flash("Error"))} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 mt-2">Delete</button></div>))}
              </div>
              {showDocForm && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"><div className="w-full max-w-lg mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4"><h4 className="text-[13px] font-bold">New Document</h4>
                <div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] text-text-muted block mb-1">Category</label><select value={docForm.category} onChange={(e) => setDocForm((p) => ({ ...p, category: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none"><option value="architecture">Architecture</option><option value="api">API</option><option value="modules">Modules</option><option value="deployment">Deployment</option><option value="onboarding">Onboarding</option><option value="handbook">Handbook</option><option value="glossary">Glossary</option></select></div><div><label className="text-[11px] text-text-muted block mb-1">Title</label><input type="text" value={docForm.title} onChange={(e) => setDocForm((p) => ({ ...p, title: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none" /></div></div>
                <div><label className="text-[11px] text-text-muted block mb-1">Content (Markdown)</label><textarea value={docForm.content} onChange={(e) => setDocForm((p) => ({ ...p, content: e.target.value }))} rows={8} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[11px] text-text outline-none font-mono" /></div>
                <div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => setShowDocForm(false)} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleCreateDoc} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Save</button></div></div></div>)}
            </div>
          )}

          {/* ── Versions ── */}
          {tab === "versions" && (
            <div className="space-y-3">
              <h2 className="text-[16px] font-bold text-text">Version Timeline ({versions.length})</h2>
              <div className="relative pl-6 space-y-4">{versions.map((v, i) => (
                <div key={v.id} className="relative pb-4">
                  {i < versions.length - 1 && <div className="absolute left-0 top-3 bottom-0 w-px bg-border" />}
                  <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-accent border-2 border-bg" />
                  <div className="text-[11px] text-text-muted font-mono mb-1">v{v.version} · {new Date(v.createdAt).toLocaleDateString()}</div>
                  <div className="text-[12px] font-medium text-text">{v.label}</div>
                  <div className="flex gap-2 mt-1 flex-wrap">{v.changes?.map((c: any, ci: number) => <span key={ci} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-3 text-text-muted">{c.type}: {c.description}</span>)}</div>
                  {v.knowledgeDelta && <div className="text-[10px] text-text-muted mt-1">+{v.knowledgeDelta.added.length} · -{v.knowledgeDelta.removed.length} · ~{v.knowledgeDelta.modified.length}</div>}
                </div>
              ))}</div>
            </div>
          )}

          {/* ── Search ── */}
          {tab === "search" && (
            <div className="space-y-4">
              <h2 className="text-[16px] font-bold text-text">Semantic Search</h2>
              <div className="flex items-center gap-2"><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Search by meaning..." className="flex-1 max-w-md px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /><button onClick={handleSearch} className="px-3 py-2 rounded-lg bg-accent text-white text-[11px] hover:bg-accent-light">Search</button></div>
              <div className="space-y-1.5">{searchResults.map((r, i) => (
                <div key={i} className="p-3 rounded-xl bg-surface-2 border border-border">
                  <div className="flex items-center gap-2"><span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted">{r.type}</span><span className="text-[12px] font-medium text-text">{r.item?.key || r.item?.title || "Unknown"}</span><span className="text-[10px] text-text-muted ml-auto">{(r.score * 100).toFixed(0)}%</span></div>
                  <div className="text-[11px] text-text-muted mt-1">{r.item?.summary || r.item?.decision || r.item?.content?.substring(0, 200) || ""}</div>
                </div>
              ))}</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
