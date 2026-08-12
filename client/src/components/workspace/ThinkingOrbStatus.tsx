import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { orbLabelFor } from "../../lib/thinking-orb.js";

interface ThinkingOrbStatusProps {
  state: OrbState | null;
  label?: string;
}

/**
 * Prominent "thinking" block shown while a panel is working. Mirrors the
 * thinking-orbs demo: a 64px orb (monochrome, theme-aware) beside a short
 * descriptive line that changes per state. Rendered only while the panel is
 * actively generating — hidden entirely when idle.
 */
export default function ThinkingOrbStatus({ state, label }: ThinkingOrbStatusProps) {
  if (!state) return null;
  const text = label || orbLabelFor(state);
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-surface-2 max-w-[85%] self-start"
      role="status"
      aria-live="polite"
    >
      <ThinkingOrb state={state} size={64} theme="auto" aria-label={text} />
      <span className="text-[13px] text-text-muted capitalize">{text}</span>
    </div>
  );
}
