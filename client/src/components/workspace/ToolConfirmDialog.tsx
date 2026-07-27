import { TOOLS, RISK_COLORS, RISK_BG } from "../../lib/permissions.js";

interface Props {
  toolId: string;
  args: Record<string, unknown> | string;
  onAllow: () => void;
  onDeny: () => void;
}

export default function ToolConfirmDialog({ toolId, args, onAllow, onDeny }: Props) {
  const tool = TOOLS.find((t) => t.toolId === toolId);
  const argsStr = typeof args === "string" ? args : JSON.stringify(args, null, 2);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 text-sm">⚠</span>
            <h2 className="text-sm font-semibold text-text">Potvrda alata</h2>
          </div>
          <p className="text-[10px] text-text-muted mt-1">
            Agent želi da izvrši akciju koja zahtijeva tvoju dozvolu
          </p>
        </div>

        {/* Tool info */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-text">
              {tool?.label || toolId}
            </span>
            {tool && (
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${RISK_COLORS[tool.risk]} ${RISK_BG[tool.risk]}`}
              >
                {tool.risk}
              </span>
            )}
          </div>
          {tool && (
            <div className="text-[11px] text-text-muted">{tool.description}</div>
          )}

          {/* Args preview */}
          <div className="mt-2">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
              Argumenti
            </div>
            <pre className="px-2.5 py-2 bg-bg border border-border rounded-lg text-[10px] font-mono text-text-secondary whitespace-pre-wrap break-all max-h-32 overflow-y-auto leading-relaxed">
              {argsStr}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onDeny}
            className="flex-1 py-2 text-[11px] font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Odbij
          </button>
          <button
            onClick={onAllow}
            className="flex-1 py-2 text-[11px] font-medium rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
          >
            Dozvoli
          </button>
        </div>
      </div>
    </div>
  );
}
