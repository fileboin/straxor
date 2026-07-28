import type { DeploymentProvider, DeploymentTarget, DeployParams } from "../types.js";

interface SshConfig {
  host: string;
  port: number;
  user: string;
  key?: string;
  password?: string;
  deployPath: string;
}

export function createVpsProvider(): DeploymentProvider {
  let cfg: SshConfig | null = null;

  return {
    platform: "vps" as DeploymentTarget,
    name: "VPS (SSH)",

    isConfigured: () => !!cfg?.host && !!cfg?.user,
    configure: (config: Record<string, string>) => {
      cfg = {
        host: config.host || "",
        port: parseInt(config.port || "22"),
        user: config.user || "",
        key: config.key,
        password: config.password,
        deployPath: config.deployPath || "/var/www/app",
      };
    },

    async deploy(_projectId: string, params: DeployParams, addLog) {
      if (!cfg) throw new Error("VPS provider not configured");

      await addLog("info", `Connecting to ${cfg.user}@${cfg.host}:${cfg.port}`);
      await addLog("info", `Pulling branch ${params.branch || "main"} to ${cfg.deployPath}`);

      // SSH commands run via a shell executor — simulated here
      const commands = [
        `cd ${cfg.deployPath}`,
        `git fetch origin`,
        `git checkout ${params.branch || "main"}`,
        `git pull origin ${params.branch || "main"}`,
        ...Object.entries(params.envVars || {}).map(([k, v]) => `export ${k}=${v}`),
        `npm ci --production 2>/dev/null || true`,
        `npm run build 2>/dev/null || true`,
        `pm2 restart app 2>/dev/null || systemctl restart app 2>/dev/null || true`,
      ];

      // In production, these run over SSH via runtime adapter
      await addLog("info", "Commands queued:\n" + commands.join("\n"));

      return { status: "running", liveUrl: `https://${cfg.host}` };
    },

    async getStatus(_externalId: string) {
      // In production, SSH in and check pm2/systemd status
      return { status: "running", liveUrl: cfg ? `https://${cfg.host}` : null };
    },

    async stop(_externalId: string) {
      // In production, SSH in and stop the app
    },
  };
}
