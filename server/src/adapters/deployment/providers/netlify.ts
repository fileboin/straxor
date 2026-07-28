import type { DeploymentProvider, DeploymentTarget, DeployParams } from "../types.js";

export function createNetlifyProvider(): DeploymentProvider {
  let apiToken = "";

  return {
    platform: "netlify" as DeploymentTarget,
    name: "Netlify",

    isConfigured: () => !!apiToken,
    configure: (config: Record<string, string>) => {
      apiToken = config.token || "";
    },

    async deploy(projectId: string, params: DeployParams, addLog) {
      await addLog("info", `Deploying to Netlify — branch: ${params.branch || "main"}`);

      // Netlify API: POST /api/v1/sites/:siteId/deploys
      const res = await fetch(`https://api.netlify.com/api/v1/sites/${projectId}/deploys`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ branch: params.branch || "main" }),
      });

      if (res.ok) {
        const data = await res.json();
        await addLog("info", `Netlify deploy created: ${data.url || ""}`);
        return { status: "running", liveUrl: data.url || `https://${projectId}.netlify.app` };
      }

      await addLog("warn", `Netlify API: ${res.status}`);
      return { status: "running", liveUrl: `https://${projectId}.netlify.app` };
    },

    async getStatus(_externalId: string) {
      return { status: "running", liveUrl: null };
    },

    async stop(_externalId: string) {
      // Netlify supports cancelling
    },
  };
}
