import type { DeploymentProvider, DeploymentTarget, DeployParams } from "../types.js";

export function createCloudflareProvider(): DeploymentProvider {
  let apiToken = "";
  let accountId = "";

  return {
    platform: "cloudflare" as DeploymentTarget,
    name: "Cloudflare Pages",

    isConfigured: () => !!apiToken && !!accountId,
    configure: (config: Record<string, string>) => {
      apiToken = config.token || "";
      accountId = config.accountId || "";
    },

    async deploy(projectId: string, params: DeployParams, addLog) {
      await addLog("info", `Deploying to Cloudflare Pages — project: ${projectId}`);

      // CF Pages API: POST /accounts/:accountId/pages/projects/:name/deploy
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectId}/deploy`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ branch: params.branch || "main" }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        await addLog("info", `Cloudflare Pages deploy triggered`);
        return { status: "running", liveUrl: `https://${projectId}.pages.dev` };
      }

      await addLog("warn", `Cloudflare API: ${res.status}`);
      return { status: "running", liveUrl: `https://${projectId}.pages.dev` };
    },

    async getStatus(_externalId: string) {
      return { status: "running", liveUrl: null };
    },

    async stop(_externalId: string) {
      // CF supports cancelling
    },
  };
}
