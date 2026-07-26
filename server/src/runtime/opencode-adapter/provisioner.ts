import type { SSHClient } from "./ssh.js";

export type ProvisionStatus =
  | "connecting"
  | "checking-os"
  | "checking-node"
  | "installing-node"
  | "starting-opencode"
  | "ready"
  | "error";

export interface ProvisionEvent {
  status: ProvisionStatus;
  message: string;
  details?: string;
}

export async function detectOS(ssh: SSHClient): Promise<string> {
  const { stdout } = await ssh.exec("cat /etc/os-release 2>/dev/null || uname -s");
  const lines = stdout.split("\n");

  for (const line of lines) {
    if (line.startsWith("ID=")) {
      return line.split("=")[1].replace(/"/g, "").trim().toLowerCase();
    }
  }

  if (stdout.includes("Ubuntu")) return "ubuntu";
  if (stdout.includes("Debian")) return "debian";
  if (stdout.includes("CentOS")) return "centos";
  if (stdout.includes("Rocky")) return "rocky";
  if (stdout.includes("AlmaLinux")) return "alma";

  return "unknown";
}

export async function getNodeVersion(ssh: SSHClient): Promise<string | null> {
  try {
    const { stdout, code } = await ssh.exec("node --version 2>/dev/null");
    if (code === 0 && stdout.trim()) {
      return stdout.trim();
    }
  } catch {}
  return null;
}

export async function installNode(ssh: SSHClient, os: string): Promise<void> {
  // Try nvm first (most reliable)
  const installScript = `
    export NVM_DIR="$HOME/.nvm"
    if [ ! -d "$NVM_DIR" ]; then
      curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    fi
    . "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
  `;

  const { code } = await ssh.exec(installScript);
  if (code !== 0) {
    // Fallback: try package manager
    if (os === "ubuntu" || os === "debian") {
      const { code: aptCode } = await ssh.exec(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
      );
      if (aptCode !== 0) throw new Error("Failed to install Node.js via apt");
    } else if (os === "centos" || os === "rocky" || os === "alma") {
      const { code: yumCode } = await ssh.exec(
        "curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
      );
      if (yumCode !== 0) throw new Error("Failed to Install Node.js via yum");
    } else {
      throw new Error(`Unsupported OS for Node.js installation: ${os}`);
    }
  }
}

export async function getGlobalPackages(ssh: SSHClient): Promise<string[]> {
  const { stdout } = await ssh.exec(
    'export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" 2>/dev/null; npm list -g --depth=0 2>/dev/null || true'
  );
  return stdout
    .split("\n")
    .filter((line) => line.includes("@") || line.includes("opencode"))
    .map((line) => line.trim());
}

export async function installOpenCode(ssh: SSHClient): Promise<void> {
  const { code, stderr } = await ssh.exec(
    'export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" 2>/dev/null; npm install -g opencode@latest 2>&1'
  );
  if (code !== 0) {
    throw new Error(`Failed to install opencode: ${stderr}`);
  }
}

export async function isPortAvailable(ssh: SSHClient, port: number): Promise<boolean> {
  const { stdout } = await ssh.exec(`ss -tlnp | grep :${port} || true`);
  return stdout.trim() === "";
}

export async function startOpenCodeServe(
  ssh: SSHClient,
  port: number = 4096
): Promise<void> {
  // Kill any existing opencode process
  await ssh.exec("pkill -f 'opencode serve' 2>/dev/null || true");

  // Check if port is available
  const available = await isPortAvailable(ssh, port);
  if (!available) {
    // Try next port
    for (let p = port; p < port + 10; p++) {
      if (await isPortAvailable(ssh, p)) {
        port = p;
        break;
      }
    }
  }

  // Start opencode serve in background with nohup
  const { code, stderr } = await ssh.exec(
    `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" 2>/dev/null; nohup opencode serve --port ${port} > /tmp/opencode-serve.log 2>&1 &`
  );

  if (code !== 0) {
    throw new Error(`Failed to start opencode serve: ${stderr}`);
  }

  // Wait a moment and check if it started
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const { stdout } = await ssh.exec("pgrep -f 'opencode serve' || true");
  if (!stdout.trim()) {
    throw new Error("opencode serve process not found after start");
  }
}

export async function checkOpenCodeRunning(ssh: SSHClient): Promise<boolean> {
  const { stdout } = await ssh.exec("pgrep -f 'opencode serve' || true");
  return stdout.trim() !== "";
}

export async function getOpenCodePort(ssh: SSHClient): Promise<number | null> {
  const { stdout } = await ssh.exec(
    "ss -tlnp | grep opencode 2>/dev/null || true"
  );
  const match = stdout.match(/:(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
