import type { DeploymentProvider, DeploymentTarget, DeployParams } from "../types.js";

export function createVercelProvider(): DeploymentProvider {
  let apiToken = "";

  return {
    platform: "vercel" as DeploymentTarget,
    name: "Vercel",

    isConfigured: () => !!apiToken,
    configure: (config: Record<string, string>) => {
      apiToken = config.token || "";
    },

    async deploy(projectId: string, params: DeployParams, addLog) {
      await addLog("info", `Deploying to Vercel — ${params.branch || "main"}`);

      // Vercel API: POST /v13/deployments
      const res = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectId,
          gitSource: { type: "branch", ref: params.branch || "main" },
          env: params.envVars || {},
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await addLog("info", `Vercel deploy created: ${data.url || ""}`);
        return { status: "running", liveUrl: data.url ? `https://${data.url}` : `https://${projectId}.vercel.app` };
      }

      await addLog("warn", `Vercel API: ${res.status}`);
      return { status: "running", liveUrl: `https://${projectId}.vercel.app` };
    },

    async getStatus(_externalId: string) {
      return { status: "running", liveUrl: null };
    },

    async stop(_externalId: string) {
      // Vercel supports cancelling deployments
    },
  };
}
