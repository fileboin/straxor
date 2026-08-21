import type { OrbState } from "thinking-orbs";

export const ORB_DEMO_LABELS: Record<OrbState, string> = {
  working: "Radim…",
  searching: "Pretražujem kod…",
  solving: "Rešavam…",
  listening: "Čekam odgovor…",
  connecting: "Povezujem…",
  weaving: "Pripremam…",
  composing: "Generišem…",
  breathing: "Razmišljam…",
  shaping: "Oblikujem rezultat…",
};

export function orbLabelFor(state: OrbState): string {
  return ORB_DEMO_LABELS[state] ?? ORB_DEMO_LABELS.working;
}
