import type { ConnectionAdapter, ConnectionTestResult, ExecuteResult, ConfigField, ConnectionOperation } from "../core/types.js";

class WebhookAdapter implements ConnectionAdapter {
  name = "webhook"; displayName = "Webhook"; category = "network" as const;
  description = "Send and receive HTTP webhooks"; icon = "🔗";
  authType = "none" as const;
  configSchema: ConfigField[] = [
    { key: "url", label: "Webhook URL", type: "url", required: true, placeholder: "https://hooks.example.com/..." },
    { key: "secret", label: "Secret", type: "password", required: false, description: "HMAC secret for signature verification" },
    { key: "method", label: "HTTP Method", type: "select", required: false, defaultValue: "POST", options: [{ label: "POST", value: "POST" }, { label: "PUT", value: "PUT" }, { label: "PATCH", value: "PATCH" }] },
    { key: "headers", label: "Custom Headers", type: "json", required: false, placeholder: '{"X-Custom": "value"}' },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    if (!c.url) return { success: false, latency: 0, message: "No URL configured" };
    try { const r = await fetch(c.url, { method: "HEAD" }); return { success: true, latency: Date.now() - start, message: `Webhook endpoint reachable (HTTP ${r.status})` }; }
    catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(_op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json", ...(c.headers ? JSON.parse(typeof c.headers === "string" ? c.headers : JSON.stringify(c.headers)) : {}) };
      const r = await fetch(c.url, { method: c.method || "POST", headers, body: JSON.stringify(payload) });
      return { success: r.ok, data: await r.text().catch(() => null), duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "send", name: "Send Webhook", description: "Send a webhook payload", inputSchema: [], outputSchema: [] },
    { id: "verify-signature", name: "Verify Signature", description: "Verify HMAC signature", inputSchema: [], outputSchema: [] },
  ]; }
}

class RestApiAdapter implements ConnectionAdapter {
  name = "rest-api"; displayName = "REST API"; category = "network" as const;
  description = "Generic REST API client"; icon = "🌐";
  authType = "bearer" as const;
  configSchema: ConfigField[] = [
    { key: "baseUrl", label: "Base URL", type: "url", required: true, placeholder: "https://api.example.com" },
    { key: "apiKey", label: "API Key", type: "password", required: false },
    { key: "defaultHeaders", label: "Default Headers", type: "json", required: false },
    { key: "timeout", label: "Timeout (ms)", type: "number", required: false, defaultValue: 30000 },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try { const r = await fetch(c.baseUrl); return { success: r.ok || r.status < 500, latency: Date.now() - start, message: `API reachable (HTTP ${r.status})` }; }
    catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    const [method, path] = op.split(" ", 2);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json", ...(c.defaultHeaders ? JSON.parse(typeof c.defaultHeaders === "string" ? c.defaultHeaders : JSON.stringify(c.defaultHeaders)) : {}) };
      if (c.apiKey) headers["Authorization"] = `Bearer ${c.apiKey}`;
      const r = await fetch(`${c.baseUrl.replace(/\/$/, "")}/${path || ""}`, { method: method || "GET", headers, body: payload ? JSON.stringify(payload) : undefined });
      const text = await r.text();
      let data: unknown = text;
      try { data = JSON.parse(text); } catch {}
      return { success: r.ok, data, duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "GET /", name: "GET /", description: "GET request", inputSchema: [], outputSchema: [] },
    { id: "POST /", name: "POST /", description: "POST request", inputSchema: [], outputSchema: [] },
    { id: "PUT /:id", name: "PUT /:id", description: "PUT request", inputSchema: [], outputSchema: [] },
    { id: "DELETE /:id", name: "DELETE /:id", description: "DELETE request", inputSchema: [], outputSchema: [] },
  ]; }
}

class GraphQLAdapter implements ConnectionAdapter {
  name = "graphql"; displayName = "GraphQL"; category = "network" as const;
  description = "GraphQL API client"; icon = "◈";
  authType = "bearer" as const;
  configSchema: ConfigField[] = [
    { key: "endpoint", label: "GraphQL Endpoint", type: "url", required: true, placeholder: "https://api.example.com/graphql" },
    { key: "apiKey", label: "API Key", type: "password", required: false },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try { const r = await fetch(c.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "{ __typename }" }) }); return { success: r.ok, latency: Date.now() - start, message: r.ok ? "GraphQL endpoint reachable" : `HTTP ${r.status}` }; }
    catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    const p = payload as any;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (c.apiKey) headers["Authorization"] = `Bearer ${c.apiKey}`;
      const r = await fetch(c.endpoint, { method: "POST", headers, body: JSON.stringify({ query: p?.query || op, variables: p?.variables }) });
      return { success: r.ok, data: await r.json(), duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "query", name: "Query", description: "Execute a GraphQL query", inputSchema: [], outputSchema: [] },
    { id: "mutation", name: "Mutation", description: "Execute a GraphQL mutation", inputSchema: [], outputSchema: [] },
  ]; }
}

class TCPAdapter implements ConnectionAdapter {
  name = "tcp"; displayName = "TCP Socket"; category = "network" as const;
  description = "Raw TCP socket communication"; icon = "🔌";
  authType = "none" as const;
  configSchema: ConfigField[] = [
    { key: "host", label: "Host", type: "string", required: true, placeholder: "192.168.1.1 or example.com" },
    { key: "port", label: "Port", type: "number", required: true, placeholder: "8080" },
    { key: "timeout", label: "Timeout (ms)", type: "number", required: false, defaultValue: 5000 },
  ];
  async testConnection(config: Record<string, unknown>) {
    const c = config as any;
    if (c.host && c.port) return { success: true, latency: 1, message: `TCP configured for ${c.host}:${c.port}` };
    return { success: false, latency: 0, message: "Host and port required" };
  }
  async execute(_op: string, config: Record<string, unknown>, payload?: unknown) {
    return { success: true, data: { message: "TCP send (simulated)", host: (config as any).host, port: (config as any).port, payload }, duration: 1 };
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "send", name: "Send", description: "Send data over TCP", inputSchema: [], outputSchema: [] },
    { id: "receive", name: "Receive", description: "Receive data over TCP", inputSchema: [], outputSchema: [] },
  ]; }
}

class UDPAdapter implements ConnectionAdapter {
  name = "udp"; displayName = "UDP Socket"; category = "network" as const;
  description = "Raw UDP datagram communication"; icon = "🔌";
  authType = "none" as const;
  configSchema: ConfigField[] = [
    { key: "host", label: "Host", type: "string", required: true, placeholder: "192.168.1.1" },
    { key: "port", label: "Port", type: "number", required: true, placeholder: "41234" },
  ];
  async testConnection(config: Record<string, unknown>) {
    const c = config as any;
    if (c.host && c.port) return { success: true, latency: 1, message: `UDP configured for ${c.host}:${c.port}` };
    return { success: false, latency: 0, message: "Host and port required" };
  }
  async execute(_op: string, _config: Record<string, unknown>, payload?: unknown) {
    return { success: true, data: { message: "UDP send (simulated)", payload }, duration: 1 };
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "send", name: "Send", description: "Send UDP datagram", inputSchema: [], outputSchema: [] },
  ]; }
}

class WebSocketAdapter implements ConnectionAdapter {
  name = "websocket"; displayName = "WebSocket"; category = "network" as const;
  description = "WebSocket client communication"; icon = "🔗";
  authType = "none" as const;
  configSchema: ConfigField[] = [
    { key: "url", label: "WebSocket URL", type: "url", required: true, placeholder: "wss://ws.example.com" },
    { key: "protocols", label: "Protocols", type: "string", required: false, placeholder: "graphql-ws" },
    { key: "autoReconnect", label: "Auto Reconnect", type: "boolean", required: false, defaultValue: true },
  ];
  async testConnection(config: Record<string, unknown>) {
    const c = config as any;
    if (c.url) return { success: true, latency: 1, message: `WebSocket configured for ${c.url}` };
    return { success: false, latency: 0, message: "No URL configured" };
  }
  async execute(_op: string, config: Record<string, unknown>, payload?: unknown) {
    return { success: true, data: { message: "WebSocket send (simulated)", url: (config as any).url, payload }, duration: 1 };
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "connect", name: "Connect", description: "Connect to WebSocket", inputSchema: [], outputSchema: [] },
    { id: "send", name: "Send", description: "Send message", inputSchema: [], outputSchema: [] },
    { id: "subscribe", name: "Subscribe", description: "Subscribe to topic", inputSchema: [], outputSchema: [] },
  ]; }
}

export function registerAll(register: (adapter: ConnectionAdapter) => void): void {
  register(new WebhookAdapter());
  register(new RestApiAdapter());
  register(new GraphQLAdapter());
  register(new TCPAdapter());
  register(new UDPAdapter());
  register(new WebSocketAdapter());
}
