import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, isAdmin } from "../lib/auth.js";
import { useTheme } from "../lib/theme.js";
import {
  getFeatureFlags,
  toggleFeatureFlag,
  getTariffs,
  createTariff,
  updateTariff,
  deleteTariff,
  getRegistry,
  createRegistryEntry,
  updateRegistryEntry,
  deleteRegistryEntry,
  getWallets,
  creditWallet,
  getWalletTransactions,
  getSubscriptions,
  updateSubscription,
  getPromoCodes,
  createPromoCode,
  deletePromoCode,
  getAdminLogs,
  getAdminDashboard,
  type FeatureFlag,
  type Tariff,
  type AdminRegistryEntry,
  type WalletAccount,
  type WalletTransaction,
  type Subscription,
  type PromoCode,
  type AdminDashboardStats,
} from "../lib/admin.js";

type Tab = "dashboard" | "users" | "flags" | "tariffs" | "registry" | "wallet" | "subscriptions" | "promos" | "logs" | "providers" | "runtimes";

const SIDEBAR: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "flags", label: "Feature Flags", icon: "🚩" },
  { id: "tariffs", label: "Tariffs", icon: "💰" },
  { id: "registry", label: "Registry", icon: "📦" },
  { id: "wallet", label: "Wallet & Billing", icon: "💳" },
  { id: "subscriptions", label: "Subscriptions", icon: "📋" },
  { id: "promos", label: "Promo Codes", icon: "🏷" },
  { id: "logs", label: "System Logs", icon: "📜" },
  { id: "providers", label: "AI Providers", icon: "🔗" },
  { id: "runtimes", label: "Runtime Manager", icon: "⚙" },
];

export default function Admin() {
  const { user, logout } = useAuth();
  const { toggleTheme, theme } = useTheme();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  };

  // Dashboard stats
  const [dashStats, setDashStats] = useState<AdminDashboardStats | null>(null);

  // Users
  const [userList, setUserList] = useState<any[]>([]);

  // Feature Flags
  const [flags, setFlags] = useState<FeatureFlag[]>([]);

  // Tariffs
  const [tariffList, setTariffList] = useState<Tariff[]>([]);
  const [showTariffForm, setShowTariffForm] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [tariffForm, setTariffForm] = useState({ name: "", price: 0, maxProjects: 1, maxAgents: 1, maxRuntimes: 1, maxMembers: 1, storageLimit: 100, bandwidthLimit: 1000, sortOrder: 0 });

  // Registry
  const [registry, setRegistry] = useState<AdminRegistryEntry[]>([]);
  const [registryFilter, setRegistryFilter] = useState("");
  const [showRegistryForm, setShowRegistryForm] = useState(false);
  const [editingRegistry, setEditingRegistry] = useState<AdminRegistryEntry | null>(null);
  const [registryForm, setRegistryForm] = useState({ type: "runtime", key: "", name: "", description: "", icon: "📦", isEnabled: true, sortOrder: 0 });

  // Wallet
  const [wallets, setWallets] = useState<WalletAccount[]>([]);
  const [walletTxs, setWalletTxs] = useState<WalletTransaction[]>([]);
  const [creditForm, setCreditForm] = useState({ userId: "", amount: 0, description: "" });

  // Subscriptions
  const [subscriptionList, setSubscriptionList] = useState<Subscription[]>([]);

  // Promo Codes
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [promoForm, setPromoForm] = useState({ code: "", discountType: "percent", discountValue: 10, maxUses: 100 });
  const [showPromoForm, setShowPromoForm] = useState(false);

  // Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logFilter, setLogFilter] = useState("");
  const [logPage, setLogPage] = useState(0);

  // ── Loaders ──
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try { setDashStats(await getAdminDashboard()); } catch { flash("Greška pri učitavanju"); }
    setLoading(false);
  }, []);
  const loadFlags = useCallback(async () => { try { setFlags(await getFeatureFlags()); } catch { flash("Greška"); } }, []);
  const loadTariffs = useCallback(async () => { try { setTariffList(await getTariffs()); } catch { flash("Greška"); } }, []);
  const loadRegistry = useCallback(async () => { try { setRegistry(await getRegistry()); } catch { flash("Greška"); } }, []);
  const loadWallets = useCallback(async () => { try { setWallets(await getWallets()); } catch { flash("Greška"); } }, []);
  const loadSubscriptions = useCallback(async () => { try { setSubscriptionList(await getSubscriptions()); } catch { flash("Greška"); } }, []);
  const loadPromoCodes = useCallback(async () => { try { setPromoCodes(await getPromoCodes()); } catch { flash("Greška"); } }, []);
  const loadLogs = useCallback(async () => {
    try { const res = await getAdminLogs(logFilter || undefined, 50, logPage * 50); setLogs(res.logs); setLogTotal(res.total); }
    catch { flash("Greška"); }
  }, [logFilter, logPage]);

  // Load users list
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { api } = await import("../lib/api.js");
      const res = await api<any[]>("/admin/users");
      setUserList(res);
    } catch { flash("Greška pri učitavanju korisnika"); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "dashboard") loadDashboard();
    else if (tab === "users") loadUsers();
    else if (tab === "flags") loadFlags();
    else if (tab === "tariffs") loadTariffs();
    else if (tab === "registry") loadRegistry();
    else if (tab === "wallet") { loadWallets(); setCreditForm({ userId: "", amount: 0, description: "" }); }
    else if (tab === "subscriptions") loadSubscriptions();
    else if (tab === "promos") loadPromoCodes();
    else if (tab === "logs") loadLogs();
  }, [tab, loadDashboard, loadFlags, loadTariffs, loadRegistry, loadWallets, loadSubscriptions, loadPromoCodes, loadLogs, loadUsers]);

  // ── Actions ──
  const handleToggleFlag = async (flag: FeatureFlag) => {
    try { const updated = await toggleFeatureFlag(flag.id, !flag.isEnabled); setFlags((p) => p.map((f) => f.id === flag.id ? updated : f)); flash(`Flag "${flag.key}" ${updated.isEnabled ? "✓" : "✕"}`); }
    catch { flash("Greška"); }
  };

  const handleSaveTariff = async () => {
    try { if (editingTariff) { await updateTariff(editingTariff.id, tariffForm); flash("Tarifa ažurirana"); } else { await createTariff(tariffForm); flash("Tarifa kreirana"); } setShowTariffForm(false); setEditingTariff(null); loadTariffs(); }
    catch { flash("Greška"); }
  };

  const handleDeleteTariff = async (id: string) => { try { await deleteTariff(id); flash("Obrisano"); loadTariffs(); } catch { flash("Greška"); } };
  const handleSaveRegistry = async () => {
    try { if (editingRegistry) { await updateRegistryEntry(editingRegistry.id, registryForm); flash("Registry ažuriran"); } else { await createRegistryEntry(registryForm); flash("Registry kreiran"); } setShowRegistryForm(false); setEditingRegistry(null); loadRegistry(); }
    catch { flash("Greška"); }
  };
  const handleDeleteRegistry = async (id: string) => { try { await deleteRegistryEntry(id); flash("Obrisano"); loadRegistry(); } catch { flash("Greška"); } };

  const handleCreditWallet = async () => {
    if (!creditForm.userId || !creditForm.amount) { flash("Unesi userId i iznos"); return; }
    try { await creditWallet(creditForm.userId, creditForm.amount, creditForm.description); flash("Wallet kreditiran"); loadWallets(); setCreditForm({ userId: "", amount: 0, description: "" }); }
    catch { flash("Greška"); }
  };
  const handleViewWalletTx = async (walletId: string) => { try { setWalletTxs(await getWalletTransactions(walletId)); } catch { flash("Greška"); } };
  const handleUpdateSubscription = async (id: string, data: Partial<Subscription>) => { try { await updateSubscription(id, data); flash("Ažurirano"); loadSubscriptions(); } catch { flash("Greška"); } };
  const handleCreatePromo = async () => {
    if (!promoForm.code || !promoForm.discountValue) { flash("Unesi kod i vrednost"); return; }
    try { await createPromoCode(promoForm); flash("Promo kod kreiran"); setShowPromoForm(false); loadPromoCodes(); } catch { flash("Greška"); }
  };
  const handleDeletePromo = async (id: string) => { try { await deletePromoCode(id); flash("Obrisano"); loadPromoCodes(); } catch { flash("Greška"); } };

  // ── Render ──
  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text hover:bg-surface-2 text-sm">☰</button>
          <h1 className="text-[15px] font-bold text-text">Admin Center</h1>
        </div>
        <div className="flex items-center gap-2">
          {actionMsg && <span className="text-[11px] text-accent animate-pulse hidden sm:inline">{actionMsg}</span>}
          <button onClick={() => navigate("/")} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text transition-colors">← Dashboard</button>
          <button onClick={toggleTheme} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-text hover:bg-surface-2">{theme === "dark" ? "☀" : "☾"}</button>
          <span className="text-[11px] text-text-muted hidden sm:inline">{user?.email}</span>
          <button onClick={logout} className="text-[11px] text-text-muted hover:text-text transition-colors">Odjavi se</button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside className={`w-56 shrink-0 border-r border-border bg-surface-2/50 overflow-y-auto ${sidebarOpen ? "fixed inset-0 z-40 md:static md:z-auto" : "hidden md:block"}`}>
          {sidebarOpen && <div className="md:hidden flex items-center justify-between px-4 py-2.5 border-b border-border"><span className="text-[13px] font-bold">Admin</span><button onClick={() => setSidebarOpen(false)} className="text-lg">✕</button></div>}
          <nav className="p-2 space-y-0.5">
            {SIDEBAR.map((s) => (
              <button key={s.id} onClick={() => { setTab(s.id); setSidebarOpen(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors text-left ${tab === s.id ? "bg-accent/15 text-accent border border-accent/20" : "text-text-secondary hover:text-text hover:bg-surface-2 border border-transparent"}`}>
                <span>{s.icon}</span><span>{s.label}</span>
              </button>
            ))}
          </nav>
        </aside>
        {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading && <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>}

          {!loading && tab === "dashboard" && dashStats && (
            <div className="space-y-6">
              <div className="flex items-center justify-between"><h2 className="text-[16px] font-bold text-text">System Overview</h2></div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted">Users</div><div className="text-2xl font-bold text-text mt-1">{dashStats.users}</div></div>
                <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted">API Keys</div><div className="text-2xl font-bold text-text mt-1">{dashStats.apiKeys}</div></div>
                <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted">Tariffs</div><div className="text-2xl font-bold text-text mt-1">{dashStats.tariffs}</div></div>
                <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted">Subscriptions</div><div className="text-2xl font-bold text-text mt-1">{dashStats.subscriptions}</div></div>
                <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted">Wallets</div><div className="text-2xl font-bold text-text mt-1">{dashStats.wallets}</div></div>
                <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted">Feature Flags</div><div className="text-2xl font-bold text-text mt-1">{dashStats.featureFlags.active}<span className="text-text-muted text-[13px] font-normal">/{dashStats.featureFlags.total}</span></div></div>
              </div>
            </div>
          )}

          {!loading && tab === "users" && (
            <div className="space-y-3">
              <h2 className="text-[16px] font-bold text-text mb-4">User Management</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead><tr className="text-text-muted border-b border-border"><th className="text-left py-2 px-3">Email</th><th className="text-left py-2 px-3">Role</th><th className="text-left py-2 px-3">Created</th><th className="text-left py-2 px-3">Actions</th></tr></thead>
                  <tbody>
                    {userList.map((u: any) => (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-surface-2/50"><td className="py-2 px-3 text-text">{u.email}</td><td className="py-2 px-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${u.role === "admin" || u.role === "super_admin" ? "bg-accent/20 text-accent" : "bg-surface-3 text-text-secondary"}`}>{u.role || "user"}</span></td><td className="py-2 px-3 text-text-muted">{new Date(u.createdAt).toLocaleDateString()}</td><td className="py-2 px-3">{/* Future: edit role, block */}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!loading && tab === "flags" && (
            <div className="space-y-3">
              <h2 className="text-[16px] font-bold text-text mb-4">Feature Flags</h2>
              <div className="space-y-1.5">
                {flags.map((f) => (
                  <div key={f.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-2 border border-border">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleToggleFlag(f)} className={`w-10 h-5 rounded-full transition-colors relative ${f.isEnabled ? "bg-accent" : "bg-surface-3"}`}>
                        <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all shadow-sm ${f.isEnabled ? "left-5.5" : "left-0.5"}`} />
                      </button>
                      <div><div className="text-[13px] font-medium text-text">{f.name}</div><div className="text-[11px] text-text-muted">{f.description} {f.category && <span>· {f.category}</span>}</div></div>
                    </div>
                    <span className="text-[10px] text-text-muted font-mono">{f.key}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && tab === "tariffs" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-text">Tariffs</h2><button onClick={() => { setEditingTariff(null); setTariffForm({ name: "", price: 0, maxProjects: 1, maxAgents: 1, maxRuntimes: 1, maxMembers: 1, storageLimit: 100, bandwidthLimit: 1000, sortOrder: 0 }); setShowTariffForm(true); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light transition-colors">+ New Tariff</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tariffList.map((t) => (
                  <div key={t.id} className="p-4 rounded-xl bg-surface-2 border border-border space-y-2">
                    <div className="flex items-center justify-between"><span className="text-[14px] font-bold text-text">{t.name}</span><span className="text-[13px] font-bold text-accent">${t.price / 100}</span></div>
                    <div className="text-[11px] text-text-muted space-y-1"><div>Projects: {t.maxProjects} · Agents: {t.maxAgents} · Runtimes: {t.maxRuntimes}</div><div>Members: {t.maxMembers} · Storage: {t.storageLimit}MB · BW: {t.bandwidthLimit}MB</div></div>
                    <div className="flex items-center gap-2 pt-1"><button onClick={() => { setEditingTariff(t); setTariffForm({ name: t.name, price: t.price, maxProjects: t.maxProjects ?? 1, maxAgents: t.maxAgents ?? 1, maxRuntimes: t.maxRuntimes ?? 1, maxMembers: t.maxMembers ?? 1, storageLimit: t.storageLimit ?? 100, bandwidthLimit: t.bandwidthLimit ?? 1000, sortOrder: t.sortOrder ?? 0 }); setShowTariffForm(true); }} className="text-[10px] px-2 py-1 rounded-lg bg-surface-3 text-text-secondary hover:text-text">Edit</button><button onClick={() => handleDeleteTariff(t.id)} className="text-[10px] px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">Delete</button></div>
                  </div>
                ))}
              </div>
              {showTariffForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-full max-w-md mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4">
                    <h4 className="text-[13px] font-bold">{editingTariff ? "Edit Tariff" : "New Tariff"}</h4>
                    {(["name","price","sortOrder"] as const).map((f) => (<div key={f}><label className="text-[11px] text-text-muted block mb-1">{f}</label><input type={f === "price" ? "number" : "text"} value={tariffForm[f] as any} onChange={(e) => setTariffForm((p) => ({ ...p, [f]: f === "name" ? e.target.value : parseInt(e.target.value) || 0 }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>))}
                    <div className="grid grid-cols-2 gap-3">{(["maxProjects","maxAgents","maxRuntimes","maxMembers","storageLimit","bandwidthLimit"] as const).map((f) => (<div key={f}><label className="text-[11px] text-text-muted block mb-1">{f}</label><input type="number" value={tariffForm[f]} onChange={(e) => setTariffForm((p) => ({ ...p, [f]: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>))}</div>
                    <div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => { setShowTariffForm(false); setEditingTariff(null); }} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleSaveTariff} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Save</button></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && tab === "registry" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-text">Registry System</h2><div className="flex items-center gap-2"><select value={registryFilter} onChange={(e) => setRegistryFilter(e.target.value)} className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-[11px] text-text outline-none"><option value="">All</option><option value="runtime">Runtime</option><option value="ai-provider">AI Provider</option><option value="integration">Integration</option><option value="template">Template</option></select><button onClick={() => { setEditingRegistry(null); setRegistryForm({ type: "runtime", key: "", name: "", description: "", icon: "📦", isEnabled: true, sortOrder: 0 }); setShowRegistryForm(true); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ New</button></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {registry.filter((e) => !registryFilter || e.type === registryFilter).map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-border">
                    <div className="flex items-center gap-2.5"><span className="text-lg">{e.icon || "📦"}</span><div><div className="text-[12px] font-medium text-text">{e.name}</div><div className="text-[10px] text-text-muted">{e.type} · {e.key}</div></div></div>
                    <div className="flex items-center gap-1.5"><button onClick={() => { setEditingRegistry(e); setRegistryForm({ type: e.type, key: e.key, name: e.name, description: e.description || "", icon: e.icon || "📦", isEnabled: e.isEnabled ?? true, sortOrder: e.sortOrder ?? 0 }); setShowRegistryForm(true); }} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary hover:text-text">✎</button>{!e.isBuiltin && <button onClick={() => handleDeleteRegistry(e.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">✕</button>}</div>
                  </div>
                ))}
              </div>
              {showRegistryForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-full max-w-md mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4">
                    <h4 className="text-[13px] font-bold">{editingRegistry ? "Edit Entry" : "New Entry"}</h4>
                    <div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] text-text-muted block mb-1">Type</label><select value={registryForm.type} onChange={(e) => setRegistryForm((p) => ({ ...p, type: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none"><option value="runtime">Runtime</option><option value="ai-provider">AI Provider</option><option value="integration">Integration</option><option value="template">Template</option></select></div><div><label className="text-[11px] text-text-muted block mb-1">Key</label><input type="text" value={registryForm.key} onChange={(e) => setRegistryForm((p) => ({ ...p, key: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Name</label><input type="text" value={registryForm.name} onChange={(e) => setRegistryForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Description</label><input type="text" value={registryForm.description} onChange={(e) => setRegistryForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
                    <div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => { setShowRegistryForm(false); setEditingRegistry(null); }} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleSaveRegistry} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Save</button></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && tab === "wallet" && (
            <div className="space-y-4">
              <h2 className="text-[16px] font-bold text-text">Wallet & Billing</h2>
              <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-3">
                <h4 className="text-[12px] font-semibold text-text">Credit Wallet</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input type="text" placeholder="User ID" value={creditForm.userId} onChange={(e) => setCreditForm((p) => ({ ...p, userId: e.target.value }))} className="px-3 py-1.5 bg-surface-3 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" />
                  <input type="number" placeholder="Amount (cents)" value={creditForm.amount || ""} onChange={(e) => setCreditForm((p) => ({ ...p, amount: parseInt(e.target.value) || 0 }))} className="px-3 py-1.5 bg-surface-3 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" />
                  <button onClick={handleCreditWallet} className="px-3 py-1.5 rounded-lg bg-accent text-white text-[11px] hover:bg-accent-light">Credit</button>
                </div>
              </div>
              <div className="space-y-1.5">
                <h4 className="text-[12px] font-semibold text-text mb-2">Wallets ({wallets.length})</h4>
                {wallets.map((w) => (
                  <div key={w.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-2 border border-border">
                    <div><div className="text-[12px] text-text">User: <span className="font-mono text-[11px]">{w.userId.slice(0, 12)}...</span></div><div className="text-[11px] text-text-muted">Balance: <span className="font-bold text-accent">${(w.balance / 100).toFixed(2)}</span></div></div>
                    <button onClick={() => handleViewWalletTx(w.id)} className="text-[10px] px-2 py-1 rounded bg-surface-3 text-text-secondary hover:text-text">Transactions</button>
                  </div>
                ))}
              </div>
              {walletTxs.length > 0 && (
                <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-2">
                  <div className="flex items-center justify-between"><h4 className="text-[12px] font-semibold text-text">Transactions</h4><button onClick={() => setWalletTxs([])} className="text-[10px] text-text-muted hover:text-text">Close</button></div>
                  <div className="max-h-48 overflow-y-auto space-y-1">{walletTxs.map((tx) => (<div key={tx.id} className="flex items-center justify-between px-3 py-1.5 bg-surface-3 rounded-lg"><span className="text-[11px] text-text-muted">{tx.type} · {new Date(tx.createdAt).toLocaleDateString()}</span><span className={`text-[11px] font-medium ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>{tx.amount > 0 ? "+" : "-"}${(tx.amount / 100).toFixed(2)}</span></div>))}</div>
                </div>
              )}
            </div>
          )}

          {!loading && tab === "subscriptions" && (
            <div className="space-y-3"><h2 className="text-[16px] font-bold text-text mb-4">Subscriptions</h2><div className="space-y-1.5">{subscriptionList.map((s) => (<div key={s.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-2 border border-border"><div><div className="text-[12px] text-text">User: <span className="font-mono text-[11px]">{s.userId.slice(0, 12)}...</span></div><div className="text-[11px] text-text-muted">Status: {s.status} · Tariff: {s.tariffId?.slice(0, 8) || "N/A"} · Auto: {s.autoRenew ? "✓" : "✕"}</div></div><select value={s.status || "active"} onChange={(e) => handleUpdateSubscription(s.id, { status: e.target.value })} className="bg-surface-3 border border-border rounded-lg px-2 py-1 text-[10px] text-text outline-none"><option value="active">Active</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></div>))}</div></div>
          )}

          {!loading && tab === "promos" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-text">Promo Codes</h2><button onClick={() => { setPromoForm({ code: "", discountType: "percent", discountValue: 10, maxUses: 100 }); setShowPromoForm(true); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ New Code</button></div>
              <div className="space-y-1.5">{promoCodes.map((p) => (<div key={p.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-2 border border-border"><div><div className="text-[13px] font-mono font-bold text-text">{p.code}</div><div className="text-[11px] text-text-muted">{p.discountType} · {p.discountValue}{p.discountType === "percent" ? "%" : "¢"} · Used: {p.currentUses}/{p.maxUses || "∞"}</div></div><button onClick={() => handleDeletePromo(p.id)} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">Delete</button></div>))}</div>
              {showPromoForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4">
                    <h4 className="text-[13px] font-bold">New Promo Code</h4>
                    <div><label className="text-[11px] text-text-muted block mb-1">Code</label><input type="text" value={promoForm.code} onChange={(e) => setPromoForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent font-mono" /></div>
                    <div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] text-text-muted block mb-1">Type</label><select value={promoForm.discountType} onChange={(e) => setPromoForm((p) => ({ ...p, discountType: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none"><option value="percent">Percent</option><option value="fixed">Fixed</option></select></div><div><label className="text-[11px] text-text-muted block mb-1">Value</label><input type="number" value={promoForm.discountValue} onChange={(e) => setPromoForm((p) => ({ ...p, discountValue: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Max Uses</label><input type="number" value={promoForm.maxUses} onChange={(e) => setPromoForm((p) => ({ ...p, maxUses: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
                    <div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => setShowPromoForm(false)} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleCreatePromo} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Create</button></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && tab === "logs" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-text">System Logs</h2><div className="flex items-center gap-2"><select value={logFilter} onChange={(e) => { setLogFilter(e.target.value); setLogPage(0); }} className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-[11px] text-text outline-none"><option value="">All</option><option value="system">System</option><option value="auth">Auth</option><option value="deploy">Deploy</option><option value="agent">Agent</option><option value="error">Error</option></select><span className="text-[11px] text-text-muted">{logTotal} total</span></div></div>
              <div className="space-y-1">{logs.map((l: any) => (<div key={l.id} className="flex items-start gap-3 px-4 py-2 rounded-xl bg-surface-2 border border-border"><span className="text-[10px] text-text-muted shrink-0 mt-0.5 font-mono">{new Date(l.createdAt).toLocaleString()}</span><span className="text-[10px] font-mono text-text-muted shrink-0">{l.category}</span><span className="text-[10px] font-mono shrink-0" style={{ color: l.level === "error" ? "#f87171" : l.level === "warn" ? "#fbbf24" : "#94a3b8" }}>{l.level}</span><span className="text-[12px] text-text">{l.message}</span></div>))}</div>
              {logTotal > 50 && (<div className="flex items-center justify-center gap-2 pt-2"><button disabled={logPage === 0} onClick={() => setLogPage((p) => p - 1)} className="text-[11px] px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text disabled:opacity-40">← Previous</button><span className="text-[11px] text-text-muted">Page {logPage + 1}</span><button disabled={(logPage + 1) * 50 >= logTotal} onClick={() => setLogPage((p) => p + 1)} className="text-[11px] px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text disabled:opacity-40">Next →</button></div>)}
            </div>
          )}

          {!loading && tab === "providers" && (
            <div className="space-y-3">
              <h2 className="text-[16px] font-bold text-text mb-4">AI Provider Manager</h2>
              <p className="text-[12px] text-text-muted">Manage AI provider configurations — keys, models, rate limits.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {["OpenAI", "Anthropic", "Google", "OpenRouter", "Ollama", "DeepSeek"].map((name) => (
                  <div key={name} className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[13px] font-medium text-text">{name}</div><div className="text-[11px] text-text-muted mt-1">Status: <span className="text-green-400">Active</span></div></div>
                ))}
              </div>
            </div>
          )}

          {!loading && tab === "runtimes" && (
            <div className="space-y-3">
              <h2 className="text-[16px] font-bold text-text mb-4">Runtime Manager</h2>
              <p className="text-[12px] text-text-muted">Available runtimes for agent execution.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {["OpenCode", "Free Claude Code", "Cline", "Codex", "Continue", "Custom Runtime"].map((name) => (
                  <div key={name} className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[13px] font-medium text-text">{name}</div><div className="text-[11px] text-text-muted mt-1">Enabled: <span className="text-green-400">Yes</span></div></div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
