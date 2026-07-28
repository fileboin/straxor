import { connectSSH, type SSHConfig } from "../opencode-adapter/ssh.js";
import { QUICKSTART_TEMPLATES, type QuickStartTemplate, type QuickStartFile } from "./templates.js";

export interface ScaffoldOptions {
  templateId: string;
  projectName: string;
  sshConfig: SSHConfig;
  targetDir?: string;
}

export interface ScaffoldResult {
  success: boolean;
  projectDir: string;
  error?: string;
}

export interface DevServerStatus {
  running: boolean;
  port: number;
  pid?: number;
  url?: string;
  error?: string;
}

const activeDevServers = new Map<string, { pid: number; port: number }>();

export async function scaffoldProject(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const template = QUICKSTART_TEMPLATES.find((t) => t.id === options.templateId);
  if (!template) {
    return { success: false, projectDir: "", error: `Template "${options.templateId}" not found` };
  }

  const dir = options.targetDir || `/root/projects/${options.projectName.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  let ssh;
  try {
    ssh = await connectSSH(options.sshConfig);
  } catch (err) {
    return { success: false, projectDir: dir, error: `SSH connection failed: ${String(err)}` };
  }

  try {
    // Create target directory
    await ssh.exec(`mkdir -p "${dir}"`);

    // Write each file via heredoc
    for (const file of template.files) {
      const filePath = `${dir}/${file.path}`;
      const parentDir = filePath.substring(0, filePath.lastIndexOf("/"));
      await ssh.exec(`mkdir -p "${parentDir}"`);
      await writeFileViaSSH(ssh, filePath, file.content);
    }

    // Create .gitignore
    const gitignore = `node_modules/\n.cache/\ndist/\n.env\n`;
    await writeFileViaSSH(ssh, `${dir}/.gitignore`, gitignore);

    return { success: true, projectDir: dir };
  } catch (err) {
    return { success: false, projectDir: dir, error: `Scaffold failed: ${String(err)}` };
  } finally {
    ssh.close();
  }
}

export async function startDevServer(
  sshConfig: SSHConfig,
  projectDir: string,
  template: QuickStartTemplate,
  projectName: string
): Promise<DevServerStatus> {
  const key = `${projectDir}`;

  // Stop existing server if any
  if (activeDevServers.has(key)) {
    await stopDevServer(projectDir);
  }

  let ssh;
  try {
    ssh = await connectSSH(sshConfig);
  } catch {
    return { running: false, port: template.port };
  }

  try {
    // Install deps
    await ssh.exec(`cd "${projectDir}" && ${template.installCommand}`);

    // Start dev server in background
    const result = await ssh.exec(
      `cd "${projectDir}" && nohup ${template.devCommand} > /tmp/${projectName}-dev.log 2>&1 & echo $!`
    );
    const pid = parseInt(result.stdout.trim(), 10);
    if (isNaN(pid)) {
      return { running: false, port: template.port, error: "Failed to get PID" };
    }

    activeDevServers.set(key, { pid, port: template.port });

    return {
      running: true,
      port: template.port,
      pid,
      url: `http://${sshConfig.host}:${template.port}`,
    };
  } catch (err) {
    return { running: false, port: template.port, error: String(err) };
  } finally {
    ssh.close();
  }
}

export async function stopDevServer(projectDir: string): Promise<void> {
  const key = projectDir;
  const existing = activeDevServers.get(key);
  if (!existing) return;

  let ssh;
  try {
    ssh = await connectSSH({ host: "localhost", port: 22, username: "root" });
    await ssh.exec(`kill ${existing.pid} 2>/dev/null; pkill -f "vite" 2>/dev/null; true`);
  } catch {
    // Best effort
  } finally {
    ssh?.close();
  }

  activeDevServers.delete(key);
}

export function getDevStatus(projectDir: string): DevServerStatus {
  const existing = activeDevServers.get(projectDir);
  if (!existing) return { running: false, port: 5173 };
  return { running: true, port: existing.port, pid: existing.pid };
}

async function writeFileViaSSH(ssh: { exec: (cmd: string) => Promise<{ stdout: string; stderr: string; code: number }> }, filePath: string, content: string): Promise<void> {
  // Escape single quotes for heredoc
  const escaped = content.replace(/'/g, "'\\''");
  // Use base64 to avoid escaping issues with heredoc
  const b64 = Buffer.from(content).toString("base64");
  await ssh.exec(`echo '${b64}' | base64 -d > "${filePath}"`);
}
