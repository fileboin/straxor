// ── Free Claude Code Runner ──
// Manages FCC server lifecycle and task execution on the remote VPS.

import type { SSHClient } from "../opencode-adapter/ssh.js";

export interface TaskResult {
  success: boolean;
  output: string;
  error?: string;
  changedFiles: string[];
}

export interface ServerStatus {
  running: boolean;
  port: number;
  pid?: number;
  url?: string;
  adminUrl?: string;
  error?: string;
}

// Track active server PIDs per machine
const activeServers = new Map<string, { pid: number; port: number }>();

export async function startServer(
  ssh: SSHClient,
  installDir: string,
  port: number = 8082
): Promise<ServerStatus> {
  // Check if already running
  const { stdout: checkResult } = await ssh.exec(
    `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${port}/admin 2>/dev/null || echo "000"`
  );
  if (checkResult.trim() !== "000") {
    const { stdout: pidResult } = await ssh.exec(
      `pgrep -f "fcc-server" | head -1 || echo ""`
    );
    const pid = parseInt(pidResult.trim(), 10);
    return {
      running: true,
      port,
      pid: isNaN(pid) ? undefined : pid,
      url: `http://${port}`,
      adminUrl: `http://127.0.0.1:${port}/admin`,
    };
  }

  // Start server in background
  const { stdout: startResult } = await ssh.exec(
    `cd "${installDir}" && nohup fcc-server > /tmp/fcc-server.log 2>&1 & echo $!`
  );
  const pid = parseInt(startResult.trim(), 10);

  if (isNaN(pid)) {
    return { running: false, port };
  }

  activeServers.set(installDir, { pid, port });

  // Wait for server to be ready
  for (let i = 0; i < 15; i++) {
    const { stdout: ready } = await ssh.exec(
      `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${port}/admin 2>/dev/null || echo "000"`
    );
    if (ready.trim() === "200") {
      return {
        running: true,
        port,
        pid,
        url: `http://${port}`,
        adminUrl: `http://127.0.0.1:${port}/admin`,
      };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  return { running: false, port, pid, error: "Server failed to start within 15s" };
}

export async function stopServer(ssh: SSHClient, installDir: string): Promise<boolean> {
  const existing = activeServers.get(installDir);
  if (existing) {
    await ssh.exec(`kill ${existing.pid} 2>/dev/null; pkill -f fcc-server 2>/dev/null; true`);
    activeServers.delete(installDir);
    return true;
  }
  await ssh.exec(`pkill -f fcc-server 2>/dev/null; true`);
  return true;
}

export async function getServerStatus(
  ssh: SSHClient,
  installDir: string,
  port: number = 8082
): Promise<ServerStatus> {
  const { stdout: httpCheck } = await ssh.exec(
    `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${port}/admin 2>/dev/null || echo "000"`
  );
  const isRunning = httpCheck.trim() === "200";

  let pid: number | undefined;
  if (isRunning) {
    const { stdout: pidResult } = await ssh.exec(`pgrep -f "fcc-server" | head -1 || echo ""`);
    const parsed = parseInt(pidResult.trim(), 10);
    if (!isNaN(parsed)) pid = parsed;
  }

  return {
    running: isRunning,
    port,
    pid,
    url: isRunning ? `http://${port}` : undefined,
    adminUrl: isRunning ? `http://127.0.0.1:${port}/admin` : undefined,
  };
}

export async function executeTask(
  ssh: SSHClient,
  projectDir: string,
  task: string,
  timeout: number = 120_000
): Promise<TaskResult> {
  // Ensure git is initialized for diff tracking
  await ssh.exec(`cd "${projectDir}" && git init 2>/dev/null && git add -A && git commit -m "initial" --allow-empty 2>/dev/null; true`);

  // Run the task via fcc-codex exec
  const escapedTask = task.replace(/'/g, "'\\''");
  const { stdout, stderr, code } = await ssh.exec(
    `cd "${projectDir}" && timeout ${Math.floor(timeout / 1000)} fcc-codex exec '${escapedTask}' 2>&1 | tee /tmp/fcc-agent.log`
  );

  // Get changed files via git diff
  const { stdout: diffStdout } = await ssh.exec(
    `cd "${projectDir}" && git diff --name-only HEAD 2>/dev/null || echo ""`
  );
  const changedFiles = diffStdout
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  return {
    success: code === 0,
    output: stdout,
    error: stderr || undefined,
    changedFiles,
  };
}
