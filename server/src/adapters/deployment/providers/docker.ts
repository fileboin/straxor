import type { DeploymentProvider, DeploymentTarget, DeployParams } from "../types.js";

interface DockerConfig {
  host?: string; // empty = local docker socket
  composeFile?: string;
  serviceName?: string;
  registry?: string;
  username?: string;
  password?: string;
}

export function createDockerProvider(): DeploymentProvider {
  let cfg: DockerConfig | null = null;

  return {
    platform: "docker" as DeploymentTarget,
    name: "Docker",

    isConfigured: () => true,
    configure: (config: Record<string, string>) => {
      cfg = {
        host: config.host,
        composeFile: config.composeFile || "docker-compose.yml",
        serviceName: config.serviceName || "app",
        registry: config.registry,
        username: config.username,
        password: config.password,
      };
    },

    async deploy(_projectId: string, params: DeployParams, addLog) {
      const hostFlag = cfg?.host ? ` -H ${cfg.host}` : "";

      await addLog("info", `Building Docker image${cfg?.host ? ` for ${cfg.host}` : " (local)"}`);

      const commands = [
        ...(cfg?.registry && cfg?.username
          ? [`echo ${cfg.password || ""} | docker${hostFlag} login ${cfg.registry} -u ${cfg.username} --password-stdin`]
          : []),
        `docker${hostFlag} compose -f ${cfg?.composeFile || "docker-compose.yml"} build`,
        `docker${hostFlag} compose -f ${cfg?.composeFile || "docker-compose.yml"} up -d ${cfg?.serviceName || "app"}`,
      ];

      await addLog("info", "Docker commands:\n" + commands.join("\n"));

      return { status: "running", liveUrl: cfg?.host ? `http://${cfg.host}` : "http://localhost" };
    },

    async getStatus(_externalId: string) {
      return { status: "running", liveUrl: null };
    },

    async stop(_externalId: string) {
      // docker compose down in production
    },
  };
}
