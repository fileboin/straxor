import type { DeploymentProvider, DeploymentTarget, DeployParams } from "../types.js";

export function createDokployProvider(): DeploymentProvider {
  let apiKey = "";
  let serverUrl = "";

  return {
    platform: "dokploy" as DeploymentTarget,
    name: "Dokploy",

    isConfigured: () => !!apiKey && !!serverUrl,
    configure: (config: Record<string, string>) => {
      apiKey = config.apiKey || "";
      serverUrl = config.serverUrl || "";
      if (serverUrl.endsWith("/")) serverUrl = serverUrl.slice(0, -1);
    },

    async deploy(_projectId: string, params: DeployParams, addLog) {
      await addLog("info", `Deploying via Dokploy — ${serverUrl}`);

      // Dokploy exposes a REST API for deployments
      const res = await fetch(`${serverUrl}/api/deploy`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ branch: params.branch || "main", env: params.envVars }),
      });

      if (res.ok) {
        await addLog("info", "Dokploy deployment triggered");
      } else {
        await addLog("warn", `Dokploy API responded with ${res.status}`);
      }

      return { status: "running", liveUrl: serverUrl };
    },

    async getStatus(_externalId: string) {
      return { status: "running", liveUrl: null };
    },

    async stop(_externalId: string) {
      // Dokploy supports cancellation
    },
  };
}
