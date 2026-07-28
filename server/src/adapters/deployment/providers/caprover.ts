import type { DeploymentProvider, DeploymentTarget, DeployParams } from "../types.js";

export function createCapRoverProvider(): DeploymentProvider {
  let apiKey = "";
  let serverUrl = "";
  let appName = "";

  return {
    platform: "caprover" as DeploymentTarget,
    name: "CapRover",

    isConfigured: () => !!apiKey && !!serverUrl && !!appName,
    configure: (config: Record<string, string>) => {
      apiKey = config.apiKey || "";
      serverUrl = config.serverUrl || "";
      appName = config.appName || "app";
      if (serverUrl.endsWith("/")) serverUrl = serverUrl.slice(0, -1);
    },

    async deploy(_projectId: string, params: DeployParams, addLog) {
      await addLog("info", `Deploying to CapRover: ${appName} @ ${serverUrl}`);

      // CapRover API uses captain/v1/endpoints
      const payload: any = {
        appName,
        branch: params.branch || "main",
        hasPersistentData: false,
        isAppSource: true,
      };
      if (params.envVars) payload.envVars = params.envVars;

      const res = await fetch(`${serverUrl}/captain/v1/deploy`, {
        method: "POST",
        headers: { "x-captain-auth": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await addLog("info", "CapRover deployment triggered");
      } else {
        await addLog("warn", `CapRover API responded with ${res.status}`);
      }

      return { status: "running", liveUrl: `https://${appName}.${new URL(serverUrl).hostname}` };
    },

    async getStatus(_externalId: string) {
      return { status: "running", liveUrl: null };
    },

    async stop(_externalId: string) {
      // CapRover supports force stop
    },
  };
}
