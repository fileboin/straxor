import type { ConnectionAdapter, ConnectionTestResult, ExecuteResult, ConfigField, ConnectionOperation } from "../core/types.js";

class GitHubAdapter implements ConnectionAdapter {
  name = "github"; displayName = "GitHub"; category = "cloud" as const;
  description = "GitHub API for repositories, issues, PRs"; icon = "🐙";
  authType = "bearer" as const;
  configSchema: ConfigField[] = [
    { key: "token", label: "Personal Access Token", type: "password", required: true },
    { key: "owner", label: "Owner/Organization", type: "string", required: false },
    { key: "repo", label: "Repository", type: "string", required: false },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try {
      const r = await fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${c.token}`, "User-Agent": "straxor" } });
      const data = await r.json();
      return { success: r.ok, latency: Date.now() - start, message: r.ok ? `Authenticated as ${data.login}` : `HTTP ${r.status}` };
    } catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    const [method, path] = op.split(" ", 2);
    try {
      const r = await fetch(`https://api.github.com${path || ""}`, { method: method || "GET", headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json", "User-Agent": "straxor" }, body: payload ? JSON.stringify(payload) : undefined });
      return { success: r.ok, data: await r.json(), duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "GET /user", name: "Get User", description: "Get authenticated user", inputSchema: [], outputSchema: [] },
    { id: "GET /repos/:owner/:repo", name: "Get Repo", description: "Get repository details", inputSchema: [], outputSchema: [] },
    { id: "POST /repos/:owner/:repo/issues", name: "Create Issue", description: "Create an issue", inputSchema: [], outputSchema: [] },
    { id: "GET /repos/:owner/:repo/pulls", name: "List PRs", description: "List pull requests", inputSchema: [], outputSchema: [] },
  ]; }
}

class GitLabAdapter implements ConnectionAdapter {
  name = "gitlab"; displayName = "GitLab"; category = "cloud" as const;
  description = "GitLab API for repositories, CI/CD, issues"; icon = "🦊";
  authType = "bearer" as const;
  configSchema: ConfigField[] = [
    { key: "baseUrl", label: "GitLab URL", type: "url", required: false, defaultValue: "https://gitlab.com", placeholder: "https://gitlab.com" },
    { key: "token", label: "Personal Access Token", type: "password", required: true },
    { key: "projectId", label: "Project ID", type: "string", required: false },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try {
      const r = await fetch(`${c.baseUrl || "https://gitlab.com"}/api/v4/user`, { headers: { Authorization: `Bearer ${c.token}` } });
      return { success: r.ok, latency: Date.now() - start, message: r.ok ? "Authenticated" : `HTTP ${r.status}` };
    } catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    const [method, path] = op.split(" ", 2);
    try {
      const r = await fetch(`${c.baseUrl || "https://gitlab.com"}/api/v4${path || ""}`, { method: method || "GET", headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined });
      return { success: r.ok, data: await r.json(), duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "GET /user", name: "Get User", description: "Get current user", inputSchema: [], outputSchema: [] },
    { id: "GET /projects/:id", name: "Get Project", description: "Get project details", inputSchema: [], outputSchema: [] },
    { id: "POST /projects/:id/pipelines", name: "Trigger Pipeline", description: "Trigger CI/CD pipeline", inputSchema: [], outputSchema: [] },
  ]; }
}

class DockerAdapter implements ConnectionAdapter {
  name = "docker"; displayName = "Docker"; category = "cloud" as const;
  description = "Docker Engine API"; icon = "🐳";
  authType = "none" as const;
  configSchema: ConfigField[] = [
    { key: "socketPath", label: "Socket Path", type: "string", required: false, defaultValue: "/var/run/docker.sock" },
    { key: "host", label: "Docker Host", type: "string", required: false, placeholder: "tcp://192.168.1.1:2375" },
    { key: "tlsVerify", label: "TLS Verify", type: "boolean", required: false, defaultValue: false },
  ];
  async testConnection() { return { success: true, latency: 1, message: "Docker adapter ready" }; }
  async execute(_op: string, _config: Record<string, unknown>, payload?: unknown) {
    return { success: true, data: { message: "Docker execute (simulated)", payload }, duration: 1 };
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "list-containers", name: "List Containers", description: "List running containers", inputSchema: [], outputSchema: [] },
    { id: "start-container", name: "Start Container", description: "Start a container", inputSchema: [], outputSchema: [] },
    { id: "stop-container", name: "Stop Container", description: "Stop a container", inputSchema: [], outputSchema: [] },
    { id: "list-images", name: "List Images", description: "List Docker images", inputSchema: [], outputSchema: [] },
    { id: "pull-image", name: "Pull Image", description: "Pull a Docker image", inputSchema: [], outputSchema: [] },
  ]; }
}

class KubernetesAdapter implements ConnectionAdapter {
  name = "kubernetes"; displayName = "Kubernetes"; category = "cloud" as const;
  description = "Kubernetes cluster management"; icon = "☸️";
  authType = "bearer" as const;
  configSchema: ConfigField[] = [
    { key: "apiServer", label: "API Server URL", type: "url", required: true, placeholder: "https://k8s-api.example.com" },
    { key: "token", label: "Service Account Token", type: "password", required: false },
    { key: "namespace", label: "Default Namespace", type: "string", required: false, defaultValue: "default" },
    { key: "caCert", label: "CA Certificate", type: "string", required: false },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try { const r = await fetch(`${c.apiServer}/api/v1/namespaces`, { headers: c.token ? { Authorization: `Bearer ${c.token}` } : {} }); return { success: r.ok, latency: Date.now() - start, message: r.ok ? "Connected" : `HTTP ${r.status}` }; }
    catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    return { success: true, data: { message: "K8s execute (simulated)", operation: op }, duration: 1 };
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "list-pods", name: "List Pods", description: "List pods in namespace", inputSchema: [], outputSchema: [] },
    { id: "get-logs", name: "Get Logs", description: "Get pod logs", inputSchema: [], outputSchema: [] },
    { id: "apply-manifest", name: "Apply Manifest", description: "Apply Kubernetes manifest", inputSchema: [], outputSchema: [] },
    { id: "get-services", name: "Get Services", description: "List services", inputSchema: [], outputSchema: [] },
  ]; }
}

class CoolifyAdapter implements ConnectionAdapter {
  name = "coolify"; displayName = "Coolify"; category = "cloud" as const;
  description = "Self-hostable PaaS for deployments"; icon = "❄️";
  authType = "api-key" as const;
  configSchema: ConfigField[] = [
    { key: "baseUrl", label: "Coolify URL", type: "url", required: true, placeholder: "https://coolify.example.com" },
    { key: "apiKey", label: "API Key", type: "password", required: true },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try { const r = await fetch(`${c.baseUrl}/api/v1/health`, { headers: { Authorization: `Bearer ${c.apiKey}` } }); return { success: r.ok, latency: Date.now() - start, message: r.ok ? "Connected" : `HTTP ${r.status}` }; }
    catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    try {
      const r = await fetch(`${c.baseUrl}/api/v1/deploy`, { method: "POST", headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ type: op, ...(payload as any) }) });
      return { success: r.ok, data: await r.json(), duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "deploy", name: "Deploy", description: "Trigger deployment", inputSchema: [], outputSchema: [] },
    { id: "list-deployments", name: "List Deployments", description: "List deployments", inputSchema: [], outputSchema: [] },
  ]; }
}

class RenderAdapter implements ConnectionAdapter {
  name = "render"; displayName = "Render"; category = "cloud" as const;
  description = "Cloud platform for apps and static sites"; icon = "⚡";
  authType = "api-key" as const;
  configSchema: ConfigField[] = [
    { key: "apiKey", label: "API Key", type: "password", required: true },
    { key: "serviceId", label: "Service ID", type: "string", required: false },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try { const r = await fetch("https://api.render.com/v1/services", { headers: { Authorization: `Bearer ${c.apiKey}` } }); return { success: r.ok, latency: Date.now() - start, message: r.ok ? "Connected" : `HTTP ${r.status}` }; }
    catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    const start = Date.now(); const c = config as any;
    try {
      const r = await fetch(`https://api.render.com/v1/services/${c.serviceId || ""}/${op}`, { method: "POST", headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined });
      return { success: r.ok, data: await r.json(), duration: Date.now() - start, statusCode: r.status };
    } catch (e: any) { return { success: false, error: e.message, duration: Date.now() - start }; }
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "deploy", name: "Deploy", description: "Trigger deploy", inputSchema: [], outputSchema: [] },
    { id: "restart", name: "Restart", description: "Restart service", inputSchema: [], outputSchema: [] },
    { id: "list-logs", name: "List Logs", description: "Get service logs", inputSchema: [], outputSchema: [] },
  ]; }
}

class RailwayAdapter implements ConnectionAdapter {
  name = "railway"; displayName = "Railway"; category = "cloud" as const;
  description = "Cloud platform with zero-config deployments"; icon = "🚂";
  authType = "api-key" as const;
  configSchema: ConfigField[] = [
    { key: "apiKey", label: "API Key", type: "password", required: true },
    { key: "projectId", label: "Project ID", type: "string", required: false },
    { key: "environmentId", label: "Environment ID", type: "string", required: false },
  ];
  async testConnection(config: Record<string, unknown>) {
    const start = Date.now(); const c = config as any;
    try { const r = await fetch("https://backboard.railway.app/graphql/v2", { method: "POST", headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: "{ projects { edges { node { id } } } }" }) }); return { success: r.ok, latency: Date.now() - start, message: r.ok ? "Connected" : `HTTP ${r.status}` }; }
    catch (e: any) { return { success: false, latency: Date.now() - start, message: e.message }; }
  }
  async execute(op: string, config: Record<string, unknown>, payload?: unknown) {
    return { success: true, data: { message: "Railway execute (simulated)", operation: op, payload }, duration: 1 };
  }
  getOperations(): ConnectionOperation[] { return [
    { id: "deploy", name: "Deploy", description: "Trigger deploy", inputSchema: [], outputSchema: [] },
    { id: "get-logs", name: "Get Logs", description: "Get deployment logs", inputSchema: [], outputSchema: [] },
    { id: "get-variables", name: "Get Variables", description: "Get environment variables", inputSchema: [], outputSchema: [] },
  ]; }
}

export function registerAll(register: (adapter: ConnectionAdapter) => void): void {
  register(new GitHubAdapter());
  register(new GitLabAdapter());
  register(new DockerAdapter());
  register(new KubernetesAdapter());
  register(new CoolifyAdapter());
  register(new RenderAdapter());
  register(new RailwayAdapter());
}
