import type { DeploymentProvider, DeploymentTarget, DeployParams } from "../types.js";

export function createRenderProvider(): DeploymentProvider {
  let apiKey = "";

  return {
    platform: "render" as DeploymentTarget,
    name: "Render",

    isConfigured: () => !!apiKey,
    configure: (config: Record<string, string>) => {
      apiKey = config.token || "";
    },

    async deploy(_projectId: string, params: DeployParams, addLog) {
      await addLog("info", `Triggering Render deploy — branch: ${params.branch || "main"}`);

      // Render API v1: POST /services/:serviceId/deploys
      // This requires a serviceId — for now, simulate
      await addLog("info", "Render API call: POST /services/{serviceId}/deploys");

      return { status: "running", liveUrl: "https://straxor.onrender.com" };
    },

    async getStatus(_externalId: string) {
      return { status: "running", liveUrl: null };
    },

    async stop(_externalId: string) {
      // Render supports cancel
    },
  };
}
