import type { Session } from "../../lib/sessions.js";

interface Props {
  sessions: Session[];
  currentSessionId: string | null;
  onSelect: (session: Session) => void;
  onNewSession: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Upravo sad";
  if (diffMin < 60) return `Prije ${diffMin} min`;
  if (diffH < 24) return `Prije ${diffH} sat${diffH > 1 ? "i" : ""}`;
  if (diffD < 7) return `Prije ${diffD} dan${diffD > 1 ? "a" : ""}`;
  return d.toLocaleDateString("hr-HR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function SessionPicker({
  sessions,
  currentSessionId,
  onSelect,
  onNewSession,
  onDelete,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-[500px] mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-text">📋 Prethodne sesije</span>
            <span className="text-[10px] text-text-muted bg-surface-2 px-1.5 py-0.5 rounded">
              {sessions.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* New session button */}
        <div className="px-3 pt-3 shrink-0">
          <button
            onClick={onNewSession}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] px-3 py-2 rounded-lg border border-dashed border-accent/30 bg-accent/5 text-accent hover:bg-accent/10 transition-colors font-medium"
          >
            + Nova sesija
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {sessions.length === 0 && (
            <div className="text-center py-8 text-text-muted text-[11px]">
              Nema prethodnih sesija
            </div>
          )}

          {sessions.map((session) => {
            const isCurrent = session.id === currentSessionId;
            return (
              <div
                key={session.id}
                className={`group rounded-lg border transition-colors cursor-pointer ${
                  isCurrent
                    ? "border-accent/40 bg-accent/5"
                    : "border-border hover:border-border-light hover:bg-surface-2/50"
                }`}
                onClick={() => onSelect(session)}
              >
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-text truncate">
                        {session.title || "Session"}
                      </span>
                      {isCurrent && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded border border-accent/30 bg-accent/10 text-accent">
                          AKTIVNA
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-text-muted">
                        {formatDate(session.updatedAt)}
                      </span>
                      {session.status && (
                        <span className="text-[8px] text-text-muted">
                          • {session.status}
                        </span>
                      )}
                    </div>
                    {session.lastTask && (
                      <div className="text-[9px] text-text-muted mt-0.5 truncate">
                        {session.lastTask.slice(0, 80)}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Obrisati sesiju?")) onDelete(session.id);
                    }}
                    className="text-[9px] text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded hover:bg-red-500/10 shrink-0"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0">
          <span className="text-[9px] text-text-muted">
            Sesije se automatski spremaju
          </span>
          <button
            onClick={onClose}
            className="text-[11px] text-text-muted hover:text-text px-3 py-1 rounded-lg hover:bg-surface-2 transition-colors"
          >
            Zatvori
          </button>
        </div>
      </div>
    </div>
  );
}
