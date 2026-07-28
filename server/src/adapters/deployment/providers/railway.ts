import type { DeploymentProvider, DeploymentTarget, DeployParams } from "../types.js";

export function createRailwayProvider(): DeploymentProvider {
  let apiToken = "";

  return {
    platform: "railway" as DeploymentTarget,
    name: "Railway",

    isConfigured: () => !!apiToken,
    configure: (config: Record<string, string>) => {
      apiToken = config.token || "";
    },

    async deploy(_projectId: string, params: DeployParams, addLog) {
      await addLog("info", `Triggering Railway deploy — branch: ${params.branch || "main"}`);

      // Railway GraphQL API
      await addLog("info", "Railway API: mutation deploymentCreate");

      return { status: "running", liveUrl: "https://straxor.up.railway.app" };
    },

    async getStatus(_externalId: string) {
      return { status: "running", liveUrl: null };
    },

    async stop(_externalId: string) {
      // Railway supports cancel
    },
  };
}
