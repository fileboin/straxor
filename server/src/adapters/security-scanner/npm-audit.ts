import type {
  SecurityScannerAdapter,
  ScanRequest,
  ScanResult,
  Vulnerability,
} from "./adapter.js";

// npm audit — runs via SSH on VPS or locally
export function createNpmAuditAdapter(): SecurityScannerAdapter {
  return {
    id: "npm-audit",
    name: "npm audit",
    async isAvailable() {
      return true; // Always available if npm is installed
    },
    async scan(request: ScanRequest): Promise<ScanResult> {
      const start = Date.now();
      try {
        if (request.ecosystem !== "npm") {
          return {
            scannerId: "npm-audit",
            scannerName: "npm audit",
            success: false,
            vulnerabilities: [],
            scannedPackages: request.packages.length,
            scanDuration: 0,
            error: "npm audit only supports npm ecosystem",
            scannedAt: new Date().toISOString(),
          };
        }

        // Build a temporary package.json for audit
        const deps: Record<string, string> = {};
        for (const p of request.packages) {
          deps[p.name] = p.version;
        }

        const packageJson = JSON.stringify({
          name: "straxor-audit",
          version: "1.0.0",
          dependencies: deps,
        });

        // If we have a machine, run via SSH; otherwise run locally
        let output: string;
        if (request.machineId) {
          output = await runOnVps(request.machineId, packageJson);
        } else {
          output = await runLocal(packageJson);
        }

        const parsed = JSON.parse(output) as {
          vulnerabilities?: Record<string, {
            severity: string;
            via?: Array<{ title?: string; url?: string; severity?: string }>;
            fixAvailable?: boolean | { name: string; version: string };
          }>;
        };

        const vulns: Vulnerability[] = [];

        for (const [name, info] of Object.entries(parsed.vulnerabilities || {})) {
          const severity = mapSeverity(info.severity);
          const via = info.via || [];
          const titles = via
            .filter((v) => typeof v === "object")
            .map((v) => v.title || "")
            .filter(Boolean);

          vulns.push({
            id: `npm-audit-${name}-${Date.now()}`,
            summary: titles.length > 0 ? titles.join("; ") : `Vulnerability in ${name}`,
            severity,
            ecosystem: "npm",
            packageName: name,
            installedVersion: request.packages.find((p) => p.name === name)?.version || "unknown",
            url: via.find((v) => typeof v === "object" && v.url)?.url || `https://npmjs.com/advisories/${name}`,
            source: "npm-audit",
            scannedAt: new Date().toISOString(),
          });
        }

        return {
          scannerId: "npm-audit",
          scannerName: "npm audit",
          success: true,
          vulnerabilities: vulns,
          scannedPackages: request.packages.length,
          scanDuration: Date.now() - start,
          scannedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          scannerId: "npm-audit",
          scannerName: "npm audit",
          success: false,
          vulnerabilities: [],
          scannedPackages: 0,
          scanDuration: Date.now() - start,
          error: err instanceof Error ? err.message : "Unknown error",
          scannedAt: new Date().toISOString(),
        };
      }
    },
  };
}

async function runLocal(packageJson: string): Promise<string> {
  const { execSync } = await import("child_process");
  const { writeFileSync, unlinkSync, mkdirSync } = await import("fs");
  const { join } = await import("path");
  const os = await import("os");

  const tmpDir = join(os.tmpdir(), `straxor-audit-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(join(tmpDir, "package.json"), packageJson);

  try {
    const output = execSync("npm audit --json 2>&1", {
      cwd: tmpDir,
      timeout: 30000,
      encoding: "utf-8",
    });
    return output;
  } finally {
    try {
      unlinkSync(join(tmpDir, "package.json"));
      import("fs").then((fs) => fs.rmdirSync(tmpDir));
    } catch {
      // Cleanup best effort
    }
  }
}

async function runOnVps(machineId: string, packageJson: string): Promise<string> {
  // Use RuntimeAdapter.executeCommand via the adapter registry
  // For now, we'll use a direct SSH approach
  const { createBoundAdapter } = await import("../runtime/opencode.js");
  const adapter = createBoundAdapter(machineId);

  // Create temp dir, write package.json, run audit, read output, cleanup
  const cmds = [
    `mkdir -p /tmp/straxor-audit`,
    `echo '${packageJson.replace(/'/g, "'\\''")}' > /tmp/straxor-audit/package.json`,
    `cd /tmp/straxor-audit && npm audit --json 2>&1`,
    `rm -rf /tmp/straxor-audit`,
  ];

  const result = await adapter.executeCommand(machineId, cmds.join(" && "));
  return result;
}

function mapSeverity(sev: string): "critical" | "high" | "medium" | "low" | "info" {
  const s = sev.toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "moderate" || s === "medium") return "medium";
  if (s === "low") return "low";
  return "info";
}
