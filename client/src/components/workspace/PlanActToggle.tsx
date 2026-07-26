export type PlanActMode = "plan" | "act";

interface Props {
  mode: PlanActMode;
  onChange: (mode: PlanActMode) => void;
}

export default function PlanActToggle({ mode, onChange }: Props) {
  return (
    <div className="flex items-center rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => onChange("plan")}
        className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
          mode === "plan"
            ? "bg-accent-dim text-accent"
            : "bg-transparent text-text-muted hover:text-text-secondary"
        }`}
      >
        Plan
      </button>
      <button
        onClick={() => onChange("act")}
        className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
          mode === "act"
            ? "bg-accent-dim text-accent"
            : "bg-transparent text-text-muted hover:text-text-secondary"
        }`}
      >
        Act
      </button>
    </div>
  );
}
