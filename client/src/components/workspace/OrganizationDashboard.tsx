import { useState, useEffect, useCallback } from "react";
import {
  listOrganizations,
  createOrganization,
  getOrganization,
  addOrgMember,
  removeOrgMember,
  listOrgApiKeys,
  addOrgApiKey,
  deleteOrgApiKey,
  listOrgPolicies,
  addOrgPolicy,
  updateOrgPolicy,
  deleteOrgPolicy,
  listOrgBudgets,
  addOrgBudget,
  deleteOrgBudget,
  getOrgUsage,
  type Organization,
  type OrgDetail,
  type OrgUsage,
} from "../../lib/organization";

interface Props {
  onClose: () => void;
}

type Tab = "overview" | "members" | "keys" | "policies" | "budget";

const POLICY_TYPES = [
  { id: "security", label: "Security", icon: "🔒" },
  { id: "usage", label: "Usage", icon: "📊" },
  { id: "access", label: "Access", icon: "🔑" },
  { id: "compliance", label: "Compliance", icon: "📋" },
];

const PROVIDERS = ["anthropic", "openai", "google", "deepseek", "openrouter", "groq", "together"];

export default function OrganizationDashboard({ onClose }: Props) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selected, setSelected] = useState<OrgDetail | null>(null);
  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const o = await listOrganizations();
      setOrgs(o);
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  }, []);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  };

  const selectOrg = async (id: string) => {
    try {
      const [detail, u] = await Promise.all([getOrganization(id), getOrgUsage(id)]);
      setSelected(detail);
      setUsage(u);
    } catch (err: any) { flash(err.message); }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const org = await createOrganization(newName.trim());
      setOrgs((prev) => [...prev, org]);
      setNewName("");
      setShowCreate(false);
      flash("Kreirano");
    } catch (err: any) { flash(err.message); }
  };

  const canManage = selected?.userRole === "owner" || selected?.userRole === "admin";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-lg">🏢</span>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-text">Organization Dashboard</h1>
              <p className="text-[10px] text-text-muted">{orgs.length} organizacija</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {actionMsg && <span className="text-[10px] text-accent px-2 py-1 rounded bg-accent/10">{actionMsg}</span>}
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 text-[11px] text-white bg-accent hover:bg-accent-light px-3 py-1.5 rounded-lg transition-colors">
              + Nova org
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">✕</button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Org list sidebar */}
          <div className="w-56 border-r border-border overflow-y-auto shrink-0 bg-surface-2/30">
            {loading ? (
              <div className="text-[11px] text-text-muted text-center py-8">Učitavanje...</div>
            ) : error ? (
              <div className="text-[11px] text-red-400 text-center py-8">{error}</div>
            ) : orgs.length === 0 ? (
              <div className="text-[11px] text-text-muted text-center py-8">
                <span className="text-2xl block mb-2">🏢</span>Nema organizacija
              </div>
            ) : (
              orgs.map((org) => (
                <button key={org.id} onClick={() => { selectOrg(org.id); setTab("overview"); }}
                  className={`w-full text-left px-4 py-3 border-b border-border/50 transition-colors ${
                    selected?.id === org.id ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-surface-2 border-l-2 border-l-transparent"
                  }`}>
                  <div className="text-[12px] font-semibold text-text">{org.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      org.plan === "enterprise" ? "bg-purple-500/10 text-purple-400" :
                      org.plan === "pro" ? "bg-accent/10 text-accent" :
                      "bg-surface-3 text-text-muted"
                    }`}>{org.plan}</span>
                    <span className="text-[9px] text-text-muted">{org.role}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 flex flex-col min-h-0">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center text-[11px] text-text-muted">
                <span className="text-3xl block mb-2">🏢</span>Izaberi organizaciju
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex items-center gap-1 px-5 py-2 border-b border-border/50 bg-surface-2/20 shrink-0 overflow-x-auto">
                  {(["overview", "members", "keys", "policies", "budget"] as Tab[]).map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        tab === t ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-secondary"
                      }`}>
                      {t === "overview" ? "📊 Pregled" : t === "members" ? "👥 Članovi" : t === "keys" ? "🔑 API Keys" : t === "policies" ? "📋 Politike" : "💰 Budžet"}
                    </button>
                  ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                  {tab === "overview" && <OverviewTab org={selected} usage={usage} />}
                  {tab === "members" && <MembersTab org={selected} canManage={canManage} onAction={flash} onRefresh={() => selectOrg(selected.id)} />}
                  {tab === "keys" && <ApiKeysTab orgId={selected.id} canManage={canManage} onAction={flash} />}
                  {tab === "policies" && <PoliciesTab orgId={selected.id} canManage={canManage} onAction={flash} />}
                  {tab === "budget" && <BudgetTab orgId={selected.id} canManage={canManage} onAction={flash} />}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[13px] font-semibold text-text mb-3">Nova organizacija</h2>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Naziv" className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-[12px] text-text focus:outline-none focus:border-accent/50 mb-3" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="text-[11px] text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-surface-2">Otkaži</button>
              <button onClick={handleCreate} disabled={!newName.trim()} className="text-[11px] text-white bg-accent hover:bg-accent-light disabled:opacity-40 px-4 py-1.5 rounded-lg transition-colors">Kreiraj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tabs ──

function OverviewTab({ org, usage }: { org: OrgDetail; usage: OrgUsage | null }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-text">{org.name}</h2>
          <p className="text-[10px] text-text-muted">{org.plan} plan · {org.members.length} članova</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded font-medium ${
          org.plan === "enterprise" ? "bg-purple-500/10 text-purple-400" :
          org.plan === "pro" ? "bg-accent/10 text-accent" :
          "bg-surface-3 text-text-muted"
        }`}>{org.plan}</span>
      </div>

      {org.billingEmail && (
        <div className="text-[11px] text-text-secondary bg-surface-2/50 border border-border/50 rounded-xl px-4 py-2.5">
          💳 Billing: {org.billingEmail}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon="👥" label="Članovi" value={String(org.members.length)} />
        <StatCard icon="🔑" label="API Keys" value={String(org.apiKeys.length)} />
        <StatCard icon="📋" label="Politike" value={String(org.policies.length)} />
        <StatCard icon="💰" label="Budžeti" value={String(org.budgets.length)} />
      </div>

      {/* Usage */}
      {usage && (
        <div className="bg-surface-2/50 border border-border/50 rounded-xl p-4">
          <h3 className="text-[12px] font-semibold text-text mb-3">📊 Korištenje</h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                <span>Mjesečni budžet</span>
                <span>${usage.totalCurrentUsage} / ${usage.totalMonthlyBudget}</span>
              </div>
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${
                  usage.usagePercent > 90 ? "bg-red-500" : usage.usagePercent > 70 ? "bg-yellow-500" : "bg-green-500"
                }`} style={{ width: `${Math.min(usage.usagePercent, 100)}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-text-muted">
              <span>🔑 Providera: {usage.providerCount}</span>
              <span>📦 Key-eva: {usage.apiKeyCount}</span>
              <span>📊 Budžeta: {usage.budgetCount}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3 text-center">
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-[18px] font-bold text-text">{value}</div>
      <div className="text-[9px] text-text-muted">{label}</div>
    </div>
  );
}

function MembersTab({ org, canManage, onAction, onRefresh }: { org: OrgDetail; canManage: boolean; onAction: (m: string) => void; onRefresh: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  const handleInvite = async () => {
    if (!email.trim()) return;
    try {
      await addOrgMember(org.id, email.trim(), role);
      setEmail("");
      onAction("Dodato");
      onRefresh();
    } catch (err: any) { onAction(err.message); }
  };

  const handleRemove = async (memberId: string) => {
    try {
      await removeOrgMember(org.id, memberId);
      onAction("Uklonjeno");
      onRefresh();
    } catch (err: any) { onAction(err.message); }
  };

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex items-center gap-2 bg-surface-2/50 border border-border/50 rounded-xl p-3">
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className="flex-1 bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50" />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text focus:outline-none">
            <option value="member">member</option><option value="admin">admin</option><option value="viewer">viewer</option>
          </select>
          <button onClick={handleInvite} disabled={!email.trim()} className="text-[11px] text-white bg-accent hover:bg-accent-light disabled:opacity-40 px-3 py-1.5 rounded-lg">Pozovi</button>
        </div>
      )}
      {org.members.map((m) => (
        <div key={m.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-bold text-accent">{m.email.charAt(0).toUpperCase()}</div>
            <div>
              <div className="text-[11px] text-text">{m.email}</div>
              <span className="text-[9px] text-text-muted">{m.role}</span>
            </div>
          </div>
          {canManage && m.userId !== org.ownerId && (
            <button onClick={() => handleRemove(m.id)} className="text-[9px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10">Ukloni</button>
          )}
        </div>
      ))}
    </div>
  );
}

function ApiKeysTab({ orgId, canManage, onAction }: { orgId: string; canManage: boolean; onAction: (m: string) => void }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState("anthropic");
  const [label, setLabel] = useState("");
  const [keyValue, setKeyValue] = useState("");

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const k = await listOrgApiKeys(orgId);
      setKeys(k);
    } catch {}
    setLoading(false);
  }, [orgId]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const handleAdd = async () => {
    if (!keyValue.trim()) return;
    try {
      await addOrgApiKey(orgId, provider, keyValue.trim(), label.trim() || undefined);
      setKeyValue("");
      setLabel("");
      onAction("Dodat");
      loadKeys();
    } catch (err: any) { onAction(err.message); }
  };

  const handleDelete = async (keyId: string) => {
    try {
      await deleteOrgApiKey(orgId, keyId);
      onAction("Obrisano");
      loadKeys();
    } catch (err: any) { onAction(err.message); }
  };

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="bg-surface-2/50 border border-border/50 rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className="bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text focus:outline-none">
              {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text focus:outline-none" />
            <input type="password" value={keyValue} onChange={(e) => setKeyValue(e.target.value)} placeholder="sk-..." className="bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-[11px] text-text font-mono focus:outline-none" />
          </div>
          <button onClick={handleAdd} disabled={!keyValue.trim()} className="text-[11px] text-white bg-accent hover:bg-accent-light disabled:opacity-40 px-3 py-1 rounded-lg">Sačuvaj</button>
        </div>
      )}
      {loading ? (
        <div className="text-[11px] text-text-muted text-center py-4">Učitavanje...</div>
      ) : keys.length === 0 ? (
        <div className="text-[11px] text-text-muted text-center py-4">Nema API key-eva</div>
      ) : (
        keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2">
            <div>
              <span className="text-[11px] font-medium text-text">{k.provider}</span>
              {k.label && <span className="text-[10px] text-text-muted ml-2">· {k.label}</span>}
              <div className="text-[9px] text-text-muted/60 font-mono">••••{k.encryptedKey.slice(-8)}</div>
            </div>
            {canManage && (
              <button onClick={() => handleDelete(k.id)} className="text-[9px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10">Obriši</button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function PoliciesTab({ orgId, canManage, onAction }: { orgId: string; canManage: boolean; onAction: (m: string) => void }) {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState("security");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const p = await listOrgPolicies(orgId);
      setPolicies(p);
    } catch {}
    setLoading(false);
  }, [orgId]);

  useEffect(() => { loadPolicies(); }, [loadPolicies]);

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await addOrgPolicy(orgId, { type, name: name.trim(), description: desc.trim() || undefined });
      setName(""); setDesc("");
      setShowAdd(false);
      onAction("Dodato");
      loadPolicies();
    } catch (err: any) { onAction(err.message); }
  };

  const handleToggle = async (policyId: string, current: boolean) => {
    try {
      await updateOrgPolicy(orgId, policyId, { isEnabled: !current });
      loadPolicies();
    } catch (err: any) { onAction(err.message); }
  };

  const handleDelete = async (policyId: string) => {
    try {
      await deleteOrgPolicy(orgId, policyId);
      onAction("Obrisano");
      loadPolicies();
    } catch (err: any) { onAction(err.message); }
  };

  const typeMeta = (t: string) => POLICY_TYPES.find((pt) => pt.id === t) || { id: t, label: t, icon: "📋" };

  return (
    <div className="space-y-3">
      {canManage && (
        <button onClick={() => setShowAdd(true)} className="text-[11px] text-white bg-accent hover:bg-accent-light px-3 py-1.5 rounded-lg transition-colors">+ Nova politika</button>
      )}

      {loading ? (
        <div className="text-[11px] text-text-muted text-center py-4">Učitavanje...</div>
      ) : policies.length === 0 ? (
        <div className="text-[11px] text-text-muted text-center py-4">Nema politika</div>
      ) : (
        policies.map((p) => {
          const meta = typeMeta(p.type);
          return (
            <div key={p.id} className="flex items-center justify-between bg-surface border border-border rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span>{meta.icon}</span>
                <div>
                  <div className="text-[11px] font-medium text-text">{p.name}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-text-muted">{meta.label}</span>
                    {p.description && <span className="text-[9px] text-text-muted/60 truncate max-w-[200px]">{p.description}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManage && (
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={p.isEnabled} onChange={() => handleToggle(p.id, p.isEnabled)} className="sr-only peer" />
                    <div className="w-7 h-4 bg-surface-3 rounded-full peer peer-checked:bg-accent after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3" />
                  </label>
                )}
                {canManage && (
                  <button onClick={() => handleDelete(p.id)} className="text-[9px] text-red-400 hover:text-red-300 px-2 py-0.5 rounded hover:bg-red-500/10">🗑</button>
                )}
              </div>
            </div>
          );
        })
      )}

      {showAdd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[12px] font-semibold text-text mb-3">Nova politika</h3>
            <div className="space-y-2">
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[11px] text-text focus:outline-none">
                {POLICY_TYPES.map((pt) => <option key={pt.id} value={pt.id}>{pt.icon} {pt.label}</option>)}
              </select>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Naziv" className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[11px] text-text focus:outline-none" />
              <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Opis (opciono)" className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[11px] text-text focus:outline-none" />
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button onClick={() => setShowAdd(false)} className="text-[10px] text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-2">Otkaži</button>
              <button onClick={handleAdd} disabled={!name.trim()} className="text-[10px] text-white bg-accent hover:bg-accent-light disabled:opacity-40 px-3 py-1 rounded-lg">Dodaj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetTab({ orgId, canManage, onAction }: { orgId: string; canManage: boolean; onAction: (m: string) => void }) {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [monthlyLimit, setMonthlyLimit] = useState(100);

  const loadBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const b = await listOrgBudgets(orgId);
      setBudgets(b);
    } catch {}
    setLoading(false);
  }, [orgId]);

  useEffect(() => { loadBudgets(); }, [loadBudgets]);

  const handleAdd = async () => {
    try {
      await addOrgBudget(orgId, { monthlyLimit });
      setShowAdd(false);
      onAction("Dodato");
      loadBudgets();
    } catch (err: any) { onAction(err.message); }
  };

  const handleDelete = async (budgetId: string) => {
    try {
      await deleteOrgBudget(orgId, budgetId);
      onAction("Obrisano");
      loadBudgets();
    } catch (err: any) { onAction(err.message); }
  };

  return (
    <div className="space-y-3">
      {canManage && (
        <button onClick={() => setShowAdd(true)} className="text-[11px] text-white bg-accent hover:bg-accent-light px-3 py-1.5 rounded-lg transition-colors">+ Budžet</button>
      )}

      {loading ? (
        <div className="text-[11px] text-text-muted text-center py-4">Učitavanje...</div>
      ) : budgets.length === 0 ? (
        <div className="text-[11px] text-text-muted text-center py-4">Nema budžeta</div>
      ) : (
        budgets.map((b) => {
          const pct = b.monthlyLimit > 0 ? Math.round((b.currentUsage / b.monthlyLimit) * 100) : 0;
          return (
            <div key={b.id} className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[12px] font-semibold text-text">{b.currency === "USD" ? "$" : b.currency}{b.monthlyLimit}/mo</span>
                  {b.projectId && <span className="text-[10px] text-text-muted ml-2">· project:{b.projectId.slice(0,8)}</span>}
                </div>
                {canManage && <button onClick={() => handleDelete(b.id)} className="text-[9px] text-red-400 hover:text-red-300">🗑</button>}
              </div>
              <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
                <span>Potrošeno: {b.currency === "USD" ? "$" : b.currency}{b.currentUsage}</span>
                <span>{pct}% · Alert at {b.alertAtPercent}%</span>
              </div>
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${
                  pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-green-500"
                }`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          );
        })
      )}

      {showAdd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[12px] font-semibold text-text mb-3">Novi budžet</h3>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Mjesečni limit ($)</label>
              <input type="number" value={monthlyLimit} onChange={(e) => setMonthlyLimit(Number(e.target.value))} min={0} className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none" />
            </div>
            <div className="flex items-center justify-end gap-2 mt-3">
              <button onClick={() => setShowAdd(false)} className="text-[10px] text-text-muted hover:text-text px-2 py-1 rounded hover:bg-surface-2">Otkaži</button>
              <button onClick={handleAdd} disabled={monthlyLimit <= 0} className="text-[10px] text-white bg-accent hover:bg-accent-light disabled:opacity-40 px-3 py-1 rounded-lg">Dodaj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
