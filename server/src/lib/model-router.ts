// ── Model Orchestration Router ──
// Simplified difficulty router: analyzes a task and picks the best model the
// user has an API key for. Used when "Model orkestracija" is enabled per panel.

export type TaskDifficulty = "simple" | "moderate" | "complex";

const COMPLEX_MARKERS = [
  "refactor", "architecture", "database", "migration", "security", "optimiz",
  "perfekt", "kompleks", "složen", "cijeli", "full", "complete", "implement",
  "kreiraj", "napravi", "build", "deploy", "integrat", "debug", "pipeline",
  "docker", "typescript", "authentication", "auth", "multi-thread", "async",
  "algorithm", "kompletn", "end-to-end", "e2e", "monorepo", "scalab",
];

const SIMPLE_MARKERS = [
  "what", "how", "explain", "what is", "šta je", "kako", "objasni", "why",
  "zašto", "koliko", "how many", "how much", "define", "meaning", "hello",
  "hi", "zdravo", "thank", "hvala", "summarize", "sažmi", "resume",
];

export function classifyComplexity(text: string): TaskDifficulty {
  const lower = text.toLowerCase();
  const complexHits = COMPLEX_MARKERS.filter((m) => lower.includes(m)).length;
  const simpleHits = SIMPLE_MARKERS.filter((m) => lower.includes(m)).length;

  if (complexHits >= 2 || text.length > 500) return "complex";
  if (simpleHits >= 2 || text.length < 50) return "simple";
  return "moderate";
}

export interface ModelOption {
  providerId: string;
  modelId: string;
  reason: string;
}

// Priority-ordered ladder per difficulty tier.
const LADDER: Record<TaskDifficulty, ModelOption[]> = {
  simple: [
    { providerId: "anthropic", modelId: "claude-haiku-4-5", reason: "Najjeftinije za jednostavne upite" },
    { providerId: "openai", modelId: "gpt-4o-mini", reason: "Brzo i jeftino za jednostavne upite" },
    { providerId: "google", modelId: "gemini-2.0-flash", reason: "Brzo za jednostavne upite" },
    { providerId: "deepseek", modelId: "deepseek-v3", reason: "Jeftino za jednostavne upite" },
    { providerId: "opencode-zen", modelId: "opencode/deepseek-v4-flash-free", reason: "Besplatno za jednostavne upite" },
    { providerId: "opencode-zen", modelId: "opencode/big-pickle", reason: "Besplatno za jednostavne upite" },
  ],
  moderate: [
    { providerId: "anthropic", modelId: "claude-sonnet-5", reason: "Balans brzine i kvaliteta" },
    { providerId: "google", modelId: "gemini-2.5-flash", reason: "Balans brzine i kvaliteta" },
    { providerId: "openai", modelId: "gpt-4o", reason: "Pouzdan za srednje zadatke" },
    { providerId: "deepseek", modelId: "deepseek-coder", reason: "Dobar za kodiranje" },
    { providerId: "opencode-zen", modelId: "opencode/laguna-s-2.1-free", reason: "Besplatno za srednje zadatke" },
  ],
  complex: [
    { providerId: "anthropic", modelId: "claude-opus-5", reason: "Najsnažniji model za složene zadatke" },
    { providerId: "openai", modelId: "o3", reason: "Dubok reasoning za složene zadatke" },
    { providerId: "google", modelId: "gemini-2.5-pro", reason: "Napredni reasoning" },
    { providerId: "deepseek", modelId: "deepseek-r1", reason: "Dubok reasoning" },
  ],
};

export function pickModel(
  difficulty: TaskDifficulty,
  availableProviders: Set<string>,
  _thinking?: string
): ModelOption | null {
  for (const opt of LADDER[difficulty]) {
    if (availableProviders.has(opt.providerId)) return opt;
  }
  return null;
}
