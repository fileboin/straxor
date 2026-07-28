import { useState, useEffect, useCallback } from "react";
import {
  fetchKanban,
  pauseSession,
  resumeSession,
  changeSessionModel,
  changeSessionRuntime,
  type KanbanData,
  type KanbanCard,
  type KanbanColumn,
} from "../../lib/kanban";

interface Props {
  onClose: () => void;
  onNavigate: (sessionId: string, machineId: string) => void;
  runtimes: { id: string; name: string }[];
}

const COLUMN_LABELS: Record<KanbanColumn, string> = {
  active: "Aktivne",
  waiting: "Čekaju",
  paused: "Pauzirane",
  error: "Greške",
  completed: "Završene",
};

const COLUMN_COLORS: Record<KanbanColumn, string> = {
  active: "border-l-green-500",
  waiting: "border-l-yellow-500",
  paused: "border-l-blue-500",
  error: "border-l-red-500",
  completed: "border-l-gray-500",
};

const COLUMN_BG: Record<KanbanColumn, string> = {
  active: "bg-green-500/5",
  waiting: "bg-yellow-500/5",
  paused: "bg-blue-500/5",
  error: "bg-red-500/5",
  completed: "bg-gray-500/5",
};

const TYPE_ICONS: Record<string, string> = {
  session: "🤖",
  deployment: "🚀",
  machine: "🖥",
};

export default function KanbanCommandCenter({ onClose, onNavigate, runtimes }: Props) {
  const [data, setData] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeColumn, setActiveColumn] = useState<KanbanColumn | "all">("all");
  const [actionMsg, setActionMsg] = useState("");
  const [modelModal, setModelModal] = useState<{ card: KanbanCard } | null>(null);
  const [runtimeModal, setRuntimeModal] = useState<{ card: KanbanCard } | null>(null);
  const [editProvider, setEditProvider] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editRuntime, setEditRuntime] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await fetchKanban();
      setData(d);
    } catch (err: any) {
      setError(err.message || "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(""), 2500);
  };

  const handlePause = async (card: KanbanCard) => {
    try {
      await pauseSession(card.id);
      flash("Pauzirano");
      load();
    } catch (err: any) {
      flash(`Greška: ${err.message}`);
    }
  };

  const handleResume = async (card: KanbanCard) => {
    try {
      await resumeSession(card.id);
      flash("Nastavljeno");
      load();
    } catch (err: any) {
      flash(`Greška: ${err.message}`);
    }
  };

  const handleOpenModel = (card: KanbanCard) => {
    setEditProvider(card.model?.split("/")[0] || "anthropic");
    setEditModel(card.model || "claude-sonnet-4");
    setModelModal({ card });
  };

  const handleSaveModel = async () => {
    if (!modelModal) return;
    try {
      await changeSessionModel(modelModal.card.id, editProvider, editModel);
      flash("Model promijenjen");
      setModelModal(null);
      load();
    } catch (err: any) {
      flash(`Greška: ${err.message}`);
    }
  };

  const handleOpenRuntime = (card: KanbanCard) => {
    setEditRuntime(card.runtimeId || "");
    setRuntimeModal({ card });
  };

  const handleSaveRuntime = async () => {
    if (!runtimeModal) return;
    try {
      await changeSessionRuntime(runtimeModal.card.id, editRuntime);
      flash("Runtime promijenjen");
      setRuntimeModal(null);
      load();
    } catch (err: any) {
      flash(`Greška: ${err.message}`);
    }
  };

  const columns: KanbanColumn[] = ["active", "waiting", "paused", "error", "completed"];
  const visible = activeColumn === "all" ? columns : [activeColumn];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-6xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <span className="text-lg">📋</span>
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-text">Komandni Centar</h1>
              <p className="text-[10px] text-text-muted">
                {data ? `${data.summary.total} stavki` : "Učitavanje..."}
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

        {/* Summary bar */}
        {data && (
          <div className="flex items-center gap-3 px-5 py-2 border-b border-border/50 bg-surface-2/20 shrink-0 overflow-x-auto">
            {columns.map((col) => (
              <button
                key={col}
                onClick={() => setActiveColumn(activeColumn === col ? "all" : col)}
                className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg transition-colors ${
                  activeColumn === col
                    ? "bg-accent/15 text-accent"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    col === "active" ? "bg-green-500" :
                    col === "waiting" ? "bg-yellow-500" :
                    col === "paused" ? "bg-blue-500" :
                    col === "error" ? "bg-red-500" :
                    "bg-gray-500"
                  }`}
                />
                {COLUMN_LABELS[col]}
                <span className="text-text-muted/60">({data.summary[col]})</span>
              </button>
            ))}
            {activeColumn !== "all" && (
              <button
                onClick={() => setActiveColumn("all")}
                className="text-[10px] text-text-muted hover:text-text px-2"
              >
                ✕ sve
              </button>
            )}
          </div>
        )}

        {/* Board */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[11px] text-text-muted">
              Učitavanje...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-32 text-[11px] text-red-400">
              <span className="text-2xl mb-2">⚠</span>
              {error}
              <button onClick={load} className="mt-2 text-accent hover:underline">Pokušaj ponovo</button>
            </div>
          ) : (
            <div className={`grid gap-4 ${visible.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"}`}>
              {visible.map((col) => {
                const cards = data?.columns[col] || [];
                return (
                  <div key={col} className={`rounded-xl border border-border ${COLUMN_BG[col]} p-3`}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          col === "active" ? "bg-green-500" :
                          col === "waiting" ? "bg-yellow-500" :
                          col === "paused" ? "bg-blue-500" :
                          col === "error" ? "bg-red-500" :
                          "bg-gray-500"
                        }`} />
                        <span className="text-[11px] font-semibold text-text">{COLUMN_LABELS[col]}</span>
                        <span className="text-[10px] text-text-muted">({cards.length})</span>
                      </div>
                    </div>
                    {cards.length === 0 ? (
                      <div className="text-[10px] text-text-muted/50 text-center py-6 italic">
                        Prazno
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cards.map((card) => (
                          <CardItem
                            key={`${card.type}-${card.id}`}
                            card={card}
                            onPause={handlePause}
                            onResume={handleResume}
                            onChangeModel={handleOpenModel}
                            onChangeRuntime={handleOpenRuntime}
                            onNavigate={onNavigate}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-border shrink-0">
          <div className="text-[9px] text-text-muted">
            Straxor Komandni Centar · Automatsko osvežavanje
          </div>
          <button
            onClick={load}
            className="text-[10px] text-accent hover:underline"
          >
            ↻ Osveži
          </button>
        </div>
      </div>

      {/* Model change modal */}
      {modelModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModelModal(null)}>
          <div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[13px] font-semibold text-text mb-3">Promijeni model za</h2>
            <p className="text-[11px] text-text-muted mb-4 truncate">{modelModal.card.title}</p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-text-muted block mb-1">Provider</label>
                <select
                  value={editProvider}
                  onChange={(e) => setEditProvider(e.target.value)}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50"
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="google">Google</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-text-muted block mb-1">Model</label>
                <input
                  type="text"
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                  className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50"
                  placeholder="claude-sonnet-4"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setModelModal(null)}
                  className="text-[11px] text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-surface-2"
                >
                  Otkaži
                </button>
                <button
                  onClick={handleSaveModel}
                  className="text-[11px] text-white bg-accent hover:bg-accent-light px-4 py-1.5 rounded-lg transition-colors"
                >
                  Sačuvaj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Runtime change modal */}
      {runtimeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setRuntimeModal(null)}>
          <div className="w-full max-w-sm mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[13px] font-semibold text-text mb-3">Promijeni runtime za</h2>
            <p className="text-[11px] text-text-muted mb-4 truncate">{runtimeModal.card.title}</p>
            <div>
              <label className="text-[10px] text-text-muted block mb-1">Runtime</label>
              <select
                value={editRuntime}
                onChange={(e) => setEditRuntime(e.target.value)}
                className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-[12px] text-text focus:outline-none focus:border-accent/50"
              >
                {runtimes.length === 0 ? (
                  <option value="">Nema runtime-ova</option>
                ) : (
                  runtimes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))
                )}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-4">
              <button
                onClick={() => setRuntimeModal(null)}
                className="text-[11px] text-text-muted hover:text-text px-3 py-1.5 rounded-lg hover:bg-surface-2"
              >
                Otkaži
              </button>
              <button
                onClick={handleSaveRuntime}
                className="text-[11px] text-white bg-accent hover:bg-accent-light px-4 py-1.5 rounded-lg transition-colors"
              >
                Sačuvaj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card Item ──

function CardItem({
  card,
  onPause,
  onResume,
  onChangeModel,
  onChangeRuntime,
  onNavigate,
}: {
  card: KanbanCard;
  onPause: (c: KanbanCard) => void;
  onResume: (c: KanbanCard) => void;
  onChangeModel: (c: KanbanCard) => void;
  onChangeRuntime: (c: KanbanCard) => void;
  onNavigate: (sessionId: string, machineId: string) => void;
}) {
  const ago = timeAgo(card.updatedAt);
  const hasActions = card.actions.canPause || card.actions.canResume || card.actions.canChangeModel || card.actions.canChangeRuntime || card.actions.canRestart;

  const typeColor =
    card.type === "session" ? "text-green-400" :
    card.type === "deployment" ? "text-orange-400" :
    "text-blue-400";

  return (
    <div className="bg-surface border border-border rounded-xl p-3 hover:border-border-light transition-colors group">
      {/* Header */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-xs ${typeColor}`}>
            {TYPE_ICONS[card.type] || "📌"}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-text-muted font-medium">
            {card.type === "session" ? "Sesija" : card.type === "deployment" ? "Deploy" : "VPS"}
          </span>
        </div>
        <span className="text-[9px] text-text-muted/60 whitespace-nowrap">{ago}</span>
      </div>

      {/* Title */}
      <div className="text-[12px] font-semibold text-text truncate mb-0.5">{card.title}</div>

      {/* Description */}
      {card.description && (
        <div className="text-[10px] text-text-secondary leading-relaxed line-clamp-2 mb-1.5">{card.description}</div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-2">
        {card.projectName && (
          <span className="text-[9px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded">📁 {card.projectName}</span>
        )}
        {card.agentName && (
          <span className="text-[9px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded">🤖 {card.agentName}</span>
        )}
        {card.model && (
          <span className="text-[9px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded">🧠 {card.model}</span>
        )}
        {card.error && (
          <span className="text-[9px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded truncate max-w-[200px]" title={card.error}>
            ⚠ greška
          </span>
        )}
        {card.type === "session" && typeof card.metadata.todoCount === "number" && (
          <span className="text-[9px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded">
            📋 {card.metadata.completedTodos}/{card.metadata.todoCount}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className={`flex items-center gap-1 ${hasActions ? "" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
        {card.actions.canPause && (
          <button
            onClick={() => onPause(card)}
            className="text-[9px] px-2 py-1 rounded-lg border border-border bg-surface-2 text-text-muted hover:text-yellow-400 hover:border-yellow-500/30 transition-colors"
          >
            ⏸ Pauziraj
          </button>
        )}
        {card.actions.canResume && (
          <button
            onClick={() => onResume(card)}
            className="text-[9px] px-2 py-1 rounded-lg border border-border bg-surface-2 text-text-muted hover:text-green-400 hover:border-green-500/30 transition-colors"
          >
            ▶ Nastavi
          </button>
        )}
        {card.actions.canChangeModel && (
          <button
            onClick={() => onChangeModel(card)}
            className="text-[9px] px-2 py-1 rounded-lg border border-border bg-surface-2 text-text-muted hover:text-accent hover:border-accent/30 transition-colors"
          >
            🧠 Model
          </button>
        )}
        {card.actions.canChangeRuntime && (
          <button
            onClick={() => onChangeRuntime(card)}
            className="text-[9px] px-2 py-1 rounded-lg border border-border bg-surface-2 text-text-muted hover:text-purple-400 hover:border-purple-500/30 transition-colors"
          >
            ⚙ Runtime
          </button>
        )}
        {card.type === "session" && card.metadata.machineId && (
          <button
            onClick={() => onNavigate(card.id, card.metadata.machineId as string)}
            className="text-[9px] px-2 py-1 rounded-lg border border-border bg-surface-2 text-text-muted hover:text-green-400 hover:border-green-500/30 transition-colors ml-auto"
          >
            → Otvori
          </button>
        )}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "upravo";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
