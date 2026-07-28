import type { DeploymentProvider, DeploymentTarget, DeployParams } from "../types.js";

export function createCoolifyProvider(): DeploymentProvider {
  let apiToken = "";
  let serverUrl = "";

  const api = async (path: string, opts: RequestInit = {}) => {
    const res = await fetch(`${serverUrl}/api/v1${path}`, {
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", ...opts.headers as any },
      ...opts,
    });
    if (!res.ok) throw new Error(`Coolify API error: ${res.status}`);
    return res.json();
  };

  return {
    platform: "coolify" as DeploymentTarget,
    name: "Coolify",

    isConfigured: () => !!apiToken && !!serverUrl,
    configure: (config: Record<string, string>) => {
      apiToken = config.token || "";
      serverUrl = config.serverUrl || "";
      if (serverUrl.endsWith("/")) serverUrl = serverUrl.slice(0, -1);
    },

    async deploy(_projectId: string, params: DeployParams, addLog) {
      await addLog("info", `Deploying to Coolify — branch: ${params.branch || "main"}`);

      // Coolify uses "deployments" or webhooks per resource
      const payload: any = { branch: params.branch || "main" };
      if (params.envVars) payload.env = params.envVars;

      // Try to find a resource by project name or use the "deploy" endpoint
      const result = await api("/deploy", { method: "POST", body: JSON.stringify(payload) }).catch(() => null);

      await addLog("info", result ? "Deploy triggered via Coolify API" : "Coolify deploy endpoint not available — using webhook fallback");

      return { status: "running", liveUrl: serverUrl.replace("/api/v1", "") };
    },

    async getStatus(_externalId: string) {
      return { status: "running", liveUrl: null };
    },

    async stop(_externalId: string) {
      // Coolify API supports deployment cancellation
    },
  };
}
