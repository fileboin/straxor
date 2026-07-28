import { useState, useCallback, useEffect } from "react";
import {
  listRuntimes, switchRuntime, checkRuntimeHealth, restartRuntime, installRuntime,
  listMCPServers, addMCPServer, removeMCPServer,
  type RuntimeDefinition, type RuntimeHealthStatus,
  type MCPServerConfig,
  RUNTIME_ICONS, RUNTIME_COLORS, HEALTH_COLORS, HEALTH_DOTS,
} from "../../lib/runtime-manager.js";

interface Props {
  machineId: string | null;
  onClose: () => void;
}

export default function RuntimeSelector({ machineId, onClose }: Props) {
  const [runtimes, setRuntimes] = useState<RuntimeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string>("opencode");
  const [switching, setSwitching] = useState(false);
  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([]);
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [mcpName, setMcpName] = useState("");
  const [mcpCommand, setMcpCommand] = useState("");
  const [mcpArgs, setMcpArgs] = useState("");
  const [expandedRuntime, setExpandedRuntime] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rts] = await Promise.all([listRuntimes()]);
      setRuntimes(rts);
      const active = rts.find((r) => r.isActive);
      if (active) setActiveId(active.id);
      if (machineId) {
        const mcp = await listMCPServers(machineId);
        setMcpServers(mcp);
      }
    } catch { /* ok */ }
    setLoading(false);
  }, [machineId]);

  useEffect(() => { load(); }, [load]);

  const handleSwitch = useCallback(async (id: string) => {
    if (id === activeId) return;
    setSwitching(true);
    try {
      await switchRuntime(id as any);
      setActiveId(id);
      setRuntimes((prev) => prev.map((r) => ({ ...r, isActive: r.id === id })));
    } catch { /* ok */ }
    setSwitching(false);
  }, [activeId]);

  const handleHealthCheck = useCallback(async (id: string) => {
    if (!machineId) return;
    try {
      const health = await checkRuntimeHealth(machineId, id as any);
      setRuntimes((prev) => prev.map((r) => r.id === id ? { ...r, health } : r));
    } catch { /* ok */ }
  }, [machineId]);

  const handleRestart = useCallback(async (id: string) => {
    if (!machineId) return;
    try {
      const health = await restartRuntime(machineId, id as any);
      setRuntimes((prev) => prev.map((r) => r.id === id ? { ...r, health } : r));
    } catch { /* ok */ }
  }, [machineId]);

  const handleInstall = useCallback(async (id: string) => {
    if (!machineId) return;
    try {
      await installRuntime(machineId, id as any);
      setRuntimes((prev) => prev.map((r) => r.id === id ? { ...r, isInstalled: true } : r));
    } catch { /* ok */ }
  }, [machineId]);

  const handleAddMcp = useCallback(async () => {
    if (!machineId || !mcpName || !mcpCommand) return;
    const args = mcpArgs.split(/\s+/).filter(Boolean);
    const config: MCPServerConfig = {
      id: mcpName.toLowerCase().replace(/\s+/g, "-"),
      name: mcpName,
      command: mcpCommand,
      args: args.length > 0 ? args : undefined,
      isEnabled: true,
    };
    try {
      await addMCPServer(machineId, activeId as any, config);
      setMcpServers((prev) => [...prev, config]);
      setShowMcpForm(false);
      setMcpName("");
      setMcpCommand("");
      setMcpArgs("");
    } catch { /* ok */ }
  }, [machineId, activeId, mcpName, mcpCommand, mcpArgs]);

  const handleRemoveMcp = useCallback(async (serverId: string) => {
    if (!machineId) return;
    try {
      await removeMCPServer(machineId, serverId, activeId as any);
      setMcpServers((prev) => prev.filter((s) => s.id !== serverId));
    } catch { /* ok */ }
  }, [machineId, activeId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚙</span>
            <span className="text-[13px] font-semibold text-text">Runtime Manager</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
              {runtimes.filter((r) => r.isEnabled).length} dostupno
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={load} className="text-[11px] text-text-muted hover:text-text px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors">↻</button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center text-[11px] text-text-muted py-8">Učitavanje...</div>
          ) : (
            <>
              {/* Active runtime indicator */}
              <div className="p-3 rounded-xl border border-accent/30 bg-accent/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${RUNTIME_COLORS[activeId as keyof typeof RUNTIME_COLORS] || "text-text-muted"}`}>
                      {RUNTIME_ICONS[activeId as keyof typeof RUNTIME_ICONS] || "⚙"}
                    </span>
                    <div>
                      <div className="text-[11px] font-medium text-text">Aktivni runtime: {runtimes.find((r) => r.id === activeId)?.name || activeId}</div>
                      <div className="text-[9px] text-text-muted">Switchanje je instant — svi podaci ostaju sačuvani</div>
                    </div>
                  </div>
                  {machineId && (
                    <button
                      onClick={() => handleHealthCheck(activeId)}
                      className="text-[9px] text-accent hover:text-accent-light px-2 py-1 rounded hover:bg-accent/10 transition-colors"
                    >
                      Health Check
                    </button>
                  )}
                </div>
              </div>

              {/* Runtime cards */}
              {runtimes
                .sort((a, b) => {
                  if (a.id === activeId) return -1;
                  if (b.id === activeId) return 1;
                  if (a.isEnabled && !b.isEnabled) return -1;
                  if (!a.isEnabled && b.isEnabled) return 1;
                  return 0;
                })
                .map((rt) => {
                  const isActive = rt.id === activeId;
                  const healthStatus: RuntimeHealthStatus = rt.health?.status || "unknown";
                  const isExpanded = expandedRuntime === rt.id;

                  return (
                    <div
                      key={rt.id}
                      className={`rounded-xl border transition-all ${
                        isActive
                          ? "border-accent/50 bg-accent/5"
                          : rt.isEnabled
                          ? "border-border bg-surface-2/30 hover:border-border-light"
                          : "border-border/50 bg-surface-2/10 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-xl ${RUNTIME_COLORS[rt.id] || "text-text-muted"}`}>
                            {RUNTIME_ICONS[rt.id] || "⚙"}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] font-medium text-text">{rt.name}</span>
                              {isActive && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">AKTIVAN</span>
                              )}
                              {rt.version && (
                                <span className="text-[8px] px-1 py-0.5 rounded bg-surface-3 text-text-muted">v{rt.version}</span>
                              )}
                            </div>
                            <div className="text-[9px] text-text-muted mt-0.5">{rt.description}</div>
                            {/* Health indicator */}
                            {rt.health && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${HEALTH_DOTS[healthStatus]}`} />
                                <span className={`text-[8px] ${HEALTH_COLORS[healthStatus]}`}>
                                  {healthStatus === "healthy" ? "Zdrav" : healthStatus === "degraded" ? "Degradiran" : healthStatus === "down" ? "Down" : "Nepoznato"}
                                </span>
                                {rt.health.version && (
                                  <span className="text-[8px] text-text-muted">· v{rt.health.version}</span>
                                )}
                                {rt.health.uptime && (
                                  <span className="text-[8px] text-text-muted">· {rt.health.uptime}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!rt.isEnabled ? (
                            <span className="text-[9px] text-text-muted px-2 py-1">Uskoro</span>
                          ) : !rt.isInstalled ? (
                            <button
                              onClick={() => handleInstall(rt.id)}
                              className="text-[9px] text-white bg-accent hover:bg-accent-light px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Instaliraj
                            </button>
                          ) : isActive ? (
                            <span className="text-[9px] text-accent px-2 py-1">Odabran</span>
                          ) : (
                            <button
                              onClick={() => handleSwitch(rt.id)}
                              disabled={switching}
                              className="text-[9px] text-text-secondary border border-border hover:border-accent/50 hover:text-accent px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {switching ? "..." : "Odaberi"}
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedRuntime(isExpanded ? null : rt.id)}
                            className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors text-[10px]"
                          >
                            {isExpanded ? "▴" : "▾"}
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && rt.isEnabled && (
                        <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-2">
                          <div className="flex gap-2">
                            {machineId && (
                              <>
                                <button
                                  onClick={() => handleHealthCheck(rt.id)}
                                  className="text-[9px] text-text-muted border border-border hover:border-accent/30 hover:text-accent px-2 py-1 rounded transition-colors"
                                >
                                  ↻ Health
                                </button>
                                <button
                                  onClick={() => handleRestart(rt.id)}
                                  className="text-[9px] text-text-muted border border-border hover:border-yellow-500/30 hover:text-yellow-400 px-2 py-1 rounded transition-colors"
                                >
                                  ⟳ Restart
                                </button>
                              </>
                            )}
                            {rt.repoUrl && (
                              <a
                                href={rt.repoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-text-muted border border-border hover:border-blue-500/30 hover:text-blue-400 px-2 py-1 rounded transition-colors"
                              >
                                GitHub ↗
                              </a>
                            )}
                          </div>
                          {rt.health && (
                            <div className="grid grid-cols-3 gap-2 text-[9px]">
                              <div className="p-1.5 rounded bg-surface-3">
                                <div className="text-text-muted">Status</div>
                                <div className={`font-medium ${HEALTH_COLORS[healthStatus]}`}>
                                  {healthStatus === "healthy" ? "Zdrav" : healthStatus === "degraded" ? "Degradiran" : healthStatus === "down" ? "Down" : "Nepoznato"}
                                </div>
                              </div>
                              <div className="p-1.5 rounded bg-surface-3">
                                <div className="text-text-muted">Port</div>
                                <div className="font-medium text-text">{rt.health.port || "—"}</div>
                              </div>
                              <div className="p-1.5 rounded bg-surface-3">
                                <div className="text-text-muted">PID</div>
                                <div className="font-medium text-text">{rt.health.pid || "—"}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

              {/* MCP Servers section */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🔌</span>
                    <span className="text-[12px] font-medium text-text">MCP Serveri</span>
                    <span className="text-[9px] text-text-muted">({mcpServers.length})</span>
                  </div>
                  {machineId && activeId && (
                    <button
                      onClick={() => setShowMcpForm(!showMcpForm)}
                      className="text-[9px] text-accent hover:text-accent-light px-2 py-1 rounded hover:bg-accent/10 transition-colors"
                    >
                      {showMcpForm ? "Otkaži" : "+ Dodaj"}
                    </button>
                  )}
                </div>

                {showMcpForm && (
                  <div className="p-3 rounded-xl border border-accent/30 bg-accent/5 space-y-2 mb-3">
                    <input
                      type="text"
                      value={mcpName}
                      onChange={(e) => setMcpName(e.target.value)}
                      placeholder="Naziv servera"
                      className="w-full bg-surface-3 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
                    />
                    <input
                      type="text"
                      value={mcpCommand}
                      onChange={(e) => setMcpCommand(e.target.value)}
                      placeholder="Komanda (npr. npx @modelcontextprotocol/server-filesystem)"
                      className="w-full bg-surface-3 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
                    />
                    <input
                      type="text"
                      value={mcpArgs}
                      onChange={(e) => setMcpArgs(e.target.value)}
                      placeholder="Args (razdvojeni razmakom)"
                      className="w-full bg-surface-3 border border-border rounded-lg px-2.5 py-1.5 text-[11px] text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50"
                    />
                    <button
                      onClick={handleAddMcp}
                      className="w-full py-1.5 text-[10px] font-medium text-white bg-accent hover:bg-accent-light rounded-lg transition-colors"
                    >
                      Dodaj MCP Server
                    </button>
                  </div>
                )}

                {mcpServers.length === 0 ? (
                  <div className="text-center text-[10px] text-text-muted py-4">Nema MCP servera</div>
                ) : (
                  <div className="space-y-1.5">
                    {mcpServers.map((s) => (
                      <div key={s.id} className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-surface-2/20">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.isEnabled ? "bg-green-500" : "bg-gray-500"}`} />
                          <div className="min-w-0">
                            <div className="text-[11px] text-text truncate">{s.name}</div>
                            <div className="text-[8px] text-text-muted font-mono truncate">{s.command} {s.args?.join(" ") || ""}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMcp(s.id)}
                          className="text-[9px] text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded hover:bg-red-500/10 shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
