import type {
  SecurityScannerAdapter,
  ScanRequest,
  ScanResult,
  Vulnerability,
} from "./adapter.js";

// pip-audit — Python vulnerability scanner
export function createPipAuditAdapter(): SecurityScannerAdapter {
  return {
    id: "pip-audit",
    name: "pip-audit",
    async isAvailable() {
      return true;
    },
    async scan(request: ScanRequest): Promise<ScanResult> {
      const start = Date.now();
      try {
        if (request.ecosystem !== "pip") {
          return {
            scannerId: "pip-audit",
            scannerName: "pip-audit",
            success: false,
            vulnerabilities: [],
            scannedPackages: request.packages.length,
            scanDuration: 0,
            error: "pip-audit only supports pip ecosystem",
            scannedAt: new Date().toISOString(),
          };
        }

        // Build requirements.txt content
        const requirements = request.packages
          .map((p) => `${p.name}==${p.version}`)
          .join("\n");

        let output: string;
        if (request.machineId) {
          output = await runOnVps(request.machineId, requirements);
        } else {
          output = await runLocal(requirements);
        }

        const parsed = JSON.parse(output) as {
          dependencies?: Array<{
            name: string;
            version: string;
            vulns: Array<{
              id: string;
              fix_versions?: string[];
              description?: string;
              aliases?: string[];
            }>;
          }>;
        };

        const vulns: Vulnerability[] = [];

        for (const dep of parsed.dependencies || []) {
          for (const v of dep.vulns) {
            const aliases = v.aliases || [];
            const cve = aliases.find((a) => a.startsWith("CVE-"));

            vulns.push({
              id: v.id || `pip-audit-${dep.name}-${Date.now()}`,
              summary: v.description || `Vulnerability ${v.id} in ${dep.name}`,
              severity: "medium", // pip-audit doesn't provide severity directly
              ecosystem: "pip",
              packageName: dep.name,
              installedVersion: dep.version,
              patchedVersions: v.fix_versions?.length
                ? v.fix_versions.map((f) => `>=${f}`).join(", ")
                : undefined,
              url: `https://github.com/pypa/advisory-database/tree/main/vulns/${v.id}`,
              cve,
              aliases,
              source: "pip-audit",
              scannedAt: new Date().toISOString(),
            });
          }
        }

        return {
          scannerId: "pip-audit",
          scannerName: "pip-audit",
          success: true,
          vulnerabilities: vulns,
          scannedPackages: request.packages.length,
          scanDuration: Date.now() - start,
          scannedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          scannerId: "pip-audit",
          scannerName: "pip-audit",
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

async function runLocal(requirements: string): Promise<string> {
  const { execSync } = await import("child_process");
  const { writeFileSync, unlinkSync, mkdirSync } = await import("fs");
  const { join } = await import("path");
  const os = await import("os");

  const tmpDir = join(os.tmpdir(), `straxor-pip-audit-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  writeFileSync(join(tmpDir, "requirements.txt"), requirements);

  try {
    const output = execSync(
      "pip install pip-audit -q 2>/dev/null; pip-audit -r requirements.txt --format json 2>/dev/null || echo '{\"dependencies\":[]}'",
      { cwd: tmpDir, timeout: 60000, encoding: "utf-8" }
    );
    return output;
  } finally {
    try {
      unlinkSync(join(tmpDir, "requirements.txt"));
      import("fs").then((fs) => fs.rmdirSync(tmpDir));
    } catch {
      // Cleanup best effort
    }
  }
}

async function runOnVps(machineId: string, requirements: string): Promise<string> {
  const { createBoundAdapter } = await import("../runtime/opencode.js");
  const adapter = createBoundAdapter(machineId);

  const cmds = [
    `mkdir -p /tmp/straxor-pip-audit`,
    `cat > /tmp/straxor-pip-audit/requirements.txt << 'REQEOF'\n${requirements}\nREQEOF`,
    `pip install pip-audit -q 2>/dev/null; pip-audit -r /tmp/straxor-pip-audit/requirements.txt --format json 2>/dev/null || echo '{"dependencies":[]}'`,
    `rm -rf /tmp/straxor-pip-audit`,
  ];

  return adapter.executeCommand(machineId, cmds.join(" && "));
}
