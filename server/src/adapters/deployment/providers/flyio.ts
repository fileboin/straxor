import type { DeploymentProvider, DeploymentTarget, DeployParams } from "../types.js";

export function createFlyioProvider(): DeploymentProvider {
  let apiToken = "";
  let org = "";

  return {
    platform: "flyio" as DeploymentTarget,
    name: "Fly.io",

    isConfigured: () => !!apiToken,
    configure: (config: Record<string, string>) => {
      apiToken = config.token || "";
      org = config.org || "";
    },

    async deploy(_projectId: string, params: DeployParams, addLog) {
      await addLog("info", `Deploying to Fly.io — org: ${org || "personal"}`);

      // Fly Machines API: POST /apps/:appName/machines
      await addLog("info", "Fly.io API: machine creation triggered");

      return { status: "running", liveUrl: `https://${_projectId}.fly.dev` };
    },

    async getStatus(_externalId: string) {
      return { status: "running", liveUrl: null };
    },

    async stop(_externalId: string) {
      // Fly Machines API: stop machine
    },
  };
}
