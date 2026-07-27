import { useState, useEffect, useCallback } from "react";
import {
  TOOLS,
  RISK_COLORS,
  RISK_BG,
  CATEGORY_ICONS,
  type PermissionLevel,
  type PermissionConfig,
  fetchPermissions,
  savePermissions,
  getPermissionLabel,
  getPermissionColor,
  getPermissionBg,
} from "../../lib/permissions.js";

interface Props {
  onClose: () => void;
}

const LEVELS: PermissionLevel[] = ["always", "ask", "never"];

const CATEGORY_LABELS: Record<string, string> = {
  file: "Datoteke",
  command: "Komande",
  data: "Podaci",
  network: "Mreža",
  package: "Paketi",
};

export default function PermissionsPanel({ onClose }: Props) {
  const [config, setConfig] = useState<PermissionConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchPermissions();
    setConfig(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSetLevel = (toolId: string, level: PermissionLevel) => {
    setConfig((prev) => ({ ...prev, [toolId]: level }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePermissions(config);
      setSaved(true);
    } catch {}
    setSaving(false);
  };

  const handleReset = () => {
    const defaults: PermissionConfig = {};
    for (const tool of TOOLS) {
      defaults[tool.toolId] = "ask";
    }
    setConfig(defaults);
    setSaved(false);
  };

  const grouped = TOOLS.reduce(
    (acc, tool) => {
      if (!acc[tool.category]) acc[tool.category] = [];
      acc[tool.category].push(tool);
      return acc;
    },
    {} as Record<string, typeof TOOLS>
  );

  const totalAlways = Object.values(config).filter((v) => v === "always").length;
  const totalNever = Object.values(config).filter((v) => v === "never").length;
  const totalAsk = Object.values(config).filter((v) => v === "ask").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-[600px] max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-text">Dozvole alata</h2>
            <p className="text-[10px] text-text-muted mt-0.5">
              Kontroliši šta agent može da uradi bez pitanja
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border bg-transparent text-text-secondary hover:text-text hover:border-border-light transition-colors"
          >
            Zatvori
          </button>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surface-2/30">
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-green-400 font-medium">{totalAlways}</span>
            <span className="text-text-muted">auto</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-yellow-400 font-medium">{totalAsk}</span>
            <span className="text-text-muted">pitaj</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="text-red-400 font-medium">{totalNever}</span>
            <span className="text-text-muted">blokiraj</span>
          </div>
          <div className="flex-1" />
          {saved && (
            <span className="text-[10px] text-green-400">Spremljeno</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="text-center text-text-muted text-[11px] py-8">Učitavanje...</div>
          ) : (
            Object.entries(grouped).map(([category, tools]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs">{CATEGORY_ICONS[category]}</span>
                  <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                    {CATEGORY_LABELS[category] || category}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {tools.map((tool) => {
                    const level = config[tool.toolId] || "ask";
                    const isExpanded = expandedTool === tool.toolId;

                    return (
                      <div
                        key={tool.toolId}
                        className="rounded-lg border border-border overflow-hidden"
                      >
                        {/* Tool row */}
                        <div
                          className="flex items-center gap-3 px-3 py-2 bg-surface hover:bg-surface-2 transition-colors cursor-pointer"
                          onClick={() => setExpandedTool(isExpanded ? null : tool.toolId)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-medium text-text">
                                {tool.label}
                              </span>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${RISK_COLORS[tool.risk]} ${RISK_BG[tool.risk]}`}
                              >
                                {tool.risk}
                              </span>
                            </div>
                            <div className="text-[10px] text-text-muted mt-0.5">
                              {tool.description}
                            </div>
                          </div>

                          {/* Permission toggle */}
                          <div className="flex items-center gap-1 shrink-0">
                            {LEVELS.map((l) => (
                              <button
                                key={l}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetLevel(tool.toolId, l);
                                }}
                                className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors ${
                                  level === l
                                    ? getPermissionBg(l) + " " + getPermissionColor(l)
                                    : "border-border bg-transparent text-text-muted hover:text-text-secondary"
                                }`}
                                title={getPermissionLabel(l)}
                              >
                                {l === "always" ? "✓" : l === "ask" ? "?" : "✕"}
                              </button>
                            ))}
                          </div>

                          <span className="text-text-muted text-[10px]">
                            {isExpanded ? "▾" : "▸"}
                          </span>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-3 py-2 border-t border-border bg-surface-2/50">
                            <div className="text-[10px] text-text-muted mb-2">
                              Trenutno: <span className={getPermissionColor(level)}>{getPermissionLabel(level)}</span>
                            </div>
                            <div className="space-y-1 text-[10px] text-text-muted">
                              <div>
                                <span className="text-green-400">✓ Auto-odobri</span> — agent izvršava bez pitanja
                              </div>
                              <div>
                                <span className="text-yellow-400">? Pitaj me</span> — svaki put traži potvrdu
                              </div>
                              <div>
                                <span className="text-red-400">✕ Blokiraj</span> — agent nikad ne može izvršiti
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <button
            onClick={handleReset}
            className="px-2.5 py-1 text-[11px] rounded border border-border text-text-muted hover:text-text transition-colors"
          >
            Resetuj na "Pitaj me"
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-accent bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50"
          >
            {saving ? "Spremam..." : "Spremi dozvole"}
          </button>
        </div>
      </div>
    </div>
  );
}
