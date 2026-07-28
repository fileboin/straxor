import { useState, useCallback, useEffect } from "react";
import {
  listFrameworks, listRoles, listInstances, createInstance, deleteInstance,
  listTasks, createTask, assignTask, updateTaskStatus, completeTask,
  listWorkflows, createWorkflow, deleteWorkflow,
  getStats,
  type AgentFramework, type AgentRoleDef, type AgentInstance, type AgentTask,
  type WorkflowDefinition, type MultiAgentStats,
  ROLE_COLORS, ROLE_BG, STATUS_COLORS, PRIORITY_COLORS,
} from "../../lib/multi-agent.js";

interface Props {
  onClose: () => void;
}

type Tab = "frameworks" | "agents" | "tasks" | "workflows" | "stats";

export default function MultiAgentPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("frameworks");
  const [frameworks, setFrameworks] = useState<AgentFramework[]>([]);
  const [roles, setRoles] = useState<AgentRoleDef[]>([]);
  const [agents, setAgents] = useState<AgentInstance[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [stats, setStats] = useState<MultiAgentStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Create agent form
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [newFramework, setNewFramework] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newName, setNewName] = useState("");

  // Create task form
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskRole, setTaskRole] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskInput, setTaskInput] = useState("");

  // Create workflow form
  const [showCreateWorkflow, setShowCreateWorkflow] = useState(false);
  const [wfName, setWfName] = useState("");
  const [wfDesc, setWfDesc] = useState("");
  const [wfSteps, setWfSteps] = useState<{ role: string; instruction: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fw, rl, ag, tk, wf, st] = await Promise.all([
        listFrameworks(), listRoles(), listInstances(),
        listTasks(), listWorkflows(), getStats(),
      ]);
      setFrameworks(fw);
      setRoles(rl);
      setAgents(ag);
      setTasks(tk);
      setWorkflows(wf);
      setStats(st);
    } catch { /* ok */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Create agent ──
  const handleCreateAgent = useCallback(async () => {
    if (!newFramework || !newRole) return;
    try {
      await createInstance(newFramework, newRole, newName || undefined);
      setShowCreateAgent(false);
      setNewFramework("");
      setNewRole("");
      setNewName("");
      load();
    } catch { /* ok */ }
  }, [newFramework, newRole, newName, load]);

  // ── Delete agent ──
  const handleDeleteAgent = useCallback(async (id: string) => {
    await deleteInstance(id);
    load();
  }, [load]);

  // ── Create task ──
  const handleCreateTask = useCallback(async () => {
    if (!taskTitle || !taskRole) return;
    try {
      await createTask({ title: taskTitle, description: taskDesc, role: taskRole, priority: taskPriority, input: taskInput });
      setShowCreateTask(false);
      setTaskTitle("");
      setTaskDesc("");
      setTaskRole("");
      setTaskInput("");
      load();
    } catch { /* ok */ }
  }, [taskTitle, taskDesc, taskRole, taskPriority, taskInput, load]);

  // ── Assign task ──
  const handleAssign = useCallback(async (taskId: string) => {
    await assignTask(taskId);
    load();
  }, [load]);

  // ── Complete task ──
  const handleComplete = useCallback(async (taskId: string) => {
    await completeTask(taskId, "Task completed by agent");
    load();
  }, [load]);

  // ── Fail task ──
  const handleFail = useCallback(async (taskId: string) => {
    await updateTaskStatus(taskId, "failed", undefined, "Task failed");
    load();
  }, [load]);

  // ── Create workflow ──
  const handleCreateWorkflow = useCallback(async () => {
    if (!wfName || wfSteps.length === 0) return;
    try {
      await createWorkflow({ name: wfName, description: wfDesc, steps: wfSteps.map((s) => ({ role: s.role, instruction: s.instruction })) });
      setShowCreateWorkflow(false);
      setWfName("");
      setWfDesc("");
      setWfSteps([]);
      load();
    } catch { /* ok */ }
  }, [wfName, wfDesc, wfSteps, load]);

  // ── Delete workflow ──
  const handleDeleteWorkflow = useCallback(async (id: string) => {
    await deleteWorkflow(id);
    load();
  }, [load]);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "frameworks", label: "Frameworki", icon: "🧩" },
    { id: "agents", label: "Agenti", icon: "🤖" },
    { id: "tasks", label: "Zadaci", icon: "📋" },
    { id: "workflows", label: "Workflows", icon: "🔄" },
    { id: "stats", label: "Statistika", icon: "📊" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">🤖</span>
            <span className="text-[13px] font-semibold text-text">Multi-Agent Sistem</span>
            {stats && (
              <span className="text-[10px] text-text-muted bg-surface-3 px-1.5 py-0.5 rounded">
                {stats.totalInstances} agenata · {stats.totalTasks} zadataka
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={load} className="text-[11px] text-text-muted hover:text-text px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors">↻</button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">✕</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[70px] py-2 text-[11px] font-medium transition-colors whitespace-nowrap ${
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
          ) : tab === "frameworks" ? (
            <div className="p-3 space-y-2">
              {frameworks.map((fw) => (
                <div key={fw.id} className="p-3 rounded-xl border border-border bg-surface-2/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{fw.icon}</span>
                      <div>
                        <span className="text-[12px] font-medium text-text">{fw.name}</span>
                        <span className="text-[9px] text-text-muted bg-surface-3 px-1.5 py-0.5 rounded ml-2">{fw.language}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-text-muted">
                      {agents.filter((a) => a.frameworkId === fw.id).length} instanci
                    </span>
                  </div>
                  <p className="text-[10px] text-text-secondary mb-2">{fw.description}</p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {fw.features.map((f) => (
                      <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted">{f}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-text-muted">Uloge:</span>
                    {fw.rolesSupported.map((r) => (
                      <span key={r} className={`text-[9px] px-1.5 py-0.5 rounded ${ROLE_BG[r as keyof typeof ROLE_BG]} ${ROLE_COLORS[r as keyof typeof ROLE_COLORS]}`}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : tab === "agents" ? (
            <div className="p-3 space-y-2">
              {agents.map((ag) => {
                const fw = frameworks.find((f) => f.id === ag.frameworkId);
                const role = roles.find((r) => r.id === ag.role);
                return (
                  <div key={ag.id} className="p-3 rounded-xl border border-border bg-surface-2/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm">{fw?.icon || "🤖"}</span>
                        <div className="min-w-0">
                          <div className="text-[12px] font-medium text-text truncate">{ag.name}</div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] px-1 py-0.5 rounded ${ROLE_BG[ag.role]} ${ROLE_COLORS[ag.role]}`}>{role?.icon} {role?.name}</span>
                            <span className="text-[9px] text-text-muted">{fw?.name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                          ag.status === "idle" ? "bg-green-500/10 text-green-400" :
                          ag.status === "working" ? "bg-accent/10 text-accent" :
                          ag.status === "error" ? "bg-red-500/10 text-red-400" :
                          "bg-surface-3 text-text-muted"
                        }`}>{ag.status}</span>
                        <button onClick={() => handleDeleteAgent(ag.id)} className="text-[10px] text-red-400 hover:text-red-300 px-1 rounded">🗑</button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Create agent form */}
              {showCreateAgent ? (
                <div className="p-3 rounded-xl border border-accent/30 bg-accent/5 space-y-2">
                  <div className="text-[11px] font-medium text-text">Novi agent</div>
                  <select value={newFramework} onChange={(e) => setNewFramework(e.target.value)} className="w-full bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text">
                    <option value="">Framework...</option>
                    {frameworks.map((f) => <option key={f.id} value={f.id}>{f.icon} {f.name}</option>)}
                  </select>
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="w-full bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text">
                    <option value="">Uloga...</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
                  </select>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ime (opcionalno)" className="w-full bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text" />
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => setShowCreateAgent(false)} className="text-[10px] text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-2 transition-colors">Odustani</button>
                    <button onClick={handleCreateAgent} disabled={!newFramework || !newRole} className="text-[10px] text-white bg-accent hover:bg-accent-light px-2 py-1 rounded transition-colors disabled:opacity-40">Kreiraj</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowCreateAgent(true)} className="w-full p-2 rounded-xl border border-dashed border-border hover:border-accent/50 text-[11px] text-text-muted hover:text-accent transition-colors">
                  + Dodaj agenta
                </button>
              )}
            </div>
          ) : tab === "tasks" ? (
            <div className="p-3 space-y-2">
              {tasks.map((tk) => {
                const role = roles.find((r) => r.id === tk.role);
                return (
                  <div key={tk.id} className="p-3 rounded-xl border border-border bg-surface-2/30">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-[10px] font-medium ${STATUS_COLORS[tk.status]}`}>{STATUS_COLORS[tk.status] ? "●" : "○"}</span>
                        <span className="text-[12px] font-medium text-text truncate">{tk.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[9px] px-1 py-0.5 rounded ${ROLE_BG[tk.role]} ${ROLE_COLORS[tk.role]}`}>{role?.icon}</span>
                        <span className={`text-[9px] px-1 py-0.5 rounded bg-surface-3 ${PRIORITY_COLORS[tk.priority]}`}>{tk.priority}</span>
                      </div>
                    </div>
                    {tk.description && <p className="text-[10px] text-text-muted mb-1.5">{tk.description}</p>}
                    <div className="flex items-center gap-1.5 text-[9px] text-text-muted">
                      <span>Status: {tk.status}</span>
                      {tk.output && <span className="text-green-400">✓ Output</span>}
                      {tk.error && <span className="text-red-400">✕ Error</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      {tk.status === "pending" && (
                        <button onClick={() => handleAssign(tk.id)} className="text-[9px] text-accent hover:text-accent-light px-2 py-0.5 rounded bg-accent/10 transition-colors">Assign</button>
                      )}
                      {(tk.status === "assigned" || tk.status === "running") && (
                        <>
                          <button onClick={() => handleComplete(tk.id)} className="text-[9px] text-green-400 hover:text-green-300 px-2 py-0.5 rounded bg-green-500/10 transition-colors">Complete</button>
                          <button onClick={() => handleFail(tk.id)} className="text-[9px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded bg-red-500/10 transition-colors">Fail</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {showCreateTask ? (
                <div className="p-3 rounded-xl border border-accent/30 bg-accent/5 space-y-2">
                  <div className="text-[11px] font-medium text-text">Novi zadatak</div>
                  <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Naslov zadatka" className="w-full bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text" />
                  <input value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Opis (opcionalno)" className="w-full bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text" />
                  <div className="flex gap-2">
                    <select value={taskRole} onChange={(e) => setTaskRole(e.target.value)} className="flex-1 bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text">
                      <option value="">Uloga...</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
                    </select>
                    <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-24 bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <textarea value={taskInput} onChange={(e) => setTaskInput(e.target.value)} placeholder="Input za agenta..." rows={2} className="w-full bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text resize-none" />
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => setShowCreateTask(false)} className="text-[10px] text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-2 transition-colors">Odustani</button>
                    <button onClick={handleCreateTask} disabled={!taskTitle || !taskRole} className="text-[10px] text-white bg-accent hover:bg-accent-light px-2 py-1 rounded transition-colors disabled:opacity-40">Kreiraj</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowCreateTask(true)} className="w-full p-2 rounded-xl border border-dashed border-border hover:border-accent/50 text-[11px] text-text-muted hover:text-accent transition-colors">
                  + Novi zadatak
                </button>
              )}
            </div>
          ) : tab === "workflows" ? (
            <div className="p-3 space-y-2">
              {workflows.map((wf) => (
                <div key={wf.id} className="p-3 rounded-xl border border-border bg-surface-2/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-text">{wf.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        wf.status === "completed" ? "bg-green-500/10 text-green-400" :
                        wf.status === "running" ? "bg-accent/10 text-accent" :
                        "bg-surface-3 text-text-muted"
                      }`}>{wf.status}</span>
                      <button onClick={() => handleDeleteWorkflow(wf.id)} className="text-[10px] text-red-400 hover:text-red-300 px-1 rounded">🗑</button>
                    </div>
                  </div>
                  {wf.description && <p className="text-[10px] text-text-muted mb-1.5">{wf.description}</p>}
                  <div className="flex items-center gap-1 text-[9px] text-text-muted">
                    <span>{wf.steps.length} koraka</span>
                    {wf.steps.map((s, i) => {
                      const roleDef = roles.find((r) => r.id === s.role);
                      return (
                        <span key={i} className={`px-1 py-0.5 rounded ${ROLE_BG[s.role]} ${ROLE_COLORS[s.role]}`}>
                          {roleDef?.icon || "?"}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}

              {showCreateWorkflow ? (
                <div className="p-3 rounded-xl border border-accent/30 bg-accent/5 space-y-2">
                  <div className="text-[11px] font-medium text-text">Novi workflow</div>
                  <input value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="Ime workflow-a" className="w-full bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text" />
                  <input value={wfDesc} onChange={(e) => setWfDesc(e.target.value)} placeholder="Opis (opcionalno)" className="w-full bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text" />
                  <div className="space-y-1.5">
                    {wfSteps.map((step, i) => (
                      <div key={i} className="flex gap-1.5">
                        <select value={step.role} onChange={(e) => {
                          const next = [...wfSteps];
                          next[i] = { ...next[i], role: e.target.value };
                          setWfSteps(next);
                        }} className="w-32 bg-surface-3 border border-border rounded px-1.5 py-1 text-[10px] text-text">
                          <option value="">Uloga...</option>
                          {roles.map((r) => <option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}
                        </select>
                        <input value={step.instruction} onChange={(e) => {
                          const next = [...wfSteps];
                          next[i] = { ...next[i], instruction: e.target.value };
                          setWfSteps(next);
                        }} placeholder="Instrukcija..." className="flex-1 bg-surface-3 border border-border rounded px-1.5 py-1 text-[10px] text-text" />
                        <button onClick={() => setWfSteps((prev) => prev.filter((_, j) => j !== i))} className="text-[10px] text-red-400 hover:text-red-300 px-1">✕</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setWfSteps((prev) => [...prev, { role: "", instruction: "" }])} className="text-[10px] text-accent hover:text-accent-light transition-colors">+ Dodaj korak</button>
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => { setShowCreateWorkflow(false); setWfSteps([]); }} className="text-[10px] text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-2 transition-colors">Odustani</button>
                    <button onClick={handleCreateWorkflow} disabled={!wfName || wfSteps.length === 0} className="text-[10px] text-white bg-accent hover:bg-accent-light px-2 py-1 rounded transition-colors disabled:opacity-40">Kreiraj</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowCreateWorkflow(true)} className="w-full p-2 rounded-xl border border-dashed border-border hover:border-accent/50 text-[11px] text-text-muted hover:text-accent transition-colors">
                  + Novi workflow
                </button>
              )}
            </div>
          ) : (
            /* Stats tab */
            <div className="p-3 space-y-3">
              {stats && (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                      <div className="text-[18px] font-bold text-text">{stats.totalInstances}</div>
                      <div className="text-[10px] text-text-muted">Agenata</div>
                    </div>
                    <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                      <div className="text-[18px] font-bold text-accent">{stats.totalTasks}</div>
                      <div className="text-[10px] text-text-muted">Zadataka</div>
                    </div>
                    <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                      <div className="text-[18px] font-bold text-green-400">{stats.completedTasks}</div>
                      <div className="text-[10px] text-text-muted">Završeno</div>
                    </div>
                    <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                      <div className="text-[18px] font-bold text-yellow-400">{stats.totalWorkflows}</div>
                      <div className="text-[10px] text-text-muted">Workflows</div>
                    </div>
                  </div>

                  <div className="text-[11px] font-medium text-text mt-3">Po ulozi</div>
                  <div className="space-y-1.5">
                    {stats.roleBreakdown.map((rb) => (
                      <div key={rb.role} className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-surface-2/20">
                        <div className="flex items-center gap-2">
                          <span>{rb.icon}</span>
                          <span className="text-[11px] text-text-secondary">{rb.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-text-muted">
                          <span>{rb.instances} agenata</span>
                          <span>{rb.tasks} zadataka</span>
                          <span className="text-green-400">{rb.completed} ✓</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[11px] font-medium text-text mt-3">Po framework-u</div>
                  <div className="space-y-1.5">
                    {stats.frameworkBreakdown.map((fb) => (
                      <div key={fb.framework} className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-surface-2/20">
                        <div className="flex items-center gap-2">
                          <span>{fb.icon}</span>
                          <span className="text-[11px] text-text-secondary">{fb.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-text-muted">
                          <span>{fb.instances} instanci</span>
                          <span>{fb.tasks} zadataka</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {(stats.totalTokens > 0 || stats.totalCostUSD > 0) && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                        <div className="text-[14px] font-bold text-accent">{stats.totalTokens.toLocaleString()}</div>
                        <div className="text-[10px] text-text-muted">Tokeni</div>
                      </div>
                      <div className="p-2 rounded-xl border border-border bg-surface-2/30 text-center">
                        <div className="text-[14px] font-bold text-green-400">${stats.totalCostUSD.toFixed(2)}</div>
                        <div className="text-[10px] text-text-muted">Troškovi</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
