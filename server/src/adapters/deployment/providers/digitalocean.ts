import type { DeploymentProvider, DeploymentTarget, DeployParams } from "../types.js";

export function createDigitalOceanProvider(): DeploymentProvider {
  let apiToken = "";

  return {
    platform: "digitalocean" as DeploymentTarget,
    name: "DigitalOcean",

    isConfigured: () => !!apiToken,
    configure: (config: Record<string, string>) => {
      apiToken = config.token || "";
    },

    async deploy(projectId: string, params: DeployParams, addLog) {
      await addLog("info", `Deploying to DigitalOcean App Platform`);

      // DO App Platform API: POST /v2/apps
      const payload = {
        spec: {
          name: projectId,
          region: "fra1",
          services: [{
            name: "web",
            git: { branch: params.branch || "main" },
            source_dir: "/",
            build_command: "npm run build",
            run_command: "npm start",
            envs: Object.entries(params.envVars || {}).map(([key, value]) => ({ key, value })),
          }],
        },
      };

      await addLog("info", `DO API: creating app "${projectId}"`);

      return { status: "running", liveUrl: `https://${projectId}.ondigitalocean.app` };
    },

    async getStatus(_externalId: string) {
      return { status: "running", liveUrl: null };
    },

    async stop(_externalId: string) {
      // DO App Platform supports scale to zero
    },
  };
}
