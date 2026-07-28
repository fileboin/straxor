import { useState, useEffect, useCallback } from "react";
import { pluginApi, type Plugin, type MarketplaceCategory } from "../../lib/plugins";

interface Props {
  onClose: () => void;
}

type Tab = "installed" | "marketplace" | "sdk";

const TYPE_ICONS: Record<string, string> = {
  adapter: "🔌",
  ui: "🖼",
  tool: "🧰",
  integration: "🔗",
  custom: "⚙",
};

export default function PluginManager({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("installed");
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [marketplace, setMarketplace] = useState<{ plugins: Plugin[]; categories: MarketplaceCategory[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [installForm, setInstallForm] = useState({ name: "", type: "custom", version: "1.0.0", description: "", author: "", icon: "🧩", entryPoint: "" });
  const [filterType, setFilterType] = useState("");

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  };

  const loadPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const p = await pluginApi.list();
      setPlugins(p);
    } catch (err: any) { flash(err.message); }
    setLoading(false);
  }, []);

  const loadMarketplace = useCallback(async () => {
    try {
      const m = await pluginApi.marketplace();
      setMarketplace(m);
    } catch (err: any) { flash(err.message); }
  }, []);

  useEffect(() => { loadPlugins(); }, [loadPlugins]);
  useEffect(() => { if (tab === "marketplace") loadMarketplace(); }, [tab, loadMarketplace]);

  const seedPlugins = async () => {
    try {
      const result = await pluginApi.seed();
      flash(result.message);
      loadPlugins();
    } catch (err: any) { flash(err.message); }
  };

  const handleToggle = async (plugin: Plugin) => {
    try {
      const updated = await pluginApi.update(plugin.id, { isEnabled: !plugin.isEnabled });
      setPlugins((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (selectedPlugin?.id === plugin.id) setSelectedPlugin(updated);
      flash(updated.isEnabled ? "Plugin enabled" : "Plugin disabled");
    } catch (err: any) { flash(err.message); }
  };

  const handleUninstall = async (id: string) => {
    try {
      await pluginApi.uninstall(id);
      setPlugins((prev) => prev.filter((p) => p.id !== id));
      if (selectedPlugin?.id === id) setSelectedPlugin(null);
      flash("Plugin uninstalled");
    } catch (err: any) { flash(err.message); }
  };

  const handleInstall = async () => {
    if (!installForm.name.trim()) return;
    try {
      const plugin = await pluginApi.install(installForm);
      setPlugins((prev) => [...prev, plugin]);
      setShowInstall(false);
      setInstallForm({ name: "", type: "custom", version: "1.0.0", description: "", author: "", icon: "🧩", entryPoint: "" });
      flash("Plugin installed");
    } catch (err: any) { flash(err.message); }
  };

  const installFromMarketplace = async (mp: Plugin) => {
    try {
      const plugin = await pluginApi.install({
        name: mp.name,
        type: mp.type,
        version: mp.version,
        description: mp.description || undefined,
        author: mp.author || undefined,
        icon: mp.icon || undefined,
        configSchema: mp.configSchema,
        permissions: mp.permissions,
        entryPoint: mp.entryPoint || undefined,
      });
      setPlugins((prev) => [...prev, plugin]);
      flash(`${mp.name} installed`);
    } catch (err: any) { flash(err.message); }
  };

  const filtered = plugins.filter((p) => !filterType || p.type === filterType);
  const installed = plugins.filter((p) => p.isInstalled);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-lg">🧩</span>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-text">Plugin Manager</h1>
              <p className="text-[10px] text-text-muted">{installed.length} pluginova instalirano</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={seedPlugins} className="px-3 py-1.5 bg-surface-dim border border-border text-text text-[11px] rounded-lg hover:bg-border">Seed Built-ins</button>
            <button onClick={onClose} className="text-text-muted hover:text-text text-sm px-2 py-1 rounded-lg hover:bg-surface-dim transition-colors">✕</button>
          </div>
        </div>

        {actionMsg && (
          <div className="mx-5 mt-2 px-3 py-1.5 bg-accent/10 text-accent text-[11px] rounded-lg">{actionMsg}</div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 border-b border-border shrink-0 overflow-x-auto">
          {[
            { id: "installed" as Tab, label: "Installed", icon: "📦" },
            { id: "marketplace" as Tab, label: "Marketplace", icon: "🏪" },
            { id: "sdk" as Tab, label: "SDK Docs", icon: "📖" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                tab === t.id ? "bg-accent/10 text-accent border-b-2 border-accent" : "text-text-muted hover:text-text hover:bg-surface-dim"
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── INSTALLED ── */}
          {tab === "installed" && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                  className="px-2.5 py-1.5 bg-surface-dim border border-border rounded-lg text-[11px] text-text">
                  <option value="">All Types</option>
                  <option value="adapter">Adapter</option>
                  <option value="ui">UI</option>
                  <option value="tool">Tool</option>
                  <option value="integration">Integration</option>
                  <option value="custom">Custom</option>
                </select>
                <button onClick={() => setShowInstall(true)} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90 ml-auto">+ Install Plugin</button>
              </div>

              {showInstall && (
                <div className="p-3 bg-surface-dim rounded-lg space-y-2 mb-3">
                  <div className="flex gap-2">
                    <input value={installForm.name} onChange={(e) => setInstallForm((p) => ({ ...p, name: e.target.value }))} placeholder="Plugin name"
                      className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                    <select value={installForm.type} onChange={(e) => setInstallForm((p) => ({ ...p, type: e.target.value }))}
                      className="px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text">
                      <option value="adapter">Adapter</option>
                      <option value="ui">UI</option>
                      <option value="tool">Tool</option>
                      <option value="integration">Integration</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input value={installForm.author} onChange={(e) => setInstallForm((p) => ({ ...p, author: e.target.value }))} placeholder="Author"
                      className="flex-1 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                    <input value={installForm.version} onChange={(e) => setInstallForm((p) => ({ ...p, version: e.target.value }))} placeholder="Version"
                      className="w-24 px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                  </div>
                  <textarea value={installForm.description} onChange={(e) => setInstallForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" rows={2}
                    className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg text-[11px] text-text placeholder:text-text-muted" />
                  <div className="flex gap-2">
                    <button onClick={handleInstall} className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90">Install</button>
                    <button onClick={() => setShowInstall(false)} className="px-3 py-1.5 text-text-muted text-[11px]">Cancel</button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="text-text-muted text-[11px] py-8 text-center">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="text-text-muted text-[11px] py-8 text-center">
                  {plugins.length === 0 ? "No plugins installed. Click 'Seed Built-ins' to load default plugins." : "No plugins match filter"}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filtered.map((plugin) => (
                    <div key={plugin.id}
                      className={`p-3 bg-surface-dim rounded-lg cursor-pointer transition-colors hover:bg-surface-dim/80 ${selectedPlugin?.id === plugin.id ? "ring-1 ring-accent" : ""}`}
                      onClick={() => setSelectedPlugin(selectedPlugin?.id === plugin.id ? null : plugin)}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{plugin.icon || TYPE_ICONS[plugin.type] || "🧩"}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-bold text-text">{plugin.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold ${
                              plugin.isBuiltin ? "bg-blue-500/20 text-blue-300" : "bg-green-500/20 text-green-300"
                            }`}>{plugin.isBuiltin ? "built-in" : "custom"}</span>
                          </div>
                          <div className="text-[10px] text-text-muted">
                            {TYPE_ICONS[plugin.type] || "📦"} {plugin.type} • v{plugin.version}
                            {plugin.author ? ` • ${plugin.author}` : ""}
                          </div>
                          {plugin.description && <div className="text-[10px] text-text-muted mt-0.5 line-clamp-1">{plugin.description}</div>}
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={plugin.isEnabled} onChange={() => handleToggle(plugin)} className="sr-only peer" />
                          <div className="w-7 h-4 bg-border rounded-full peer peer-checked:bg-accent peer-checked:after:translate-x-3 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:w-3 after:h-3 after:rounded-full after:bg-white transition-all"></div>
                        </label>
                      </div>

                      {/* Expanded detail */}
                      {selectedPlugin?.id === plugin.id && (
                        <div className="mt-3 pt-3 border-t border-border space-y-2">
                          {plugin.permissions && plugin.permissions !== "[]" && (
                            <div>
                              <div className="text-[9px] text-text-muted uppercase font-semibold mb-1">Permissions</div>
                              <div className="flex flex-wrap gap-1">
                                {JSON.parse(plugin.permissions).map((perm: string) => (
                                  <span key={perm} className="px-1.5 py-0.5 bg-surface rounded text-[9px] text-text-muted">{perm}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {plugin.entryPoint && (
                            <div className="text-[10px] text-text-muted">
                              Entry: <code className="text-accent">{plugin.entryPoint}</code>
                            </div>
                          )}
                          <div className="text-[10px] text-text-muted">
                            ID: <code className="text-accent">{plugin.id}</code>
                            {plugin.isInstalled && !plugin.isBuiltin && (
                              <button onClick={() => handleUninstall(plugin.id)} className="ml-3 text-red-400 hover:text-red-300">Uninstall</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── MARKETPLACE ── */}
          {tab === "marketplace" && (
            <>
              {!marketplace ? (
                <div className="text-text-muted text-[11px] py-8 text-center">Loading...</div>
              ) : (
                <>
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                    {marketplace.categories.map((cat) => (
                      <button key={cat.id} onClick={() => setFilterType(filterType === cat.id ? "" : cat.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                          filterType === cat.id ? "bg-accent text-white" : "bg-surface-dim text-text-muted hover:text-text"
                        }`}>
                        <span>{cat.icon}</span>
                        {cat.name}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {marketplace.plugins
                      .filter((p) => !filterType || p.type === filterType)
                      .map((mp) => {
                        const alreadyInstalled = plugins.some((p) => p.name === mp.name);
                        return (
                          <div key={mp.name} className="p-3 bg-surface-dim rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{mp.icon || TYPE_ICONS[mp.type] || "🧩"}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-bold text-text">{mp.name}</div>
                                <div className="text-[10px] text-text-muted">{TYPE_ICONS[mp.type]} {mp.type} • v{mp.version} • {mp.author}</div>
                                {mp.description && <div className="text-[10px] text-text-muted mt-0.5">{mp.description}</div>}
                              </div>
                              {alreadyInstalled ? (
                                <span className="px-2 py-1 text-[10px] text-green-400 font-medium">Installed</span>
                              ) : (
                                <button onClick={() => installFromMarketplace(mp)}
                                  className="px-3 py-1.5 bg-accent text-white text-[11px] rounded-lg hover:bg-accent/90 shrink-0">Install</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── SDK DOCS ── */}
          {tab === "sdk" && (
            <div className="space-y-4">
              <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
                <h2 className="text-[14px] font-bold text-text mb-1">STRAXOR Plugin SDK</h2>
                <p className="text-[11px] text-text-muted">Zvanični SDK za razvoj custom pluginova, adaptera, alata i UI dodataka.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-surface-dim rounded-lg">
                  <h3 className="text-[12px] font-bold text-accent mb-2">📦 createPlugin()</h3>
                  <pre className="text-[10px] text-text-muted font-mono whitespace-pre-wrap">{`import { createPlugin } from "../sdk";

const plugin = createPlugin({
  name: "My Plugin",
  type: "custom",
  version: "1.0.0",
  description: "...",
  author: "You",
});`}</pre>
                </div>

                <div className="p-3 bg-surface-dim rounded-lg">
                  <h3 className="text-[12px] font-bold text-accent mb-2">🔌 registerAdapter()</h3>
                  <pre className="text-[10px] text-text-muted font-mono whitespace-pre-wrap">{`plugin.registerAdapter({
  id: "custom-provider",
  name: "Custom Provider",
  type: "deployment",
  version: "1.0.0",
  actions: ["deploy", "status"],
  configSchema: { ... }
});`}</pre>
                </div>

                <div className="p-3 bg-surface-dim rounded-lg">
                  <h3 className="text-[12px] font-bold text-accent mb-2">🧰 registerTool()</h3>
                  <pre className="text-[10px] text-text-muted font-mono whitespace-pre-wrap">{`plugin.registerTool({
  name: "my-tool",
  description: "What it does",
  parameters: { type: "object", properties: {...} },
  handler: async (args, ctx) => {
    ctx.log("Tool called!");
    return { result: "done" };
  },
});`}</pre>
                </div>

                <div className="p-3 bg-surface-dim rounded-lg">
                  <h3 className="text-[12px] font-bold text-accent mb-2">🖼 registerPanel() + registerTile()</h3>
                  <pre className="text-[10px] text-text-muted font-mono whitespace-pre-wrap">{`plugin.registerPanel({
  id: "my-panel",
  label: "My Panel",
  icon: "📊",
  component: MyPanelComponent,
});

plugin.registerTile({
  id: "my-panel",
  name: "My Panel",
  description: "...",
  icon: "📊",
  color: "blue",
  category: "tools",
  action: "my-panel",
});`}</pre>
                </div>

                <div className="p-3 bg-surface-dim rounded-lg">
                  <h3 className="text-[12px] font-bold text-accent mb-2">🔗 Events</h3>
                  <pre className="text-[10px] text-text-muted font-mono whitespace-pre-wrap">{`plugin.on("app:ready", (ctx) => {
  console.log("App ready!");
});

plugin.on("deploy:complete", 
  (data, ctx) => {
    ctx.notify("Deploy done!", "success");
  }
);`}</pre>
                </div>

                <div className="p-3 bg-surface-dim rounded-lg">
                  <h3 className="text-[12px] font-bold text-accent mb-2">💾 Storage API</h3>
                  <pre className="text-[10px] text-text-muted font-mono whitespace-pre-wrap">{`const { storage } = plugin.ctx;
storage.set("key", { any: "data" });
const val = storage.get("key");
storage.remove("key");
storage.clear();`}</pre>
                </div>
              </div>

              <div className="p-3 bg-surface-dim rounded-lg">
                <h3 className="text-[12px] font-bold text-text mb-2">📋 Available Events</h3>
                <div className="flex flex-wrap gap-1">
                  {["app:ready", "session:start", "session:end", "deploy:start", "deploy:complete", "agent:tool-call", "chat:message-sent", "file:created", "git:commit", "notification:received", "runtime:status-change", "user:login"].map((ev) => (
                    <span key={ev} className="px-2 py-1 bg-surface rounded text-[9px] text-text-muted font-mono">{ev}</span>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-surface-dim rounded-lg">
                <h3 className="text-[12px] font-bold text-text mb-2">📦 Quick Start</h3>
                <pre className="text-[10px] text-text-muted font-mono whitespace-pre-wrap">{`// 1. createPlugin() — define your plugin
// 2. registerAdapter/Tool/Panel/Tile — add capabilities
// 3. plugin.on() — hook into events
// 4. plugin.activate() — register with Straxor

// Then publish via /api/plugins or add to marketplace presets!
// Build, extend, share. 🚀`}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
