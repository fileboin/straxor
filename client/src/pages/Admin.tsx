import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.js";
import { useTheme } from "../lib/theme.js";
import { api } from "../lib/api.js";
import {
  getFeatureFlags, toggleFeatureFlag,
  getTariffs, createTariff, updateTariff, deleteTariff,
  getRegistry, createRegistryEntry, updateRegistryEntry, deleteRegistryEntry,
  getWallets, creditWallet, getWalletTransactions,
  getSubscriptions, updateSubscription,
  getPromoCodes, createPromoCode, deletePromoCode,
  getAdminLogs, getAdminDashboard,
  getPlugins, createPlugin, updatePlugin, deletePlugin,
  getAdminApiKeys, deleteAdminApiKey,
  getAuditLogs,
  getSystemSettings, updateSystemSetting,
  getAdminNotifications, createAdminNotification, updateAdminNotification, deleteAdminNotification,
  blockUser, setUserPlan,
  getAdminSupportTickets, getAdminSupportTicket, updateTicketStatus, adminReplyTicket,
  getAdminFeedback, updateFeatureRequestStatus, getSupportStats,
  getAdminDeployProviders, createAdminDeployProvider, updateAdminDeployProvider, deleteAdminDeployProvider,
  type FeatureFlag, type Tariff, type AdminRegistryEntry,
  type WalletAccount, type WalletTransaction,
  type Subscription, type PromoCode, type AdminDashboardStats,
} from "../lib/admin.js";

type Tab = "dashboard" | "users" | "flags" | "tariffs" | "registry" | "wallet" | "subscriptions" | "promos" | "logs" | "providers" | "runtimes" | "api-keys" | "plugins" | "notifications" | "security" | "settings" | "support" | "deploy-providers";

const SIDEBAR: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "flags", label: "Feature Flags", icon: "🚩" },
  { id: "tariffs", label: "Tariffs", icon: "💰" },
  { id: "registry", label: "Registry", icon: "📦" },
  { id: "wallet", label: "Wallet & Billing", icon: "💳" },
  { id: "subscriptions", label: "Subscriptions", icon: "📋" },
  { id: "promos", label: "Promo Codes", icon: "🏷" },
  { id: "providers", label: "AI Providers", icon: "🔗" },
  { id: "runtimes", label: "Runtimes", icon: "⚙" },
  { id: "api-keys", label: "API Integrations", icon: "🔑" },
  { id: "plugins", label: "Plugins", icon: "🧩" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
  { id: "deploy-providers", label: "Deploy Providers", icon: "🚀" },
  { id: "support", label: "Support", icon: "🎫" },
  { id: "security", label: "Security Center", icon: "🛡" },
  { id: "settings", label: "Settings", icon: "⚙" },
  { id: "logs", label: "System Logs", icon: "📜" },
];

export default function Admin() {
  const { user, logout } = useAuth();
  const { toggleTheme, theme } = useTheme();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const flash = (msg: string) => { setActionMsg(msg); setTimeout(() => setActionMsg(""), 2500); };

  // Dashboard
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

  // API Keys (admin)
  const [adminKeys, setAdminKeys] = useState<any[]>([]);
  const [adminKeyProviderFilter, setAdminKeyProviderFilter] = useState("");

  // Plugins
  const [pluginList, setPluginList] = useState<any[]>([]);
  const [showPluginForm, setShowPluginForm] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<any | null>(null);
  const [pluginForm, setPluginForm] = useState({ name: "", type: "custom", version: "1.0.0", description: "", author: "", icon: "🧩", isEnabled: true, isInstalled: false });

  // Audit / Security
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditSeverity, setAuditSeverity] = useState("");
  const [auditPage, setAuditPage] = useState(0);

  // System Settings
  const [settings, setSettings] = useState<any[]>([]);
  const [editingSetting, setEditingSetting] = useState<string | null>(null);
  const [editingSettingValue, setEditingSettingValue] = useState("");

  // Notifications
  const [notifConfigs, setNotifConfigs] = useState<any[]>([]);
  const [showNotifForm, setShowNotifForm] = useState(false);
  const [notifForm, setNotifForm] = useState({ channel: "", enabled: true, events: "[]", config: "{}" });

  // Support
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [supportTicketTotal, setSupportTicketTotal] = useState(0);
  const [supportTicketFilter, setSupportTicketFilter] = useState("");
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [supportReplyMsg, setSupportReplyMsg] = useState("");
  const [supportFeedback, setSupportFeedback] = useState<any[]>([]);
  const [supportStats, setSupportStats] = useState<any>(null);

  // Deploy Providers
  const [deployProviders, setDeployProviders] = useState<any[]>([]);
  const [showDeployProviderForm, setShowDeployProviderForm] = useState(false);
  const [editingDeployProvider, setEditingDeployProvider] = useState<any | null>(null);
  const [deployProviderForm, setDeployProviderForm] = useState({ providerId: "", name: "", description: "", icon: "🚀", color: "#6366f1", isEnabled: true, minTariff: "free", maxDeploys: -1, sortOrder: 0, configSchema: "" });

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
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try { const res = await api<any[]>("/admin/users"); setUserList(res); } catch { flash("Greška pri učitavanju korisnika"); }
    setLoading(false);
  }, []);
  const loadAdminKeys = useCallback(async () => {
    try { setAdminKeys(await getAdminApiKeys(adminKeyProviderFilter || undefined)); } catch { flash("Greška"); }
  }, [adminKeyProviderFilter]);
  const loadPlugins = useCallback(async () => { try { setPluginList(await getPlugins()); } catch { flash("Greška"); } }, []);
  const loadAuditLogs = useCallback(async () => {
    try { const res = await getAuditLogs(auditSeverity || undefined, undefined, 50, auditPage * 50); setAuditLogs(res.logs); setAuditTotal(res.total); }
    catch { flash("Greška"); }
  }, [auditSeverity, auditPage]);
  const loadSettings = useCallback(async () => { try { setSettings(await getSystemSettings()); } catch { flash("Greška"); } }, []);
  const loadNotifs = useCallback(async () => { try { setNotifConfigs(await getAdminNotifications()); } catch { flash("Greška"); } }, []);
  const loadSupportTickets = useCallback(async () => { try { const res = await getAdminSupportTickets(supportTicketFilter || undefined); setSupportTickets(res.tickets); setSupportTicketTotal(res.total); } catch { flash("Greška"); } }, [supportTicketFilter]);
  const loadSupportFeedback = useCallback(async () => { try { setSupportFeedback(await getAdminFeedback()); } catch { flash("Greška"); } }, []);
  const loadSupportStats = useCallback(async () => { try { setSupportStats(await getSupportStats()); } catch { flash("Greška"); } }, []);
  const loadDeployProviders = useCallback(async () => { try { setDeployProviders(await getAdminDeployProviders()); } catch { flash("Greška"); } }, []);

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
    else if (tab === "api-keys") loadAdminKeys();
    else if (tab === "plugins") loadPlugins();
    else if (tab === "security") loadAuditLogs();
    else if (tab === "settings") loadSettings();
    else if (tab === "notifications") loadNotifs();
    else if (tab === "support") { loadSupportTickets(); loadSupportFeedback(); loadSupportStats(); }
    else if (tab === "deploy-providers") loadDeployProviders();
  }, [tab]);

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
  const handleToggleRegistry = async (entry: AdminRegistryEntry) => {
    try { await updateRegistryEntry(entry.id, { isEnabled: !entry.isEnabled }); loadRegistry(); flash(`${entry.name} ${entry.isEnabled ? "disabled" : "enabled"}`); }
    catch { flash("Greška"); }
  };

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

  // Users
  const handleBlockUser = async (id: string, isBlocked: boolean) => { try { await blockUser(id, isBlocked); flash(isBlocked ? "Blokiran" : "Odblokiran"); loadUsers(); } catch { flash("Greška"); } };
  const handleSetUserPlan = async (id: string, plan: string) => { try { await setUserPlan(id, plan); flash("Plan ažuriran"); loadUsers(); } catch { flash("Greška"); } };
  const handleSetUserRole = async (id: string, role: string) => { try { await api(`/admin/users/${id}/role`, { method: "PUT", body: { role } }); flash("Uloga ažurirana"); loadUsers(); } catch { flash("Greška"); } };

  // API Keys
  const handleDeleteAdminKey = async (id: string) => { try { await deleteAdminApiKey(id); flash("Ključ obrisan"); loadAdminKeys(); } catch { flash("Greška"); } };

  // Plugins
  const handleSavePlugin = async () => {
    try { if (editingPlugin) { await updatePlugin(editingPlugin.id, pluginForm); flash("Plugin ažuriran"); } else { await createPlugin(pluginForm); flash("Plugin kreiran"); } setShowPluginForm(false); setEditingPlugin(null); loadPlugins(); }
    catch { flash("Greška"); }
  };
  const handleDeletePlugin = async (id: string) => { try { await deletePlugin(id); flash("Plugin obrisan"); loadPlugins(); } catch { flash("Greška"); } };
  const handleTogglePlugin = async (p: any) => { try { await updatePlugin(p.id, { isEnabled: !p.isEnabled }); loadPlugins(); flash(`${p.name} ${p.isEnabled ? "disabled" : "enabled"}`); } catch { flash("Greška"); } };

  // Settings
  const handleSaveSetting = async (id: string) => {
    try { await updateSystemSetting(id, editingSettingValue); flash("Sačuvano"); setEditingSetting(null); loadSettings(); }
    catch { flash("Greška"); }
  };

  // Notifications
  const handleSaveNotif = async () => {
    try { await createAdminNotification(notifForm); flash("Notifikacija kreirana"); setShowNotifForm(false); loadNotifs(); }
    catch { flash("Greška"); }
  };
  const handleToggleNotif = async (n: any) => { try { await updateAdminNotification(n.id, { enabled: !n.enabled }); loadNotifs(); } catch { flash("Greška"); } };
  const handleDeleteNotif = async (id: string) => { try { await deleteAdminNotification(id); flash("Obrisano"); loadNotifs(); } catch { flash("Greška"); } };

  // Deploy Providers
  const handleSaveDeployProvider = async () => {
    try { if (editingDeployProvider) { await updateAdminDeployProvider(editingDeployProvider.id, deployProviderForm); flash("Ažuriran"); } else { await createAdminDeployProvider(deployProviderForm); flash("Kreiran"); } setShowDeployProviderForm(false); setEditingDeployProvider(null); loadDeployProviders(); }
    catch { flash("Greška"); }
  };
  const handleDeleteDeployProvider = async (id: string) => { try { await deleteAdminDeployProvider(id); flash("Obrisano"); loadDeployProviders(); } catch { flash("Greška"); } };

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

          {/* ── Dashboard ── */}
          {!loading && tab === "dashboard" && dashStats && dashStats.system && dashStats.featureFlags && (
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-surface-2 border border-border">
                  <h3 className="text-[12px] font-semibold text-text mb-3">Sistem Status</h3>
                  <div className="space-y-2 text-[12px]">
                    <div className="flex justify-between"><span className="text-text-muted">Env</span><span className="text-text">{dashStats.system.env}</span></div>
                    <div className="flex justify-between"><span className="text-text-muted">Node</span><span className="text-text">{dashStats.system.nodeVersion}</span></div>
                    <div className="flex justify-between"><span className="text-text-muted">Uptime</span><span className="text-text">{Math.floor(dashStats.system.uptimeSec / 60)} min</span></div>
                    <div className="flex justify-between"><span className="text-text-muted">ADMIN_EMAIL</span><span className={dashStats.system.adminEmailConfigured ? "text-green-400" : "text-yellow-400"}>{dashStats.system.adminEmailConfigured ? "configurisan" : "nije postavljen"}</span></div>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-surface-2 border border-border">
                  <h3 className="text-[12px] font-semibold text-text mb-3">Nedavna Aktivnost</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {dashStats.recentActivity.length === 0 && <div className="text-[11px] text-text-muted">Nema aktivnosti</div>}
                    {dashStats.recentActivity.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-3 text-[11px] border-b border-border/40 pb-1.5">
                        <span className="text-text truncate">{a.message}</span>
                        <span className="text-text-muted whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Users ── */}
          {!loading && tab === "users" && (
            <div className="space-y-3">
              <h2 className="text-[16px] font-bold text-text mb-4">User Management</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead><tr className="text-text-muted border-b border-border"><th className="text-left py-2 px-3">Email</th><th className="text-left py-2 px-3">Role</th><th className="text-left py-2 px-3">Plan</th><th className="text-left py-2 px-3">Status</th><th className="text-left py-2 px-3">Created</th><th className="text-left py-2 px-3">Actions</th></tr></thead>
                  <tbody>
                    {userList.map((u: any) => (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-surface-2/50">
                        <td className="py-2 px-3 text-text">{u.email}</td>
                        <td className="py-2 px-3">
                          <select value={u.role || "user"} onChange={(e) => handleSetUserRole(u.id, e.target.value)} className="bg-surface-3 border border-border rounded px-1.5 py-0.5 text-[10px] text-text outline-none">
                            <option value="user">user</option><option value="admin">admin</option><option value="super_admin">super_admin</option>
                          </select>
                        </td>
                        <td className="py-2 px-3">
                          <select value={u.plan || "free"} onChange={(e) => handleSetUserPlan(u.id, e.target.value)} className="bg-surface-3 border border-border rounded px-1.5 py-0.5 text-[10px] text-text outline-none">
                            <option value="free">Free</option><option value="hobby">Hobby</option><option value="pro">Pro</option><option value="team">Team</option><option value="enterprise">Enterprise</option><option value="lifetime">Lifetime</option>
                          </select>
                        </td>
                        <td className="py-2 px-3"><span className={`text-[10px] px-2 py-0.5 rounded-full ${u.isBlocked ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>{u.isBlocked ? "Blocked" : "Active"}</span></td>
                        <td className="py-2 px-3 text-text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="py-2 px-3">
                          <button onClick={() => handleBlockUser(u.id, !u.isBlocked)} className={`text-[10px] px-2 py-0.5 rounded ${u.isBlocked ? "bg-green-500/10 text-green-400 hover:bg-green-500/20" : "bg-red-500/10 text-red-400 hover:bg-red-500/20"}`}>{u.isBlocked ? "Unblock" : "Block"}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Feature Flags ── */}
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

          {/* ── Tariffs ── */}
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

          {/* ── Registry ── */}
          {!loading && tab === "registry" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-text">Registry System</h2><div className="flex items-center gap-2"><select value={registryFilter} onChange={(e) => setRegistryFilter(e.target.value)} className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-[11px] text-text outline-none"><option value="">All</option><option value="runtime">Runtime</option><option value="ai-provider">AI Provider</option><option value="integration">Integration</option><option value="template">Template</option></select><button onClick={() => { setEditingRegistry(null); setRegistryForm({ type: "runtime", key: "", name: "", description: "", icon: "📦", isEnabled: true, sortOrder: 0 }); setShowRegistryForm(true); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ New</button></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {registry.filter((e) => !registryFilter || e.type === registryFilter).map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-border">
                    <div className="flex items-center gap-2.5"><span className="text-lg">{e.icon || "📦"}</span><div><div className="text-[12px] font-medium text-text">{e.name}</div><div className="text-[10px] text-text-muted">{e.type} · {e.key}</div></div></div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => handleToggleRegistry(e)} className={`text-[10px] px-1.5 py-0.5 rounded ${e.isEnabled ? "bg-green-500/10 text-green-400" : "bg-surface-3 text-text-muted"}`}>{e.isEnabled ? "ON" : "OFF"}</button>
                      <button onClick={() => { setEditingRegistry(e); setRegistryForm({ type: e.type, key: e.key, name: e.name, description: e.description || "", icon: e.icon || "📦", isEnabled: e.isEnabled ?? true, sortOrder: e.sortOrder ?? 0 }); setShowRegistryForm(true); }} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary hover:text-text">✎</button>
                      {!e.isBuiltin && <button onClick={() => handleDeleteRegistry(e.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">✕</button>}
                    </div>
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

          {/* ── Wallet ── */}
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

          {/* ── Subscriptions ── */}
          {!loading && tab === "subscriptions" && (
            <div className="space-y-3"><h2 className="text-[16px] font-bold text-text mb-4">Subscriptions</h2><div className="space-y-1.5">{subscriptionList.map((s) => (<div key={s.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-2 border border-border"><div><div className="text-[12px] text-text">User: <span className="font-mono text-[11px]">{s.userId.slice(0, 12)}...</span></div><div className="text-[11px] text-text-muted">Status: {s.status} · Tariff: {s.tariffId?.slice(0, 8) || "N/A"} · Auto: {s.autoRenew ? "✓" : "✕"}</div></div><select value={s.status || "active"} onChange={(e) => handleUpdateSubscription(s.id, { status: e.target.value })} className="bg-surface-3 border border-border rounded-lg px-2 py-1 text-[10px] text-text outline-none"><option value="active">Active</option><option value="paused">Paused</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></div>))}</div></div>
          )}

          {/* ── Promo Codes ── */}
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

          {/* ── System Logs ── */}
          {!loading && tab === "logs" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-text">System Logs</h2><div className="flex items-center gap-2"><select value={logFilter} onChange={(e) => { setLogFilter(e.target.value); setLogPage(0); }} className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-[11px] text-text outline-none"><option value="">All</option><option value="system">System</option><option value="auth">Auth</option><option value="deploy">Deploy</option><option value="agent">Agent</option><option value="error">Error</option></select><span className="text-[11px] text-text-muted">{logTotal} total</span></div></div>
              <div className="space-y-1">{logs.map((l: any) => (<div key={l.id} className="flex items-start gap-3 px-4 py-2 rounded-xl bg-surface-2 border border-border"><span className="text-[10px] text-text-muted shrink-0 mt-0.5 font-mono">{new Date(l.createdAt).toLocaleString()}</span><span className="text-[10px] font-mono text-text-muted shrink-0">{l.category}</span><span className="text-[10px] font-mono shrink-0" style={{ color: l.level === "error" ? "#f87171" : l.level === "warn" ? "#fbbf24" : "#94a3b8" }}>{l.level}</span><span className="text-[12px] text-text">{l.message}</span></div>))}</div>
              {logTotal > 50 && (<div className="flex items-center justify-center gap-2 pt-2"><button disabled={logPage === 0} onClick={() => setLogPage((p) => p - 1)} className="text-[11px] px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text disabled:opacity-40">← Previous</button><span className="text-[11px] text-text-muted">Page {logPage + 1}</span><button disabled={(logPage + 1) * 50 >= logTotal} onClick={() => setLogPage((p) => p + 1)} className="text-[11px] px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text disabled:opacity-40">Next →</button></div>)}
            </div>
          )}

          {/* ── AI Providers (powered by Registry) ── */}
          {!loading && tab === "providers" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-text">AI Provider Manager</h2><button onClick={() => { setEditingRegistry(null); setRegistryForm({ type: "ai-provider", key: "", name: "", description: "", icon: "🔗", isEnabled: true, sortOrder: 0 }); setShowRegistryForm(true); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ Add Provider</button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {registry.filter((e) => e.type === "ai-provider").map((p) => (
                  <div key={p.id} className="p-4 rounded-xl bg-surface-2 border border-border space-y-2">
                    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-lg">{p.icon || "🔗"}</span><span className="text-[13px] font-medium text-text">{p.name}</span></div><span className={`text-[10px] px-2 py-0.5 rounded-full ${p.isEnabled ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{p.isEnabled ? "Active" : "Disabled"}</span></div>
                    <div className="text-[10px] text-text-muted font-mono">{p.key}</div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button onClick={() => handleToggleRegistry(p)} className={`text-[10px] px-2 py-1 rounded ${p.isEnabled ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>{p.isEnabled ? "Disable" : "Enable"}</button>
                      <button onClick={() => { setEditingRegistry(p); setRegistryForm({ type: p.type, key: p.key, name: p.name, description: p.description || "", icon: p.icon || "🔗", isEnabled: p.isEnabled ?? true, sortOrder: p.sortOrder ?? 0 }); setShowRegistryForm(true); }} className="text-[10px] px-2 py-1 rounded bg-surface-3 text-text-secondary hover:text-text">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
              {showRegistryForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-full max-w-md mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4">
                    <h4 className="text-[13px] font-bold">{editingRegistry ? "Edit AI Provider" : "New AI Provider"}</h4>
                    <div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] text-text-muted block mb-1">Key</label><input type="text" value={registryForm.key} onChange={(e) => setRegistryForm((p) => ({ ...p, key: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div><div><label className="text-[11px] text-text-muted block mb-1">Name</label><input type="text" value={registryForm.name} onChange={(e) => setRegistryForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Description</label><input type="text" value={registryForm.description} onChange={(e) => setRegistryForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
                    <div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => { setShowRegistryForm(false); setEditingRegistry(null); }} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleSaveRegistry} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Save</button></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Runtime Manager (powered by Registry) ── */}
          {!loading && tab === "runtimes" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-text">Runtime Manager</h2><button onClick={() => { setEditingRegistry(null); setRegistryForm({ type: "runtime", key: "", name: "", description: "", icon: "⚙", isEnabled: true, sortOrder: 0 }); setShowRegistryForm(true); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ Add Runtime</button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {registry.filter((e) => e.type === "runtime").map((r) => (
                  <div key={r.id} className="p-4 rounded-xl bg-surface-2 border border-border space-y-2">
                    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-lg">{r.icon || "⚙"}</span><span className="text-[13px] font-medium text-text">{r.name}</span></div><span className={`text-[10px] px-2 py-0.5 rounded-full ${r.isEnabled ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{r.isEnabled ? "Active" : "Disabled"}</span></div>
                    <div className="text-[10px] text-text-muted font-mono">{r.key}</div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button onClick={() => handleToggleRegistry(r)} className={`text-[10px] px-2 py-1 rounded ${r.isEnabled ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>{r.isEnabled ? "Disable" : "Enable"}</button>
                      <button onClick={() => { setEditingRegistry(r); setRegistryForm({ type: r.type, key: r.key, name: r.name, description: r.description || "", icon: r.icon || "⚙", isEnabled: r.isEnabled ?? true, sortOrder: r.sortOrder ?? 0 }); setShowRegistryForm(true); }} className="text-[10px] px-2 py-1 rounded bg-surface-3 text-text-secondary hover:text-text">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
              {showRegistryForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-full max-w-md mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4">
                    <h4 className="text-[13px] font-bold">{editingRegistry ? "Edit Runtime" : "New Runtime"}</h4>
                    <div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] text-text-muted block mb-1">Key</label><input type="text" value={registryForm.key} onChange={(e) => setRegistryForm((p) => ({ ...p, key: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div><div><label className="text-[11px] text-text-muted block mb-1">Name</label><input type="text" value={registryForm.name} onChange={(e) => setRegistryForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Description</label><input type="text" value={registryForm.description} onChange={(e) => setRegistryForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
                    <div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => { setShowRegistryForm(false); setEditingRegistry(null); }} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleSaveRegistry} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Save</button></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── API & Integrations Manager ── */}
          {!loading && tab === "api-keys" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-text">API & Integrations Manager</h2><div className="flex items-center gap-2"><select value={adminKeyProviderFilter} onChange={(e) => setAdminKeyProviderFilter(e.target.value)} className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-[11px] text-text outline-none"><option value="">All Providers</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="openrouter">OpenRouter</option><option value="google">Google</option><option value="ollama">Ollama</option><option value="deepseek">DeepSeek</option><option value="github">GitHub</option><option value="gitlab">GitLab</option><option value="telegram">Telegram</option><option value="discord">Discord</option><option value="slack">Slack</option><option value="cloudflare">Cloudflare</option><option value="vercel">Vercel</option><option value="netlify">Netlify</option></select><span className="text-[11px] text-text-muted">{adminKeys.length} keys</span></div></div>
              <div className="space-y-1.5">
                {adminKeys.length === 0 && <div className="text-[12px] text-text-muted px-4 py-8 text-center">No API keys found.</div>}
                {adminKeys.map((k: any) => (
                  <div key={k.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-2 border border-border">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${k.isEnabled ? "bg-green-400" : "bg-red-400"}`} />
                      <div><div className="text-[12px] text-text font-medium">{k.providerId} {k.label ? `· ${k.label}` : ""}</div><div className="text-[10px] text-text-muted font-mono">User: {k.userId?.slice(0, 12)}... · {new Date(k.createdAt).toLocaleDateString()}</div></div>
                    </div>
                    <button onClick={() => handleDeleteAdminKey(k.id)} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Plugin Marketplace ── */}
          {!loading && tab === "plugins" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-text">Plugin Marketplace</h2><button onClick={() => { setEditingPlugin(null); setPluginForm({ name: "", type: "custom", version: "1.0.0", description: "", author: "", icon: "🧩", isEnabled: true, isInstalled: false }); setShowPluginForm(true); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ Add Plugin</button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pluginList.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl bg-surface-2 border border-border space-y-2">
                    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-lg">{p.icon || "🧩"}</span><div><div className="text-[13px] font-medium text-text">{p.name}</div><div className="text-[10px] text-text-muted">v{p.version} · {p.type}</div></div></div></div>
                    {p.description && <div className="text-[11px] text-text-muted">{p.description}</div>}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button onClick={() => handleTogglePlugin(p)} className={`text-[10px] px-2 py-1 rounded ${p.isEnabled ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>{p.isEnabled ? "Disable" : "Enable"}</button>
                      <button onClick={() => { setEditingPlugin(p); setPluginForm({ name: p.name, type: p.type, version: p.version, description: p.description || "", author: p.author || "", icon: p.icon || "🧩", isEnabled: p.isEnabled, isInstalled: p.isInstalled }); setShowPluginForm(true); }} className="text-[10px] px-2 py-1 rounded bg-surface-3 text-text-secondary hover:text-text">Edit</button>
                      <button onClick={() => handleDeletePlugin(p.id)} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
              {showPluginForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-full max-w-md mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4">
                    <h4 className="text-[13px] font-bold">{editingPlugin ? "Edit Plugin" : "New Plugin"}</h4>
                    <div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] text-text-muted block mb-1">Name</label><input type="text" value={pluginForm.name} onChange={(e) => setPluginForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div><div><label className="text-[11px] text-text-muted block mb-1">Type</label><select value={pluginForm.type} onChange={(e) => setPluginForm((p) => ({ ...p, type: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none"><option value="custom">Custom</option><option value="sdk">SDK</option><option value="tool">Tool</option><option value="theme">Theme</option></select></div></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Description</label><input type="text" value={pluginForm.description} onChange={(e) => setPluginForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
                    <div className="grid grid-cols-3 gap-3"><div><label className="text-[11px] text-text-muted block mb-1">Version</label><input type="text" value={pluginForm.version} onChange={(e) => setPluginForm((p) => ({ ...p, version: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div><div><label className="text-[11px] text-text-muted block mb-1">Author</label><input type="text" value={pluginForm.author} onChange={(e) => setPluginForm((p) => ({ ...p, author: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div><div><label className="text-[11px] text-text-muted block mb-1">Icon</label><input type="text" value={pluginForm.icon} onChange={(e) => setPluginForm((p) => ({ ...p, icon: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div></div>
                    <div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => { setShowPluginForm(false); setEditingPlugin(null); }} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleSavePlugin} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Save</button></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Notifications ── */}
          {!loading && tab === "notifications" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-text">Notification Channels</h2><button onClick={() => { setNotifForm({ channel: "", enabled: true, events: "[]", config: "{}" }); setShowNotifForm(true); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ Add Channel</button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {notifConfigs.map((n) => (
                  <div key={n.id} className="p-4 rounded-xl bg-surface-2 border border-border space-y-2">
                    <div className="flex items-center justify-between"><span className="text-[13px] font-medium text-text">{n.channel}</span><span className={`text-[10px] px-2 py-0.5 rounded-full ${n.enabled ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{n.enabled ? "Active" : "Disabled"}</span></div>
                    <div className="text-[10px] text-text-muted">Events: {(() => { try { return JSON.parse(n.events || "[]").length || "all"; } catch { return "all"; } })()}</div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button onClick={() => handleToggleNotif(n)} className={`text-[10px] px-2 py-1 rounded ${n.enabled ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>{n.enabled ? "Disable" : "Enable"}</button>
                      <button onClick={() => handleDeleteNotif(n.id)} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {showNotifForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4">
                    <h4 className="text-[13px] font-bold">New Notification Channel</h4>
                    <div><label className="text-[11px] text-text-muted block mb-1">Channel</label><select value={notifForm.channel} onChange={(e) => setNotifForm((p) => ({ ...p, channel: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none"><option value="">Select...</option><option value="email">Email</option><option value="telegram">Telegram</option><option value="discord">Discord</option><option value="push">Push</option><option value="webhook">Webhook</option></select></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Config (JSON)</label><textarea value={notifForm.config} onChange={(e) => setNotifForm((p) => ({ ...p, config: e.target.value }))} rows={3} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[11px] text-text outline-none focus:border-accent font-mono" /></div>
                    <div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => setShowNotifForm(false)} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleSaveNotif} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Save</button></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Support ── */}
          {!loading && tab === "support" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between"><h2 className="text-[16px] font-bold text-text">Support Dashboard</h2><span className="text-[11px] text-text-muted">{supportTicketTotal} tickets</span></div>
              {/* Stats */}
              {supportStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted">Open</div><div className="text-xl font-bold text-text mt-1">{supportStats.tickets.open}</div></div>
                  <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted">In Progress</div><div className="text-xl font-bold text-text mt-1">{supportStats.tickets.inProgress}</div></div>
                  <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted">Resolved</div><div className="text-xl font-bold text-text mt-1">{supportStats.tickets.resolved}</div></div>
                  <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted">Feedback</div><div className="text-xl font-bold text-text mt-1">{supportStats.totalFeedback}</div></div>
                </div>
              )}
              {!activeTicket && (
                <>
                  {/* Filter */}
                  <div className="flex items-center gap-2"><select value={supportTicketFilter} onChange={(e) => setSupportTicketFilter(e.target.value)} className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-[11px] text-text outline-none"><option value="">All</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div>
                  {/* Ticket list */}
                  <div className="space-y-1.5">{supportTickets.map((t: any) => (<div key={t.id} onClick={() => (async () => { try { const detail = await getAdminSupportTicket(t.id); setActiveTicket(detail); } catch { flash("Greška"); } })()} className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-2 border border-border cursor-pointer hover:bg-surface-3 transition-colors"><div className="flex-1 min-w-0"><div className="text-[13px] font-medium text-text truncate">{t.subject}</div><div className="text-[10px] text-text-muted mt-0.5">{t.category} · {new Date(t.createdAt).toLocaleDateString()} · {t.userId?.slice(0, 8)}...</div></div><div className="flex items-center gap-2 shrink-0 flex-wrap justify-end"><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: t.status === "open" ? "#3b82f620" : t.status === "in_progress" ? "#f59e0b20" : t.status === "resolved" ? "#22c55e20" : "#6b728020", color: t.status === "open" ? "#3b82f6" : t.status === "in_progress" ? "#f59e0b" : t.status === "resolved" ? "#22c55e" : "#6b7280" }}>{t.status}</span><span className={`text-[10px] px-2 py-0.5 rounded-full ${t.priority === "high" ? "bg-red-500/20 text-red-400" : t.priority === "urgent" ? "bg-orange-500/20 text-orange-400" : "bg-surface-3 text-text-muted"}`}>{t.priority}</span></div></div>))}</div>
                  {/* Feedback */}
                  <div className="pt-4"><h4 className="text-[13px] font-semibold text-text mb-3">Recent Feedback ({supportFeedback.length})</h4><div className="space-y-1.5 max-h-60 overflow-y-auto">{supportFeedback.map((f: any) => (<div key={f.id} className="flex items-start gap-3 px-4 py-2.5 rounded-xl bg-surface-2 border border-border"><div><div className="text-[12px] font-medium text-text">{f.subject}</div><div className="text-[10px] text-text-muted">{f.type} · {new Date(f.createdAt).toLocaleDateString()} · {f.userId?.slice(0, 8)}...</div>{f.description && <div className="text-[11px] text-text-muted mt-1">{f.description}</div>}</div></div>))}</div></div>
                  {/* Top feature requests */}
                  {supportStats?.topRequests?.length > 0 && (<div className="pt-4"><h4 className="text-[13px] font-semibold text-text mb-3">Top Feature Requests</h4><div className="space-y-1.5">{supportStats.topRequests.map((r: any) => (<div key={r.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-2 border border-border"><div><div className="text-[12px] font-medium text-text">{r.title}</div><div className="text-[10px] text-text-muted">{r.voteCount} votes · {r.category}</div></div><select value={r.status || "new"} onChange={(e) => updateFeatureRequestStatus(r.id, e.target.value).then(loadSupportStats).catch(() => flash("Greška"))} className="bg-surface-3 border border-border rounded px-2 py-0.5 text-[10px] text-text outline-none"><option value="new">New</option><option value="reviewing">Reviewing</option><option value="planned">Planned</option><option value="in_development">In Dev</option><option value="completed">Completed</option><option value="rejected">Rejected</option></select></div>))}</div></div>)}
                </>
              )}
              {/* Ticket detail */}
              {activeTicket && (
                <div className="space-y-4">
                  <button onClick={() => setActiveTicket(null)} className="text-[11px] text-text-muted hover:text-text">← Back to tickets</button>
                  <div className="flex items-center justify-between"><h3 className="text-[14px] font-bold text-text">{activeTicket.subject}</h3><span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: activeTicket.status === "open" ? "#3b82f620" : activeTicket.status === "in_progress" ? "#f59e0b20" : "#22c55e20", color: activeTicket.status === "open" ? "#3b82f6" : activeTicket.status === "in_progress" ? "#f59e0b" : "#22c55e" }}>{activeTicket.status}</span></div>
                  <div className="flex items-center gap-3 flex-wrap"><select value={activeTicket.status} onChange={async (e) => { try { const updated = await updateTicketStatus(activeTicket.id, { status: e.target.value }); setActiveTicket((p: any) => ({ ...p, ...updated })); flash("Status updated"); loadSupportStats(); } catch { flash("Greška"); }}} className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-[11px] text-text outline-none"><option value="open">Open</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div>
                  {activeTicket.user && <div className="text-[11px] text-text-muted">User: {activeTicket.user.email} ({activeTicket.user.role})</div>}
                  <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted mb-2">{activeTicket.category} · {activeTicket.priority} · {new Date(activeTicket.createdAt).toLocaleString()}</div><div className="text-[12px] text-text whitespace-pre-wrap">{activeTicket.description}</div></div>
                  {/* Messages */}
                  <div className="space-y-2"><h4 className="text-[12px] font-semibold text-text">Conversation</h4>{activeTicket.messages?.map((m: any) => (<div key={m.id} className={`p-3 rounded-xl ${m.isAdmin ? "bg-accent/10 border border-accent/20 ml-8" : "bg-surface-2 border border-border mr-8"}`}><div className="flex items-center justify-between mb-1"><span className="text-[10px] font-medium text-text-muted">{m.isAdmin ? "Support" : activeTicket.user?.email || "User"}</span><span className="text-[9px] text-text-muted">{new Date(m.createdAt).toLocaleString()}</span></div><div className="text-[12px] text-text">{m.message}</div></div>))}</div>
                  {/* Admin reply */}
                  <div className="flex items-center gap-2"><input type="text" value={supportReplyMsg} onChange={(e) => setSupportReplyMsg(e.target.value)} onKeyDown={async (e) => { if (e.key === "Enter" && supportReplyMsg) { try { await adminReplyTicket(activeTicket.id, supportReplyMsg); setSupportReplyMsg(""); const detail = await getAdminSupportTicket(activeTicket.id); setActiveTicket(detail); } catch { flash("Greška"); } }}} placeholder="Type reply..." className="flex-1 px-3 py-2 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /><button onClick={async () => { if (!supportReplyMsg) return; try { await adminReplyTicket(activeTicket.id, supportReplyMsg); setSupportReplyMsg(""); const detail = await getAdminSupportTicket(activeTicket.id); setActiveTicket(detail); } catch { flash("Greška"); }}} className="px-3 py-2 rounded-lg bg-accent text-white text-[11px] hover:bg-accent-light">Reply</button></div>
                </div>
              )}
            </div>
          )}

          {/* ── Deploy Providers ── */}
          {!loading && tab === "deploy-providers" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4"><h2 className="text-[16px] font-bold text-text">Deploy Providers</h2><button onClick={() => { setEditingDeployProvider(null); setDeployProviderForm({ providerId: "", name: "", description: "", icon: "🚀", color: "#6366f1", isEnabled: true, minTariff: "free", maxDeploys: -1, sortOrder: 0, configSchema: "" }); setShowDeployProviderForm(true); }} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">+ Add Provider</button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {deployProviders.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl bg-surface-2 border border-border space-y-2">
                    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="text-lg">{p.icon || "🚀"}</span><span className="text-[13px] font-medium text-text">{p.name}</span></div><span className={`text-[10px] px-2 py-0.5 rounded-full ${p.isEnabled ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>{p.isEnabled ? "Enabled" : "Disabled"}</span></div>
                    <div className="text-[10px] text-text-muted font-mono">{p.providerId}</div>
                    {p.description && <div className="text-[11px] text-text-muted">{p.description}</div>}
                    <div className="text-[10px] text-text-muted">Min tariff: {p.minTariff} · Max deploys: {p.maxDeploys === -1 ? "∞" : p.maxDeploys}</div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <button onClick={() => { setEditingDeployProvider(p); setDeployProviderForm({ providerId: p.providerId, name: p.name, description: p.description || "", icon: p.icon || "🚀", color: p.color || "#6366f1", isEnabled: p.isEnabled ?? true, minTariff: p.minTariff || "free", maxDeploys: p.maxDeploys ?? -1, sortOrder: p.sortOrder ?? 0, configSchema: p.configSchema || "" }); setShowDeployProviderForm(true); }} className="text-[10px] px-2 py-1 rounded bg-surface-3 text-text-secondary hover:text-text">Edit</button>
                      <button onClick={() => handleDeleteDeployProvider(p.id)} className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {showDeployProviderForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-full max-w-md mx-4 bg-surface border border-border rounded-2xl shadow-2xl p-5 space-y-4">
                    <h4 className="text-[13px] font-bold">{editingDeployProvider ? "Edit Provider" : "New Provider"}</h4>
                    <div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] text-text-muted block mb-1">Provider ID</label><input type="text" value={deployProviderForm.providerId} onChange={(e) => setDeployProviderForm((p) => ({ ...p, providerId: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div><div><label className="text-[11px] text-text-muted block mb-1">Name</label><input type="text" value={deployProviderForm.name} onChange={(e) => setDeployProviderForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Description</label><input type="text" value={deployProviderForm.description} onChange={(e) => setDeployProviderForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div>
                    <div className="grid grid-cols-3 gap-3"><div><label className="text-[11px] text-text-muted block mb-1">Icon</label><input type="text" value={deployProviderForm.icon} onChange={(e) => setDeployProviderForm((p) => ({ ...p, icon: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div><div><label className="text-[11px] text-text-muted block mb-1">Color</label><input type="text" value={deployProviderForm.color} onChange={(e) => setDeployProviderForm((p) => ({ ...p, color: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div><div><label className="text-[11px] text-text-muted block mb-1">Sort</label><input type="number" value={deployProviderForm.sortOrder} onChange={(e) => setDeployProviderForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div></div>
                    <div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] text-text-muted block mb-1">Min Tariff</label><select value={deployProviderForm.minTariff} onChange={(e) => setDeployProviderForm((p) => ({ ...p, minTariff: e.target.value }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none"><option value="free">Free</option><option value="hobby">Hobby</option><option value="pro">Pro</option><option value="team">Team</option><option value="enterprise">Enterprise</option></select></div><div><label className="text-[11px] text-text-muted block mb-1">Max Deploys</label><input type="number" value={deployProviderForm.maxDeploys} onChange={(e) => setDeployProviderForm((p) => ({ ...p, maxDeploys: parseInt(e.target.value) || -1 }))} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text outline-none focus:border-accent" /></div></div>
                    <div><label className="text-[11px] text-text-muted block mb-1">Config Schema (JSON)</label><textarea value={deployProviderForm.configSchema} onChange={(e) => setDeployProviderForm((p) => ({ ...p, configSchema: e.target.value }))} rows={2} className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-[11px] text-text outline-none focus:border-accent font-mono" /></div>
                    <div className="flex items-center justify-end gap-2 pt-2"><button onClick={() => { setShowDeployProviderForm(false); setEditingDeployProvider(null); }} className="text-[11px] px-3 py-1.5 text-text-muted hover:text-text">Cancel</button><button onClick={handleSaveDeployProvider} className="text-[11px] px-3 py-1.5 rounded-lg bg-accent text-white hover:bg-accent-light">Save</button></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Security Center ── */}
          {!loading && tab === "security" && (
            <div className="space-y-4">
              <h2 className="text-[16px] font-bold text-text">Security Center</h2>
              {/* Audit Logs */}
              <div className="space-y-3">
                <div className="flex items-center justify-between"><h3 className="text-[13px] font-semibold text-text">Audit Trail</h3><div className="flex items-center gap-2"><select value={auditSeverity} onChange={(e) => { setAuditSeverity(e.target.value); setAuditPage(0); }} className="bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-[10px] text-text outline-none"><option value="">All Severities</option><option value="info">Info</option><option value="warn">Warning</option><option value="error">Error</option><option value="critical">Critical</option></select><span className="text-[11px] text-text-muted">{auditTotal} total</span></div></div>
                <div className="space-y-1 max-h-80 overflow-y-auto">{auditLogs.map((l: any) => (<div key={l.id} className="flex items-start gap-3 px-4 py-2 rounded-xl bg-surface-2 border border-border"><span className="text-[10px] text-text-muted shrink-0 mt-0.5 font-mono">{new Date(l.createdAt).toLocaleString()}</span><span className="text-[10px] font-mono text-text-muted shrink-0">{l.action}</span><span className="text-[10px] font-mono shrink-0" style={{ color: l.severity === "error" || l.severity === "critical" ? "#f87171" : l.severity === "warn" ? "#fbbf24" : "#94a3b8" }}>{l.severity}</span><span className="text-[11px] text-text">{l.resource || l.action}</span></div>))}</div>
                {auditTotal > 50 && (<div className="flex items-center justify-center gap-2 pt-2"><button disabled={auditPage === 0} onClick={() => setAuditPage((p) => p - 1)} className="text-[11px] px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text disabled:opacity-40">← Previous</button><span className="text-[11px] text-text-muted">Page {auditPage + 1}</span><button disabled={(auditPage + 1) * 50 >= auditTotal} onClick={() => setAuditPage((p) => p + 1)} className="text-[11px] px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary hover:text-text disabled:opacity-40">Next →</button></div>)}
              </div>
              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted">2FA</div><div className="text-[12px] text-text mt-1">Available per user (totp_secret)</div></div>
                <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted">Session Timeout</div><div className="text-[12px] text-text mt-1">Configurable in Settings tab</div></div>
                <div className="p-4 rounded-xl bg-surface-2 border border-border"><div className="text-[11px] text-text-muted">API Key Encryption</div><div className="text-[12px] text-text mt-1">AES-256-GCM encrypted storage</div></div>
              </div>
            </div>
          )}

          {/* ── Settings ── */}
          {!loading && tab === "settings" && (
            <div className="space-y-3">
              <h2 className="text-[16px] font-bold text-text mb-4">System Settings</h2>
              <div className="space-y-1.5">
                {settings.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-2 border border-border">
                    <div className="flex-1"><div className="text-[12px] font-medium text-text">{s.key}</div><div className="text-[10px] text-text-muted">{s.description} {s.category && <span>· {s.category}</span>}</div></div>
                    <div className="flex items-center gap-2">
                      {editingSetting === s.id ? (
                        <>
                          <input type="text" value={editingSettingValue} onChange={(e) => setEditingSettingValue(e.target.value)} className="w-32 px-2 py-1 bg-surface-3 border border-border rounded text-[11px] text-text outline-none focus:border-accent" autoFocus />
                          <button onClick={() => handleSaveSetting(s.id)} className="text-[10px] px-2 py-1 rounded bg-accent text-white">Save</button>
                          <button onClick={() => setEditingSetting(null)} className="text-[10px] px-2 py-1 text-text-muted hover:text-text">✕</button>
                        </>
                      ) : (
                        <>
                          <span className="text-[12px] font-mono text-text max-w-32 truncate">{s.value}</span>
                          <button onClick={() => { setEditingSetting(s.id); setEditingSettingValue(s.value); }} className="text-[10px] px-2 py-1 rounded bg-surface-3 text-text-secondary hover:text-text">Edit</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
