// ── Ollama (local LLM) helpers ──
// OpenCode connects DIRECTLY to a local Ollama instance over HTTP — no proxy,
// no FCC, no model rewriting. These helpers talk to the Ollama HTTP API
// (default http://localhost:11434) and pick a coding-oriented model.

export const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434";

// OpenCode's built-in `ollama` provider uses the OpenAI-compatible SDK and
// appends `/chat/completions` to the base URL. Ollama's OpenAI-compatible API
// lives under `/v1`, so the base URL OpenCode needs is `.../v1` (not the root
// `.../11434`, which would hit `/chat/completions` → 404).
export function ollamaOpenAiBaseUrl(baseUrl?: string): string {
  const base = (baseUrl || process.env.OLLAMA_BASE_URL || OLLAMA_DEFAULT_BASE_URL)
    .trim()
    .replace(/\/+$/, "");
  if (/\/v1\/?$/.test(base)) return base;
  return `${base}/v1`;
}

export interface OllamaModel {
  name: string;
  model?: string;
  size?: number;
  modified_at?: string;
}

// Coding models we prefer when present on the server, in order. These all
// support tool/function calling, which OpenCode (an agent) requires.
export const OLLAMA_CODING_MODEL_PREFERENCE = [
  "deepseek-coder",
  "deepseek-r1",
  "qwen-coder",
  "qwen2.5-coder",
  "qwen3-coder",
  "qwen2.5",
  "qwen3",
  "codellama",
  "codegemma",
  "deepseek-coder-v2",
  "llama3.1",
  "llama3.2",
  "llama3.3",
  "mistral",
  "gemma2",
  "gemma3",
];

// Model names/families known to NOT support tool calling. If every installed
// model falls in one of these (e.g. a bare `llama3` = 3.0), the agent cannot
// function, so we must NOT silently pick it — we return null and let the
// caller surface a clear "install a tool-capable model" message instead.
function supportsTools(name: string): boolean {
  const base = name.split(":")[0].toLowerCase(); // strip tag: llama3:latest -> llama3
  if (base === "llama3") return false; // llama 3.0 has no tool support
  if (base === "phi2") return false;
  if (/orca/.test(base)) return false;
  return true;
}

function normalizeBaseUrl(baseUrl?: string): string {
  const raw = (baseUrl || process.env.OLLAMA_BASE_URL || OLLAMA_DEFAULT_BASE_URL).trim();
  return raw.replace(/\/+$/, "");
}

async function getJSON<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function listOllamaModels(
  baseUrl?: string,
  timeoutMs = 4000,
): Promise<OllamaModel[]> {
  const base = normalizeBaseUrl(baseUrl);
  const data = await getJSON<{ models?: OllamaModel[] }>(`${base}/api/tags`, timeoutMs);
  return (data.models || []).filter((m) => !/embed/i.test(m.name || m.model || ""));
}

// Pick a coding model from the live Ollama tag list. Only returns models that
// support tool calling. Never silently falls back to a random non-tool model
// (that made agent turns fail with "does not support tools").
export function pickOllamaCodingModel(models: OllamaModel[]): string | null {
  const names = models
    .map((m) => (m.model || m.name || "").trim())
    .filter((n) => n && !/embed/i.test(n) && supportsTools(n));
  for (const preferred of OLLAMA_CODING_MODEL_PREFERENCE) {
    const exact = names.find((n) => n === preferred);
    if (exact) return exact;
    const prefixed = names.find((n) => n.startsWith(`${preferred}:`));
    if (prefixed) return prefixed;
    const contained = names.find((n) => n.includes(preferred));
    if (contained) return contained;
  }
  return names[0] || null;
}

export interface OllamaEchoResult {
  alive: boolean;
  baseUrl: string;
  modelCount: number;
  codingModel: string | null;
  models: string[];
  error?: string;
}

// "echo" test: hit /api/tags to prove the Ollama HTTP API is reachable, list
// the models and select the coding model. This is the live-connection probe.
export async function ollamaEchoTest(
  baseUrl?: string,
  timeoutMs = 5000,
): Promise<OllamaEchoResult> {
  const base = normalizeBaseUrl(baseUrl);
  try {
    const models = await listOllamaModels(base, timeoutMs);
    const names = models.map((m) => (m.model || m.name || "").trim()).filter(Boolean);
    return {
      alive: true,
      baseUrl: base,
      modelCount: names.length,
      codingModel: pickOllamaCodingModel(models),
      models: names,
    };
  } catch (err) {
    return {
      alive: false,
      baseUrl: base,
      modelCount: 0,
      codingModel: null,
      models: [],
      error: err instanceof Error ? err.message : "Ollama unreachable",
    };
  }
}
