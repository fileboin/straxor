import type { ConnectionAdapter, ConnectionTestResult, ExecuteResult, ConfigField, ConnectionOperation } from "../core/types.js";

const SHARED_CONFIG: ConfigField[] = [
  { key: "webhookUrl", label: "Webhook URL", type: "url", required: false, placeholder: "https://..." },
  { key: "apiKey", label: "API Key", type: "password", required: false },
  { key: "baseUrl", label: "Base URL", type: "url", required: false, placeholder: "https://..." },
];

function testViaFetch(url: string, apiKey?: string): Promise<ConnectionTestResult> {
  const start = Date.now();
  if (!url) return Promise.resolve({ success: false, latency: 0, message: "No URL configured" });
  return fetch(url, { headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {} })
    .then(r => ({ success: r.ok, latency: Date.now() - start, message: r.ok ? "Connected" : `HTTP ${r.status}` }))
    .catch(e => ({ success: false, latency: Date.now() - start, message: e.message }));
}

class MakeAdapter implements ConnectionAdapter {
  name = "make"; displayName = "Make"; category = "automation" as const;
  description = "Visual automation platform for connecting apps and services"; icon = "⚡";
  authType = "api-key" as const;
  configSchema: ConfigField[] = [
    ...SHARED_CONFIG,
    { key: "scenarioId", label: "Scenario ID", type: "string", required: false },
    { key: "teamId", label: "Team ID", type: "string", required: false },
  ];
  testConnection(config: Record<string, unknown>) { return testViaFetch((config as any).webhookUrl, (config as any).apiKey); }
  execute(op: string, config: Record<string, unknown>, payload?: unknown): Promise<ExecuteResult> {
    const start = Date.now();
    return fetch((config as any).webhookUrl || "", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(async r => ({ success: r.ok, data: await r.json().catch(() => null), duration: Date.now() - start, statusCode: r.status }))
      .catch(e => ({ success: false, error: e.message, duration: Date.now() - start }));
  }
  getOperations(): ConnectionOperation[] { return [{ id: "trigger-scenario", name: "Trigger Scenario", description: "Trigger a Make scenario", inputSchema: [], outputSchema: [] }]; }
}

class N8nAdapter implements ConnectionAdapter {
  name = "n8n"; displayName = "n8n"; category = "automation" as const;
  description = "Fair-code workflow automation platform"; icon = "⚡";
  authType = "api-key" as const;
  configSchema: ConfigField[] = [
    { key: "baseUrl", label: "n8n URL", type: "url", required: true, placeholder: "https://n8n.example.com" },
    { key: "apiKey", label: "API Key", type: "password", required: true },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try {
      const r = await fetch(`${c.baseUrl}/api/v1/health`, { headers: { "X-N8N-API-KEY": c.apiKey } });
      return { success: r.ok, latency: Date.now() - start, message: r.ok ? "Connected" : `HTTP ${r.status}` };
    } catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    try {
      const r = await fetch(`${c.baseUrl}/api/v1/workflows/${op}/execute`, { method: "POST", headers: { "X-N8N-API-KEY": c.apiKey, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      return { success: r.ok, data: await r.json(), duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [{ id: "execute-workflow", name: "Execute Workflow", description: "Execute an n8n workflow", inputSchema: [], outputSchema: [] }]; }
}

class FlowiseAdapter implements ConnectionAdapter {
  name = "flowise"; displayName = "Flowise"; category = "automation" as const;
  description = "Low-code LLM app builder"; icon = "🧩";
  authType = "api-key" as const;
  configSchema: ConfigField[] = [
    { key: "baseUrl", label: "Flowise URL", type: "url", required: true, placeholder: "https://flowise.example.com" },
    { key: "apiKey", label: "API Key", type: "password", required: false },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try { const r = await fetch(`${c.baseUrl}/api/v1/prediction`); return { success: r.ok || r.status === 405, latency: Date.now() - start, message: "Connected" }; }
    catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    try {
      const r = await fetch(`${c.baseUrl}/api/v1/prediction/${op}`, { method: "POST", headers: { "Content-Type": "application/json", ...(c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {}) }, body: JSON.stringify(payload) });
      return { success: r.ok, data: await r.json(), duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [{ id: "predict", name: "Predict", description: "Run prediction against a chatflow", inputSchema: [], outputSchema: [] }]; }
}

class LangflowAdapter implements ConnectionAdapter {
  name = "langflow"; displayName = "Langflow"; category = "automation" as const;
  description = "Visual framework for building LLM apps"; icon = "🔀";
  authType = "bearer" as const;
  configSchema: ConfigField[] = [
    { key: "baseUrl", label: "Langflow URL", type: "url", required: true, placeholder: "https://langflow.example.com" },
    { key: "apiToken", label: "API Token", type: "password", required: false },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try { const r = await fetch(`${c.baseUrl}/api/v1/flows`); return { success: r.ok, latency: Date.now() - start, message: r.ok ? "Connected" : `HTTP ${r.status}` }; }
    catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    try {
      const r = await fetch(`${c.baseUrl}/api/v1/run/${op}`, { method: "POST", headers: { "Content-Type": "application/json", ...(c.apiToken ? { Authorization: `Bearer ${c.apiToken}` } : {}) }, body: JSON.stringify({ input: payload }) });
      return { success: r.ok, data: await r.json(), duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [{ id: "run-flow", name: "Run Flow", description: "Execute a Langflow flow", inputSchema: [], outputSchema: [] }]; }
}

class ZapierAdapter implements ConnectionAdapter {
  name = "zapier"; displayName = "Zapier"; category = "automation" as const;
  description = "Automate workflows between 7000+ apps"; icon = "⚡";
  authType = "api-key" as const;
  configSchema: ConfigField[] = [
    { key: "webhookUrl", label: "Webhook URL", type: "url", required: true, placeholder: "https://hooks.zapier.com/..." },
    { key: "apiKey", label: "API Key", type: "password", required: false },
  ];
  testConnection(config: Record<string, unknown>) { return testViaFetch((config as any).webhookUrl); }
  async execute(_op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    try {
      const r = await fetch(c.webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      return { success: r.ok, data: await r.json().catch(() => null), duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [{ id: "trigger-zap", name: "Trigger Zap", description: "Trigger a Zapier zap via webhook", inputSchema: [], outputSchema: [] }]; }
}

class ActivepiecesAdapter implements ConnectionAdapter {
  name = "activepieces"; displayName = "Activepieces"; category = "automation" as const;
  description = "Open-source automation tool"; icon = "🧩";
  authType = "api-key" as const;
  configSchema: ConfigField[] = [
    { key: "baseUrl", label: "Activepieces URL", type: "url", required: true, placeholder: "https://activepieces.example.com" },
    { key: "apiKey", label: "API Key", type: "password", required: true },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try { const r = await fetch(`${c.baseUrl}/api/v1/pieces`); return { success: r.ok, latency: Date.now() - start, message: r.ok ? "Connected" : `HTTP ${r.status}` }; }
    catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    try {
      const r = await fetch(`${c.baseUrl}/api/v1/webhooks/${op}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.apiKey}` }, body: JSON.stringify(payload) });
      return { success: r.ok, data: await r.json(), duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [{ id: "trigger-flow", name: "Trigger Flow", description: "Trigger an Activepieces flow", inputSchema: [], outputSchema: [] }]; }
}

class NodeRedAdapter implements ConnectionAdapter {
  name = "node-red"; displayName = "Node-RED"; category = "automation" as const;
  description = "Flow-based visual programming tool"; icon = "🔴";
  authType = "bearer" as const;
  configSchema: ConfigField[] = [
    { key: "baseUrl", label: "Node-RED URL", type: "url", required: true, placeholder: "https://node-red.example.com" },
    { key: "apiToken", label: "API Token", type: "password", required: false },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try { const r = await fetch(`${c.baseUrl}/api/v2/`); return { success: r.ok || r.status === 401, latency: Date.now() - start, message: r.ok ? "Connected" : "Authentication required" }; }
    catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    try {
      const r = await fetch(`${c.baseUrl}/api/v2/flow/${op}`, { method: "POST", headers: { "Content-Type": "application/json", ...(c.apiToken ? { Authorization: `Bearer ${c.apiToken}` } : {}) }, body: JSON.stringify(payload) });
      return { success: r.ok, data: await r.json(), duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [{ id: "invoke-flow", name: "Invoke Flow", description: "Invoke a Node-RED flow endpoint", inputSchema: [], outputSchema: [] }]; }
}

export function registerAll(register: (adapter: ConnectionAdapter) => void): void {
  register(new MakeAdapter());
  register(new N8nAdapter());
  register(new FlowiseAdapter());
  register(new LangflowAdapter());
  register(new ZapierAdapter());
  register(new ActivepiecesAdapter());
  register(new NodeRedAdapter());
}
