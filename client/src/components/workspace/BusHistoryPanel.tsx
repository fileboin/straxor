import { useMemo, useState } from "react";
import type { AgentBusEnvelope } from "../../lib/agent-bus.js";

interface Props {
  open: boolean;
  events: AgentBusEnvelope[];
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  review_pending: "text-yellow-400 border-yellow-500/20 bg-yellow-500/10",
  warning_received: "text-red-400 border-red-500/20 bg-red-500/10",
  auto_run_executed: "text-green-400 border-green-500/20 bg-green-500/10",
  loop_guarded: "text-orange-400 border-orange-500/20 bg-orange-500/10",
};

export default function BusHistoryPanel({ open, events, onClose }: Props) {
  const [filter, setFilter] = useState<"all" | "ask" | "agent">("all");
  const grouped = useMemo(() => {
    const filtered = events.filter((event) => filter === "all" || event.to === filter || event.from === filter);
    const map = new Map<string, AgentBusEnvelope[]>();
    for (const event of filtered) {
      const key = event.chainId || "no-chain";
      const list = map.get(key) || [];
      list.push(event);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([chainId, chainEvents]) => ({
      chainId,
      events: chainEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    }));
  }, [events, filter]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-5xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <div className="text-sm font-semibold text-text">Bus history</div>
            <div className="text-[11px] text-text-muted mt-0.5">Kompletna istorija komunikacije između panela grupisana po chainId</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "ask" | "agent")}
              className="px-2 py-1.5 rounded-lg border border-border bg-surface-2 text-[11px] text-text"
            >
              <option value="all">Svi paneli</option>
              <option value="ask">Ask</option>
              <option value="agent">Agent</option>
            </select>
            <button onClick={onClose} className="text-text-muted hover:text-text text-sm transition-colors">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {grouped.length === 0 ? (
            <div className="text-center py-10 text-text-muted text-sm">Nema bus događaja za prikaz.</div>
          ) : (
            grouped.map((group) => (
              <div key={group.chainId} className="rounded-2xl border border-border bg-surface-2/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-surface/60 flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-semibold text-text">Chain {group.chainId}</div>
                    <div className="text-[10px] text-text-muted">{group.events.length} događaja</div>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {group.events.map((event) => {
                    const statusClass = STATUS_COLORS[event.status || ""] || "text-text-muted border-border bg-surface";
                    return (
                      <div key={event.id} className="px-4 py-3 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-medium text-text">{event.from} → {event.to}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-surface text-text-muted">{event.action}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusClass}`}>{event.status || "unknown"}</span>
                          <span className="text-[10px] text-text-muted">hop {event.hopCount ?? 0}</span>
                          <span className="text-[10px] text-text-muted ml-auto">{new Date(event.createdAt).toLocaleString()}</span>
                        </div>
                        {event.warning && (
                          <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-2 whitespace-pre-wrap">{event.warning}</div>
                        )}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <div className="rounded-xl border border-border bg-surface px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Content</div>
                            <div className="text-[11px] text-text whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{event.content}</div>
                          </div>
                          <div className="rounded-xl border border-border bg-surface px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Prompt</div>
                            <div className="text-[11px] text-text whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{event.prompt}</div>
                          </div>
                        </div>
                        {event.metadata && (
                          <div className="rounded-xl border border-border bg-surface px-3 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Metadata</div>
                            <pre className="text-[10px] text-text-muted whitespace-pre-wrap break-words">{JSON.stringify(event.metadata, null, 2)}</pre>
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
      </div>
    </div>
  );
}
