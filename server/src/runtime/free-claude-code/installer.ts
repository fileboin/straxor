// ── Free Claude Code Installer ──

import { connectSSH, type SSHClient } from "../opencode-adapter/ssh.js";
import { FCC_REPO, FCC_DEFAULT_DIR, type FCCConfig } from "./config.js";

export interface InstallOptions {
  sshConfig: { host: string; port: number; username: string; password?: string; privateKey?: string };
  installDir?: string;
  providerApiKey?: string;
  providerModel?: string;
}

export interface InstallResult {
  success: boolean;
  version?: string;
  error?: string;
  serverUrl?: string;
}

export async function installFCC(options: InstallOptions): Promise<InstallResult> {
  const dir = options.installDir || FCC_DEFAULT_DIR;

  let ssh: SSHClient;
  try {
    ssh = await connectSSH(options.sshConfig);
  } catch (err) {
    return { success: false, error: `SSH connection failed: ${String(err)}` };
  }

  try {
    // 1. Check prerequisites: git, python3, curl
    const prereqs = await ssh.exec(
      `command -v git 2>/dev/null && command -v python3 2>/dev/null && command -v curl 2>/dev/null && echo "OK" || echo "MISSING"`
    );
    if (!prereqs.stdout.trim().includes("OK")) {
      await ssh.exec(
        `apt-get update -qq && apt-get install -y -qq git python3 python3-pip curl 2>&1 || yum install -y git python3 python3-pip curl 2>&1 || true`
      );
    }

    // 2. Clone or update the FCC repo
    const repoCheck = await ssh.exec(`test -d "${dir}/.git" && echo "EXISTS" || echo "NOT_FOUND"`);
    if (repoCheck.stdout.trim() === "EXISTS") {
      await ssh.exec(`cd "${dir}" && git pull --ff-only 2>&1`);
    } else {
      await ssh.exec(`mkdir -p "${dir}" && git clone ${FCC_REPO} "${dir}" 2>&1`);
    }

    // 3. Run the FCC installer (install.sh equivalent)
    const installResult = await ssh.exec(
      `cd "${dir}" && chmod +x scripts/install.sh 2>/dev/null; bash scripts/install.sh 2>&1 || echo "INSTALL_DONE"`
    );

    // 4. Create .env with provider config
    if (options.providerApiKey) {
      const providerEnv = `NVIDIA_NIM_API_KEY=${options.providerApiKey}
MODEL=${options.providerModel || "nvidia_nim/nvidia/nemotron-3-super-120b-a12b"}
FCC_PORT=8082
`;
      await ssh.exec(`cat > "${dir}/.env" << 'ENVEOF'\n${providerEnv}\nENVEOF`);
    }

    // 5. Check version
    const versionResult = await ssh.exec(`cd "${dir}" && cat pyproject.toml | grep "^version" | head -1 || echo "unknown"`);
    const version = versionResult.stdout.trim().replace('version = "', "").replace('"', "") || "unknown";

    return {
      success: true,
      version,
      serverUrl: `http://${options.sshConfig.host}:8082`,
    };
  } catch (err) {
    return { success: false, error: `Installation failed: ${String(err)}` };
  } finally {
    ssh.close();
  }
}

export async function uninstallFCC(sshConfig: InstallOptions["sshConfig"]): Promise<boolean> {
  let ssh;
  try {
    ssh = await connectSSH(sshConfig);
    await ssh.exec(`
      fcc-server --stop 2>/dev/null || true
      rm -rf "${FCC_DEFAULT_DIR}" ~/.fcc ~/.local/share/fcc 2>/dev/null || true
      pip3 uninstall -y free-claude-code 2>/dev/null || true
    `);
    return true;
  } catch {
    return false;
  } finally {
    ssh?.close();
  }
}

export async function checkFCCInstalled(sshConfig: InstallOptions["sshConfig"]): Promise<boolean> {
  let ssh;
  try {
    ssh = await connectSSH(sshConfig);
    const { stdout } = await ssh.exec(
      `test -d "${FCC_DEFAULT_DIR}/.git" && command -v fcc-server 2>/dev/null && echo "YES" || echo "NO"`
    );
    return stdout.trim() === "YES";
  } catch {
    return false;
  } finally {
    ssh?.close();
  }
}
