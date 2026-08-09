import type { SSHClient } from "./ssh.js";

export type CoolifyInstallStatus =
  | "connecting"
  | "checking-os"
  | "checking-docker"
  | "installing-docker"
  | "checking-coolify"
  | "installing-coolify"
  | "ready"
  | "error";

export interface CoolifyInstallEvent {
  status: CoolifyInstallStatus;
  message: string;
  details?: string;
}

export async function hasDocker(ssh: SSHClient): Promise<boolean> {
  const { code, stdout } = await ssh.exec("docker --version 2>/dev/null || true");
  return code === 0 && /docker version/i.test(stdout);
}

export async function installDocker(ssh: SSHClient, os: string): Promise<void> {
  const script = [
    "set -e",
    "if command -v docker >/dev/null 2>&1; then exit 0; fi",
    "curl -fsSL https://get.docker.com | sh",
    "if command -v systemctl >/dev/null 2>&1; then sudo systemctl enable docker || true; sudo systemctl start docker || true; fi",
  ].join("; ");

  const { code, stderr } = await ssh.exec(script);
  if (code !== 0) throw new Error(stderr || `Failed to install Docker on ${os}`);
}

export async function isCoolifyInstalled(ssh: SSHClient): Promise<boolean> {
  const { stdout } = await ssh.exec("docker ps -a --format '{{.Names}}' 2>/dev/null | grep '^coolify$' || true");
  return stdout.trim() === "coolify";
}

export async function getCoolifyUrlHint(ssh: SSHClient): Promise<string | null> {
  const { stdout } = await ssh.exec("hostname -I 2>/dev/null | awk '{print $1}' || true");
  const ip = stdout.trim().split(/\s+/)[0] || "";
  return ip ? `http://${ip}:8000` : null;
}

export async function installCoolify(ssh: SSHClient): Promise<void> {
  const cmd = [
    "set -e",
    "export COOLIFY_INSTALLATION_ROOT=${COOLIFY_INSTALLATION_ROOT:-/data/coolify}",
    "curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash",
  ].join("; ");

  const { code, stderr } = await ssh.exec(cmd);
  if (code !== 0) throw new Error(stderr || "Coolify installation failed");
}
