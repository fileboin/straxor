// ── Free Claude Code Log Capture ──

import type { SSHClient } from "../opencode-adapter/ssh.js";

export interface FCCLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  source: string;
}

export interface FCCLogs {
  entries: FCCLogEntry[];
  serverLog: string;
  agentLog: string;
}

export async function captureFCCLogs(
  ssh: SSHClient,
  installDir: string
): Promise<FCCLogs> {
  // Capture FCC server logs
  const { stdout: serverLog } = await ssh.exec(
    `cat /tmp/fcc-server.log 2>/dev/null || journalctl -u fcc-server --no-pager -n 200 2>/dev/null || echo "No server log found"`
  );

  // Capture agent execution logs
  const { stdout: agentLog } = await ssh.exec(
    `cat /tmp/fcc-agent.log 2>/dev/null || echo "No agent log found"`
  );

  // Parse structured entries from combined logs
  const raw = `${serverLog}\n${agentLog}`;
  const entries: FCCLogEntry[] = raw
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      // Try to parse loguru format: 2025-01-15 10:30:00.123 | INFO | message
      const loguruMatch = line.match(
        /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s*\|\s*(\w+)\s*\|(.+)$/
      );
      if (loguruMatch) {
        return {
          timestamp: loguruMatch[1],
          level: loguruMatch[2].toLowerCase() as FCCLogEntry["level"],
          message: loguruMatch[3].trim(),
          source: "fcc-server",
        };
      }

      // Try ISO timestamp format: 2025-01-15T10:30:00.000Z - level - message
      const isoMatch = line.match(
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s*[-:]\s*(\w+)\s*[-:]\s*(.+)/
      );
      if (isoMatch) {
        return {
          timestamp: isoMatch[1],
          level: isoMatch[2].toLowerCase() as FCCLogEntry["level"],
          message: isoMatch[3].trim(),
          source: "fcc-agent",
        };
      }

      // Fallback: treat entire line as info
      return {
        timestamp: new Date().toISOString(),
        level: "info",
        message: line.trim(),
        source: "fcc",
      };
    });

  return { entries, serverLog, agentLog };
}

export async function tailFCCLogs(
  ssh: SSHClient,
  lines: number = 50
): Promise<string> {
  const { stdout } = await ssh.exec(`tail -n ${lines} /tmp/fcc-server.log 2>/dev/null || echo ""`);
  return stdout;
}

export async function clearFCCLogs(ssh: SSHClient): Promise<void> {
  await ssh.exec(`truncate -s 0 /tmp/fcc-server.log 2>/dev/null; truncate -s 0 /tmp/fcc-agent.log 2>/dev/null; true`);
}
