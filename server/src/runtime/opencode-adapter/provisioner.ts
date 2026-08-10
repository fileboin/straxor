import type { SSHClient } from "./ssh.js";

export type ProvisionStatus =
  | "connecting"
  | "checking-os"
  | "checking-node"
  | "starting-opencode"
  | "ready"
  | "error";

export interface ProvisionEvent {
  status: ProvisionStatus;
  message: string;
  details?: string;
}

function withNodeEnv(command: string): string {
  return `export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"; ${command}`;
}

async function getPrivilegePrefix(ssh: SSHClient): Promise<string> {
  try {
    const { stdout } = await ssh.exec("id -u 2>/dev/null || echo 1");
    return stdout.trim() === "0" ? "" : "sudo ";
  } catch {
    return "sudo ";
  }
}

function summarizeLog(output: string): string {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-6)
    .join(" | ");
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
    const { stdout, code } = await ssh.exec(withNodeEnv("node --version 2>/dev/null || true"));
    if (code === 0 && stdout.trim()) {
      return stdout.trim();
    }
  } catch {}
  return null;
}

export async function installNode(ssh: SSHClient, os: string): Promise<void> {
  const installViaNvm = `
    export NVM_DIR="$HOME/.nvm"
    if [ ! -d "$NVM_DIR" ]; then
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    fi
    . "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm alias default 20
    nvm use 20
  `;

  const { code } = await ssh.exec(installViaNvm);
  if (code === 0) {
    return;
  }

  const sudoPrefix = await getPrivilegePrefix(ssh);

  if (os === "ubuntu" || os === "debian") {
    const { code: aptCode } = await ssh.exec(
      `${sudoPrefix}apt-get update -y && ` +
      `curl -fsSL https://deb.nodesource.com/setup_20.x | ${sudoPrefix}bash - && ` +
      `${sudoPrefix}apt-get install -y nodejs`
    );
    if (aptCode !== 0) throw new Error("Failed to install Node.js via apt");
    return;
  }

  if (os === "centos" || os === "rocky" || os === "alma") {
    const installCmd =
      `${sudoPrefix}bash -lc 'curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && ` +
      `(command -v dnf >/dev/null 2>&1 && dnf install -y nodejs || yum install -y nodejs)'`;
    const { code: yumCode } = await ssh.exec(installCmd);
    if (yumCode !== 0) throw new Error("Failed to install Node.js via yum/dnf");
    return;
  }

  throw new Error(`Unsupported OS for Node.js installation: ${os}`);
}

export async function getGlobalPackages(ssh: SSHClient): Promise<string[]> {
  const { stdout } = await ssh.exec(
    withNodeEnv("npm list -g --depth=0 2>/dev/null || true")
  );
  return stdout
    .split("\n")
    .filter((line) => line.includes("@") || line.includes("opencode"))
    .map((line) => line.trim());
}

export async function installOpenCode(ssh: SSHClient): Promise<void> {
  const { code, stdout, stderr } = await ssh.exec(
    withNodeEnv("npm install -g opencode-ai@latest")
  );
  if (code !== 0) {
    throw new Error(`Failed to install opencode-ai: ${summarizeLog(stderr || stdout)}`);
  }
}

export async function isPortAvailable(ssh: SSHClient, port: number): Promise<boolean> {
  const { stdout } = await ssh.exec(`ss -tlnp 2>/dev/null | grep :${port} || true`);
  return stdout.trim() === "";
}

export async function startOpenCodeServe(
  ssh: SSHClient,
  port: number = 4096
): Promise<void> {
  // Gasi stari proces i ceka da se stvarno ugasi
  await ssh.exec("pkill -f 'opencode serve' 2>/dev/null || true");
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Trazi slobodan port
  let freePort: number | null = null;
  for (let p = port; p < port + 20; p++) {
    if (await isPortAvailable(ssh, p)) {
      freePort = p;
      break;
    }
  }
  if (freePort === null) {
    throw new Error(`Nema slobodnog porta u opsegu ${port}-${port + 19}`);
  }
  port = freePort;

  const { code: binaryCode } = await ssh.exec(withNodeEnv("command -v opencode >/dev/null 2>&1"));
  if (binaryCode !== 0) {
    throw new Error("OpenCode CLI nije pronađen nakon instalacije");
  }

  const { code, stderr } = await ssh.exec(
    `nohup sh -lc '${withNodeEnv(`exec opencode serve --port ${port}`).replace(/'/g, `'\\''`)}' ` +
    `> /tmp/opencode-serve.log 2>&1 < /dev/null &`
  );

  if (code !== 0) {
    throw new Error(`Failed to start opencode serve: ${stderr}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const { stdout } = await ssh.exec("pgrep -f 'opencode serve' || true");
  if (!stdout.trim()) {
    const { stdout: logOutput } = await ssh.exec("tail -n 40 /tmp/opencode-serve.log 2>/dev/null || true");
    const summary = summarizeLog(logOutput);
    throw new Error(summary ? `opencode serve nije startovan: ${summary}` : "opencode serve process not found after start");
  }
}

export async function checkOpenCodeRunning(ssh: SSHClient): Promise<boolean> {
  const { stdout } = await ssh.exec("pgrep -f 'opencode serve' || true");
  return stdout.trim() !== "";
}

export async function getOpenCodePort(ssh: SSHClient): Promise<number | null> {
  // Pokusaj 1: pgrep da dobijemo PID, pa ss po PID-u
  try {
    const { stdout: pid } = await ssh.exec("pgrep -f 'opencode serve' 2>/dev/null | head -1 || true");
    if (pid.trim()) {
      const { stdout } = await ssh.exec(`ss -tlnp 2>/dev/null | grep 'pid=${pid.trim()},' || true`);
      const match = stdout.match(/:(\d{4,5})/);
      if (match) return parseInt(match[1], 10);
    }
  } catch {}

  // Pokusaj 2: trazimo opencode u imenu procesa u ss izlazu
  try {
    const { stdout } = await ssh.exec("ss -tlnp 2>/dev/null || true");
    for (const line of stdout.split("\n")) {
      if (line.includes("opencode")) {
        const match = line.match(/:(\d{4,5})/);
        if (match) return parseInt(match[1], 10);
      }
    }
  } catch {}

  return null;
}

export async function getOpenCodeVersion(ssh: SSHClient): Promise<string | null> {
  try {
    const { stdout, code } = await ssh.exec(
      withNodeEnv("opencode --version 2>/dev/null")
    );
    if (code === 0 && stdout.trim()) {
      return stdout.trim().replace(/^v/, "");
    }
  } catch {}
  return null;
}

export async function getOpenCodePid(ssh: SSHClient): Promise<number | null> {
  try {
    const { stdout } = await ssh.exec("pgrep -f 'opencode serve' || true");
    const pid = stdout.trim().split("\n")[0];
    return pid ? parseInt(pid, 10) : null;
  } catch {}
  return null;
}

export async function getOpenCodeUptime(ssh: SSHClient): Promise<string | null> {
  try {
    const pid = await getOpenCodePid(ssh);
    if (!pid) return null;
    const { stdout } = await ssh.exec(
      `ps -o etime= -p ${pid} 2>/dev/null || true`
    );
    return stdout.trim() || null;
  } catch {}
  return null;
}

export async function updateOpenCode(
  ssh: SSHClient,
  channel: "stable" | "beta" | "custom",
  version?: string
): Promise<void> {
  let tag: string;
  if (channel === "custom" && version) {
    tag = version;
  } else if (channel === "beta") {
    tag = "beta";
  } else {
    tag = "latest";
  }

  const { code, stdout, stderr } = await ssh.exec(
    withNodeEnv(`npm install -g opencode-ai@${tag}`)
  );
  if (code !== 0) {
    throw new Error(`Failed to update opencode to ${tag}: ${summarizeLog(stderr || stdout)}`);
  }
}
