import type { ConnectionAdapter, ConnectionTestResult, ExecuteResult, ConfigField, ConnectionOperation } from "../core/types.js";

function makeAIAdapter(
  name: string,
  displayName: string,
  description: string,
  icon: string,
  baseUrl: string,
  modelField: ConfigField,
): ConnectionAdapter {
  return {
    name, displayName, category: "ai" as const, description, icon,
    authType: "api-key" as const,
    configSchema: [
      { key: "apiKey", label: "API Key", type: "password", required: true },
      modelField,
      { key: "baseUrl", label: "API URL", type: "url", required: false, defaultValue: baseUrl },
      { key: "maxTokens", label: "Max Tokens", type: "number", required: false, defaultValue: 4096 },
      { key: "temperature", label: "Temperature", type: "number", required: false, defaultValue: 0.7 },
    ],
    async testConnection(config: Record<string, unknown>) {
      const start = Date.now(); const c = config as any;
      try {
        const r = await fetch(`${c.baseUrl || baseUrl}/v1/models`, { headers: { Authorization: `Bearer ${c.apiKey}` } });
        return { success: r.ok, latency: Date.now() - start, message: r.ok ? "Connected" : `HTTP ${r.status}`, details: r.ok ? await r.json() : undefined };
      } catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
    },
    async execute(_op: string, config: Record<string, unknown>, payload?: unknown) {
      const start = Date.now(); const c = config as any;
      const p = payload as any;
      try {
        const r = await fetch(`${c.baseUrl || baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: c.model || "gpt-4o",
            messages: p?.messages || [{ role: "user", content: p?.prompt || "Hello" }],
            max_tokens: c.maxTokens || 4096,
            temperature: c.temperature || 0.7,
          }),
        });
        return { success: r.ok, data: await r.json(), duration: Date.now() - start, statusCode: r.status };
      } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
    },
    getOperations(): ConnectionOperation[] { return [
      { id: "chat", name: "Chat Completion", description: "Send a chat completion request", inputSchema: [], outputSchema: [] },
      { id: "list-models", name: "List Models", description: "List available models", inputSchema: [], outputSchema: [] },
    ]; },
  };
}

export function registerAll(register: (adapter: ConnectionAdapter) => void): void {
  register(makeAIAdapter("openai", "OpenAI", "OpenAI API — GPT-4o, GPT-4, GPT-3.5", "🤖", "https://api.openai.com", { key: "model", label: "Model", type: "select", required: false, defaultValue: "gpt-4o", options: [{ label: "GPT-4o", value: "gpt-4o" }, { label: "GPT-4o-mini", value: "gpt-4o-mini" }, { label: "GPT-4", value: "gpt-4" }, { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" }] }));
  register(makeAIAdapter("anthropic", "Anthropic", "Anthropic API — Claude 3.5 Sonnet, Opus, Haiku", "🧠", "https://api.anthropic.com", { key: "model", label: "Model", type: "select", required: false, defaultValue: "claude-3-5-sonnet-20241022", options: [{ label: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet-20241022" }, { label: "Claude 3 Opus", value: "claude-3-opus-20240229" }, { label: "Claude 3 Haiku", value: "claude-3-haiku-20240307" }] }));
  register(makeAIAdapter("gemini", "Gemini", "Google Gemini API", "✨", "https://generativelanguage.googleapis.com", { key: "model", label: "Model", type: "select", required: false, defaultValue: "gemini-1.5-pro", options: [{ label: "Gemini 1.5 Pro", value: "gemini-1.5-pro" }, { label: "Gemini 1.5 Flash", value: "gemini-1.5-flash" }] }));
  register(makeAIAdapter("ollama", "Ollama", "Local Ollama — Llama, Mistral, CodeLlama", "🦙", "http://localhost:11434", { key: "model", label: "Model", type: "string", required: false, defaultValue: "llama3.1", placeholder: "llama3.1, mixtral, codellama" }));
  register(makeAIAdapter("openrouter", "OpenRouter", "Unified API for 200+ AI models", "🔀", "https://openrouter.ai/api", { key: "model", label: "Model", type: "string", required: false, defaultValue: "anthropic/claude-3.5-sonnet", placeholder: "anthropic/claude-3.5-sonnet, openai/gpt-4o" }));
}
