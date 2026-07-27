import { useState } from "react";

export interface TodoStep {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "needs_review";
  diff?: string;
}

interface Props {
  steps: TodoStep[];
  onConfirm: (stepId: string) => void;
  onExpand?: (stepId: string) => void;
  loading?: boolean;
}

function StatusIcon({ status }: { status: TodoStep["status"] }) {
  switch (status) {
    case "completed":
      return <span className="text-green-500 text-[12px] shrink-0">✓</span>;
    case "in_progress":
      return <span className="text-accent-blue text-[12px] shrink-0 animate-pulse">●</span>;
    case "needs_review":
      return <span className="text-accent text-[12px] shrink-0">◉</span>;
    case "pending":
    default:
      return <span className="text-text-muted text-[12px] shrink-0">○</span>;
  }
}

function StepRow({
  step,
  onConfirm,
  onExpand,
}: {
  step: TodoStep;
  onConfirm: (id: string) => void;
  onExpand?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = !!step.diff;
  const isReviewable = step.status === "needs_review" || step.status === "completed";

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && onExpand) onExpand(step.id);
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-surface hover:bg-surface-2 transition-colors">
        <StatusIcon status={step.status} />
        <span
          className={`flex-1 text-[12px] leading-snug ${
            step.status === "completed" || step.status === "needs_review"
              ? "text-text"
              : step.status === "in_progress"
              ? "text-text"
              : "text-text-secondary"
          }`}
        >
          {step.content}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {isReviewable && (
            <button
              type="button"
              onClick={() => onConfirm(step.id)}
              className="text-[10px] px-2 py-0.5 rounded-md bg-accent-dim text-accent font-medium hover:bg-accent hover:text-white transition-colors"
            >
              Potvrdi
            </button>
          )}
          {(hasDiff || step.status === "needs_review") && (
            <button
              type="button"
              onClick={handleToggle}
              className="text-text-muted text-[10px] w-5 h-5 flex items-center justify-center rounded hover:bg-surface-3 transition-colors"
            >
              {expanded ? "▾" : "▸"}
            </button>
          )}
        </div>
      </div>
      {expanded && step.diff && (
        <div className="border-t border-border px-2.5 py-2 bg-surface">
          <pre className="text-[11px] font-mono text-text-secondary whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
            {step.diff.split("\n").map((line, i) => (
              <span
                key={i}
                className={
                  line.startsWith("+")
                    ? "text-green-400"
                    : line.startsWith("-")
                    ? "text-red-400"
                    : line.startsWith("@")
                    ? "text-accent-blue"
                    : ""
                }
              >
                {line}
                {"\n"}
              </span>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function TodoList({ steps, onConfirm, onExpand, loading }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (steps.length === 0) return null;

  const completed = steps.filter(
    (s) => s.status === "completed" || s.status === "needs_review"
  ).length;
  const total = steps.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="border-b border-border bg-surface shrink-0">
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-2 py-2 hover:bg-surface-2 transition-colors sm:px-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
            Koraci
          </span>
          <span className="text-[10px] text-text-muted">
            {completed}/{total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Progress bar */}
          <div className="w-16 h-1 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-text-muted w-8 text-right">
            {collapsed ? "▸" : "▾"}
          </span>
        </div>
      </button>

      {/* Steps */}
      {!collapsed && (
        <div className="px-2 pb-2 space-y-1">
          {steps.map((step) => (
            <StepRow
              key={step.id}
              step={step}
              onConfirm={onConfirm}
              onExpand={onExpand}
            />
          ))}
          {loading && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-text-muted">
              <span className="animate-pulse">●</span>
              Agent radi...
            </div>
          )}
          {!loading && steps.some((s) => s.status === "needs_review") && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-accent">
              <span className="animate-pulse">◉</span>
              Čeka tvoju potvrdu...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
