import type { OrbState } from "thinking-orbs";

export const ORB_DEMO_LABELS: Record<OrbState, string> = {
  working: "Processing…",
  searching: "Reading your repository…",
  solving: "Analyzing your request…",
  listening: "Waiting for LLM…",
  connecting: "Connecting…",
  weaving: "Weaving…",
  composing: "Generating response…",
  breathing: "Thinking…",
  shaping: "Formatting result…",
};

export function orbLabelFor(state: OrbState): string {
  return ORB_DEMO_LABELS[state] ?? ORB_DEMO_LABELS.working;
}
