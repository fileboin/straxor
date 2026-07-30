import type { ConnectionAdapter, ConnectionTestResult, ExecuteResult, ConfigField, ConnectionOperation } from "../core/types.js";

class PluginSDKAdapter implements ConnectionAdapter {
  name = "plugin-sdk"; displayName = "Plugin SDK"; category = "custom" as const;
  description = "STRAXOR Plugin SDK — build custom integrations"; icon = "🧩";
  authType = "none" as const;
  configSchema: ConfigField[] = [
    { key: "pluginName", label: "Plugin Name", type: "string", required: true, placeholder: "my-custom-plugin" },
    { key: "version", label: "Version", type: "string", required: false, defaultValue: "1.0.0" },
    { key: "entryPoint", label: "Entry Point", type: "string", required: false, defaultValue: "index.js" },
    { key: "hooks", label: "Hooks", type: "multiselect", required: false, options: [
      { label: "onEvent", value: "onEvent" },
      { label: "onBeforePublish", value: "onBeforePublish" },
      { label: "onAfterInstall", value: "onAfterInstall" },
      { label: "onRequest", value: "onRequest" },
    ]},
  ];
  async testConnection() { return { success: true, latency: 1, message: "Plugin SDK loaded" }; }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    return { success: true, data: { message: `Plugin ${(config as any).pluginName} executed ${op}`, payload }, duration: 1 };
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "init", name: "Initialize", description: "Initialize plugin", inputSchema: [], outputSchema: [] },
    { id: "execute", name: "Execute", description: "Execute plugin hook", inputSchema: [], outputSchema: [] },
    { id: "validate", name: "Validate", description: "Validate plugin config", inputSchema: [], outputSchema: [] },
  ]; }
}

class CustomConnectorAdapter implements ConnectionAdapter {
  name = "custom-connector"; displayName = "Custom Connector"; category = "custom" as const;
  description = "Define your own connector with custom operations"; icon = "🔌";
  authType = "custom" as const;
  configSchema: ConfigField[] = [
    { key: "name", label: "Connector Name", type: "string", required: true, placeholder: "My Connector" },
    { key: "baseUrl", label: "Base URL", type: "url", required: true, placeholder: "https://api.example.com" },
    { key: "authType", label: "Auth Type", type: "select", required: false, defaultValue: "none", options: [
      { label: "None", value: "none" }, { label: "API Key", value: "api-key" }, { label: "Bearer Token", value: "bearer" },
      { label: "Basic Auth", value: "basic" }, { label: "Custom Header", value: "custom-header" },
    ]},
    { key: "authValue", label: "Auth Value", type: "password", required: false },
    { key: "customHeaders", label: "Custom Headers", type: "json", required: false },
    { key: "operations", label: "Operations (JSON)", type: "json", required: false, placeholder: '[{"id":"get-users","method":"GET","path":"/users"}]' },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try {
      const headers: Record<string, string> = { ...(c.customHeaders ? JSON.parse(typeof c.customHeaders === "string" ? c.customHeaders : JSON.stringify(c.customHeaders)) : {}) };
      if (c.authValue) { headers["Authorization"] = c.authType === "basic" ? `Basic ${Buffer.from(c.authValue).toString("base64")}` : `Bearer ${c.authValue}`; }
      const r = await fetch(c.baseUrl, { headers });
      return { success: r.ok || r.status < 500, latency: Date.now() - start, message: `HTTP ${r.status}` };
    } catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    try {
      const ops = JSON.parse(typeof c.operations === "string" ? c.operations : JSON.stringify(c.operations || "[]"));
      const opDef = Array.isArray(ops) ? ops.find((o: any) => o.id === op) : null;
      const method = opDef?.method || "GET";
      const path = opDef?.path || `/${op}`;
      const headers: Record<string, string> = { "Content-Type": "application/json", ...(c.customHeaders ? JSON.parse(typeof c.customHeaders === "string" ? c.customHeaders : JSON.stringify(c.customHeaders)) : {}) };
      if (c.authValue) headers["Authorization"] = c.authType === "basic" ? `Basic ${Buffer.from(c.authValue).toString("base64")}` : `Bearer ${c.authValue}`;
      const r = await fetch(`${c.baseUrl.replace(/\/$/, "")}${path}`, { method, headers, body: payload ? JSON.stringify(payload) : undefined });
      return { success: r.ok, data: await r.text().catch(() => null), duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "custom", name: "Custom Operation", description: "Execute a custom operation", inputSchema: [], outputSchema: [] },
  ]; }
}

class ExternalAPIAdapter implements ConnectionAdapter {
  name = "external-api"; displayName = "External API"; category = "custom" as const;
  description = "Connect to any external HTTP API"; icon = "🌐";
  authType = "custom" as const;
  configSchema: ConfigField[] = [
    { key: "name", label: "API Name", type: "string", required: true, placeholder: "My External API" },
    { key: "baseUrl", label: "Base URL", type: "url", required: true, placeholder: "https://api.example.com/v1" },
    { key: "authType", label: "Auth Type", type: "select", required: false, defaultValue: "none", options: [
      { label: "None", value: "none" }, { label: "API Key (Header)", value: "api-key" }, { label: "Bearer Token", value: "bearer" },
      { label: "Basic Auth", value: "basic" }, { label: "API Key (Query)", value: "api-key-query" },
    ]},
    { key: "authKey", label: "Auth Key/Token", type: "password", required: false },
    { key: "rateLimit", label: "Rate Limit (req/min)", type: "number", required: false, defaultValue: 60 },
    { key: "headers", label: "Default Headers", type: "json", required: false },
    { key: "timeout", label: "Timeout (ms)", type: "number", required: false, defaultValue: 30000 },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try {
      const headers = this.buildHeaders(c);
      const r = await fetch(c.baseUrl, { headers, signal: AbortSignal.timeout(5000) });
      return { success: r.ok || r.status < 500, latency: Date.now() - start, message: `HTTP ${r.status} ${r.statusText}` };
    } catch (e: any) { return { success: false, latency: Date.now() - start, message: e.name === "TimeoutError" ? "Connection timeout" : e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    const [method, path] = op.split(" ", 2);
    try {
      const headers = this.buildHeaders(c);
      const url = `${c.baseUrl.replace(/\/$/, "")}/${path || ""}`;
      const r = await fetch(url, { method: method || "GET", headers, body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(c.timeout || 30000) });
      const text = await r.text();
      let data: unknown = text;
      try { data = JSON.parse(text); } catch {}
      return { success: r.ok, data, duration: Date.now() - start, statusCode: r.status, headers: Object.fromEntries(r.headers.entries()) };
    } catch (e: any) { return { success: false, error: e.name === "TimeoutError" ? "Request timeout" : e.message, duration: Date.now() - start }; }
  }
  private buildHeaders(c: any): Record<string, string> {
    const headers: Record<string, string> = { "User-Agent": "straxor-connections" };
    if (c.headers) Object.assign(headers, JSON.parse(typeof c.headers === "string" ? c.headers : JSON.stringify(c.headers)));
    if (c.authType === "api-key" && c.authKey) headers["X-API-Key"] = c.authKey;
    if (c.authType === "bearer" && c.authKey) headers["Authorization"] = `Bearer ${c.authKey}`;
    if (c.authType === "basic" && c.authKey) headers["Authorization"] = `Basic ${Buffer.from(c.authKey).toString("base64")}`;
    return headers;
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "GET /", name: "GET /", description: "GET request", inputSchema: [], outputSchema: [] },
    { id: "POST /", name: "POST /", description: "POST request", inputSchema: [], outputSchema: [] },
    { id: "PUT /:id", name: "PUT /:id", description: "PUT request", inputSchema: [], outputSchema: [] },
    { id: "DELETE /:id", name: "DELETE /:id", description: "DELETE request", inputSchema: [], outputSchema: [] },
  ]; }
}

export function registerAll(register: (adapter: ConnectionAdapter) => void): void {
  register(new PluginSDKAdapter());
  register(new CustomConnectorAdapter());
  register(new ExternalAPIAdapter());
}
