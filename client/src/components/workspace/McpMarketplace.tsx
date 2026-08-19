import { useState, useEffect, useCallback } from "react";
import {
  listMcpServers,
  getMcpPresets,
  addMcpServer,
  updateMcpServer,
  deleteMcpServer,
  MCP_CATEGORIES,
  type McpServer,
  type McpPreset,
  type McpCategory,
} from "../../lib/mcp-marketplace";

interface Props {
  onClose: () => void;
  machineId?: string | null;
}

export default function McpMarketplace({ onClose }: Props) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [presets, setPresets] = useState<McpPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [tab, setTab] = useState<"installed" | "presets">("installed");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editServer, setEditServer] = useState<McpServer | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<McpCategory | "all">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, p] = await Promise.all([listMcpServers(), getMcpPresets()]);
      setServers(s);
      setPresets(p);
    } catch (err: any) {
      setError(err.message || "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  };

  const handleToggle = async (server: McpServer) => {
    try {
      const updated = await updateMcpServer(server.id, { isEnabled: !server.isEnabled });
      setServers((prev) => prev.map((s) => s.id === server.id ? { ...s, ...updated } : s));
      flash(updated.isEnabled ? "Omogućen" : "Onemogućen");
    } catch (err: any) {
      flash(`Greška: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMcpServer(id);
      setServers((prev) => prev.filter((s) => s.id !== id));
      flash("Obrisano");
    } catch (err: any) {
      flash(`Greška: ${err.message}`);
    }
  };

  const handleInstallPreset = async (preset: McpPreset) => {
    try {
      const server = await addMcpServer({
        ...preset,
        isEnabled: true,
      });
      setServers((prev) => [...prev, server]);
      flash(`"${preset.name}" instaliran`);
    } catch (err: any) {
      flash(`Greška: ${err.message}`);
    }
  };

  const filteredServers = categoryFilter === "all"
    ? servers
    : servers.filter((s) => s.category === categoryFilter);

  const filteredPresets = categoryFilter === "all"
    ? presets
    : presets.filter((p) => p.category === categoryFilter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-lg">🔌</span>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-text">MCP Marketplace</h1>
              <p className="text-[10px] text-text-muted">
                {`${servers.length} servera instalirano`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {actionMsg && (
              <span className="text-[10px] text-accent px-2 py-1 rounded bg-accent/10">
                {actionMsg}
              </span>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 text-[11px] text-white bg-accent hover:bg-accent-light px-3 py-1.5 rounded-lg transition-colors"
            >
              + Dodaj
            </button>
            <button
              onClick={load}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-surface-3 text-text-secondary hover:text-text text-xs transition-colors"
              title="Osveži"
            >
              ↻
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs + category filter */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-border/50 bg-surface-2/20 shrink-0 overflow-x-auto">
          <button
            onClick={() => setTab("installed")}
            className={`text-[11px] font-medium px-3 py-1 rounded-lg transition-colors ${
              tab === "installed" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Instalirani ({servers.length})
          </button>
          <button
            onClick={() => setTab("presets")}
            className={`text-[11px] font-medium px-3 py-1 rounded-lg transition-colors ${
              tab === "presets" ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Preseti ({presets.length})
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={() => setCategoryFilter("all")}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              categoryFilter === "all" ? "bg-surface-3 text-text" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            Sve
          </button>
          {MCP_CATEGORIES.filter((c) => c.id !== "custom").map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(categoryFilter === cat.id ? "all" : cat.id)}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded transition-colors ${
                categoryFilter === cat.id ? "bg-surface-3 text-text" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[11px] text-text-muted">Učitavanje...</div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-32 text-[11px] text-red-400">
              <span className="text-2xl mb-2">⚠</span>
              {error}
              <button onClick={load} className="mt-2 text-accent hover:underline">Pokušaj ponovo</button>
            </div>
          ) : tab === "installed" ? (
            filteredServers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-[11px] text-text-muted">
                <span className="text-3xl mb-2">🔌</span>
                {categoryFilter === "all" ? "Još nema instaliranih MCP servera" : `Nema servera u ovoj kategoriji`}
                <button onClick={() => { setTab("presets"); setCategoryFilter("all"); }} className="mt-2 text-accent hover:underline">
                  Pogledaj presete
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredServers.map((server) => (
                  <ServerCard
                    key={server.id}
                    server={server}
                    onToggle={handleToggle}
                    onEdit={setEditServer}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPresets.map((preset, i) => (
                <PresetCard
                  key={`preset-${i}`}
                  preset={preset}
                  installed={servers.some((s) => s.name === preset.name)}
                  onInstall={handleInstallPreset}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-border shrink-0">
          <div className="text-[9px] text-text-muted">
            MCP je opcioni protokol za proširenje agenta. Nije potreban za rad STRAXOR-a.
          </div>
          <button onClick={load} className="text-[10px] text-accent hover:underline">
            ↻ Osveži
          </button>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {(showAddModal || editServer) && (
        <ServerFormModal
          server={editServer}
          onSave={async (data) => {
            try {
              if (editServer) {
                const updated = await updateMcpServer(editServer.id, data);
                setServers((prev) => prev.map((s) => s.id === editServer.id ? { ...s, ...updated } : s));
                flash("Sačuvano");
              } else {
                const created = await addMcpServer({ ...data, isEnabled: true });
                setServers((prev) => [...prev, created]);
                flash("Dodato");
              }
              setShowAddModal(false);
              setEditServer(null);
            } catch (err: any) {
              flash(`Greška: ${err.message}`);
            }
          }}
          onClose={() => { setShowAddModal(false); setEditServer(null); }}
        />
      )}
    </div>
  );
}

// ── Server Card ──

function ServerCard({
  server,
  onToggle,
  onEdit,
  onDelete,
}: {
  server: McpServer;
  onToggle: (s: McpServer) => void;
  onEdit: (s: McpServer) => void;
  onDelete: (id: string) => void;
}) {
  const cat = MCP_CATEGORIES.find((c) => c.id === server.category);

  return (
    <div className={`rounded-xl border p-3 transition-all ${
      server.isEnabled
        ? "border-border bg-surface hover:border-border-light"
        : "border-border/50 bg-surface-2/50 opacity-60"
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">{server.icon || "🔌"}</span>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-text truncate">{server.name}</div>
            {cat && (
              <span className="text-[9px] text-text-muted">{cat.icon} {cat.label}</span>
            )}
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={server.isEnabled}
            onChange={() => onToggle(server)}
            className="sr-only peer"
          />
          <div className="w-7 h-4 bg-surface-3 rounded-full peer peer-checked:bg-accent after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-3" />
        </label>
      </div>

      {server.description && (
        <div className="text-[10px] text-text-secondary leading-relaxed mb-2 line-clamp-2">{server.description}</div>
      )}

      <div className="flex items-center gap-1 mb-2 flex-wrap">
        <code className="text-[9px] bg-surface-3 px-1.5 py-0.5 rounded text-text-secondary font-mono">{server.command}</code>
        {server.args.length > 0 && (
          <code className="text-[9px] bg-surface-3 px-1.5 py-0.5 rounded text-text-muted font-mono truncate max-w-[160px]">
            {server.args.join(" ")}
          </code>
        )}
        {server.env && Object.keys(server.env).length > 0 && (
          <span className="text-[9px] text-text-muted">🔑 {Object.keys(server.env).length} env</span>
        )}
        {server.tools.length > 0 && (
          <span className="text-[9px] text-text-muted">🛠 {server.tools.length} tool</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(server)}
          className="text-[9px] px-2 py-1 rounded-lg border border-border bg-surface-2 text-text-muted hover:text-accent hover:border-accent/30 transition-colors"
        >
          ✏ Uredi
        </button>
        <button
          onClick={() => onDelete(server.id)}
          className="text-[9px] px-2 py-1 rounded-lg border border-border bg-surface-2 text-text-muted hover:text-red-400 hover:border-red-500/30 transition-colors"
        >
          🗑 Obriši
        </button>
        {!server.isEnabled && (
          <span className="text-[9px] text-text-muted/50 ml-auto">Onemogućen</span>
        )}
      </div>
    </div>
  );
}

// ── Preset Card ──

function PresetCard({
  preset,
  installed,
  onInstall,
}: {
  preset: McpPreset;
  installed: boolean;
  onInstall: (p: McpPreset) => void;
}) {
  const cat = MCP_CATEGORIES.find((c) => c.id === preset.category);

  return (
    <div className="rounded-xl border border-border bg-surface p-3 hover:border-border-light transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{preset.icon}</span>
          <div>
            <div className="text-[12px] font-semibold text-text">{preset.name}</div>
            {cat && (
              <span className="text-[9px] text-text-muted">{cat.icon} {cat.label}</span>
            )}
          </div>
        </div>
        {installed && (
          <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">Instaliran</span>
        )}
      </div>

      <div className="text-[10px] text-text-secondary leading-relaxed mb-2 line-clamp-2">{preset.description}</div>

      <div className="flex items-center gap-1 mb-2 flex-wrap">
        <code className="text-[9px] bg-surface-3 px-1.5 py-0.5 rounded text-text-secondary font-mono">{preset.command}</code>
        {preset.args.length > 0 && (
          <code className="text-[9px] bg-surface-3 px-1.5 py-0.5 rounded text-text-muted font-mono truncate max-w-[160px]">
            {preset.args.join(" ")}
          </code>
        )}
        {preset.env && Object.keys(preset.env).length > 0 && (
          <span className="text-[9px] text-text-muted">🔑 {Object.keys(preset.env).length} env</span>
        )}
      </div>

      <button
        onClick={() => onInstall(preset)}
        disabled={installed}
        className={`text-[10px] w-full py-1.5 rounded-lg font-medium transition-colors ${
          installed
            ? "bg-surface-2 text-text-muted cursor-default"
            : "bg-accent/10 text-accent hover:bg-accent/20"
        }`}
      >
        {installed ? "✓ Instaliran" : "+ Instaliraj"}
      </button>
    </div>
  );
}

// ── Server Form Modal ──

function ServerFormModal({
  server,
  onSave,
  onClose,
}: {
  server: McpServer | null;
  onSave: (data: {
    name: string;
    description?: string;
    icon?: string;
    category: string;
    command: string;
    args: string[];
    env: Record<string, string>;
    tools: string[];
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(server?.name || "");
  const [description, setDescription] = useState(server?.description || "");
  const [icon, setIcon] = useState(server?.icon || "🔌");
  const [category, setCategory] = useState(server?.category || "custom");
  const [command, setCommand] = useState(server?.command || "npx");
  const [argsStr, setArgsStr] = useState(server?.args?.join(" ") || "");
  const [envKeys, setEnvKeys] = useState<string[]>(
    server?.env ? Object.keys(server.env) : []
  );
  const [envVals, setEnvVals] = useState<Record<string, string>>(server?.env || {});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !command.trim()) return;
    setSaving(true);
    try {
      const args = argsStr
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const env: Record<string, string> = {};
      for (const k of envKeys) {
        if (k.trim()) env[k.trim()] = envVals[k] || "";
      }
      await onSave({ name: name.trim(), description: description.trim() || undefined, icon, category, command: command.trim(), args, env, tools: [] });
    } finally {
      setSaving(false);
    }
  };

  const addEnvKey = () => {
    const key = `ENV_${envKeys.length + 1}`;
    setEnvKeys((prev) => [...prev, key]);
    setEnvVals((prev) => ({ ...prev, [key]: "" }));
  };

  const icons = ["🔌", "🔥", "🗄", "📖", "📁", "🐙", "💬", "🎭", "🧠", "🕷", "🔗", "🤖", "📡", "🛠", "⚡"];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-[13px] font-semibold text-text">
            {server ? "Uredi MCP Server" : "Dodaj MCP Server"}
          </span>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="text-[10px] text-text-muted block mb-1">Naziv *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50"
              placeholder="Firecrawl MCP"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] text-text-muted block mb-1">Opis</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50 resize-none h-16"
              placeholder="Šta ovaj MCP server radi..."
            />
          </div>

          {/* Icon + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Ikona</label>
              <div className="flex flex-wrap gap-1">
                {icons.map((ic) => (
                  <button
                    key={ic}
                    onClick={() => setIcon(ic)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg text-sm transition-colors ${
                      icon === ic ? "bg-accent/20 border border-accent/40" : "bg-surface-3 border border-border hover:border-accent/20"
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Kategorija</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50"
              >
                {MCP_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Command */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Komanda *</label>
              <select
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50"
              >
                <option value="npx">npx</option>
                <option value="uvx">uvx</option>
                <option value="docker">docker</option>
                <option value="node">node</option>
                <option value="python">python</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Argumenti</label>
              <input
                type="text"
                value={argsStr}
                onChange={(e) => setArgsStr(e.target.value)}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50 font-mono"
                placeholder="@mendable/firecrawl-mcp"
              />
            </div>
          </div>

          {/* Env vars */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-text-muted">Env varijable</label>
              <button
                onClick={addEnvKey}
                className="text-[10px] text-accent hover:underline"
              >
                + Dodaj
              </button>
            </div>
            <div className="space-y-1.5">
              {envKeys.map((key) => (
                <div key={key} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => {
                      const oldKey = key;
                      const newKey = e.target.value;
                      setEnvKeys((prev) => prev.map((k) => k === oldKey ? newKey : k));
                      setEnvVals((prev) => {
                        const newVals = { ...prev };
                        newVals[newKey] = newVals[oldKey] || "";
                        delete newVals[oldKey];
                        return newVals;
                      });
                    }}
                    className="flex-1 bg-surface-3 border border-border rounded-lg px-2 py-1 text-[11px] text-text font-mono focus:outline-none focus:border-accent/50"
                    placeholder="VAR_NAME"
                  />
                  <input
                    type="text"
                    value={envVals[key] || ""}
                    onChange={(e) => setEnvVals((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="flex-[2] bg-surface-3 border border-border rounded-lg px-2 py-1 text-[11px] text-text font-mono focus:outline-none focus:border-accent/50"
                    placeholder="vrijednost"
                  />
                  <button
                    onClick={() => {
                      setEnvKeys((prev) => prev.filter((k) => k !== key));
                      setEnvVals((prev) => {
                        const newVals = { ...prev };
                        delete newVals[key];
                        return newVals;
                      });
                    }}
                    className="text-[10px] text-red-400 hover:text-red-300 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="text-[11px] text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-surface-2"
          >
            Otkaži
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || !command.trim() || saving}
            className="text-[11px] text-white bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg transition-colors"
          >
            {saving ? "Čuvanje..." : server ? "Sačuvaj" : "Dodaj"}
          </button>
        </div>
      </div>
    </div>
  );
}
