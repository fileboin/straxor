import type {
  SecurityScannerAdapter,
  ScanRequest,
  ScanResult,
  Vulnerability,
} from "./adapter.js";

// osv-scanner — Google's official scanner CLI
export function createOsvScannerAdapter(): SecurityScannerAdapter {
  return {
    id: "osv-scanner",
    name: "osv-scanner",
    async isAvailable() {
      return true;
    },
    async scan(request: ScanRequest): Promise<ScanResult> {
      const start = Date.now();
      try {
        // osv-scanner supports lockfile scanning or individual packages
        // We'll use the --experimental-atags approach for direct package scanning

        let output: string;
        if (request.machineId) {
          output = await runOnVps(request);
        } else {
          output = await runLocal(request);
        }

        const parsed = JSON.parse(output) as {
          results?: Array<{
            packages: Array<{
              package: { name: string; ecosystem: string };
              vulnerabilities: Array<{
                id: string;
                summary?: string;
                severity?: string;
                database_specific?: { severity?: string };
                aliases?: string[];
                affected?: Array<{
                  ranges?: Array<{
                    events?: Array<{ fixed?: string }>;
                  }>;
                }>;
              }>;
            }>;
          }>;
        };

        const vulns: Vulnerability[] = [];

        for (const result of parsed.results || []) {
          for (const pkg of result.packages) {
            const pkgName = pkg.package.name;

            for (const v of pkg.vulnerabilities) {
              const severity = mapSeverity(
                v.database_specific?.severity || v.severity || "MEDIUM"
              );

              // Extract patched version
              let patchedVersions: string | undefined;
              for (const affected of v.affected || []) {
                for (const range of affected.ranges || []) {
                  for (const event of range.events || []) {
                    if (event.fixed) {
                      patchedVersions = `>=${event.fixed}`;
                    }
                  }
                }
              }

              const cve = v.aliases?.find((a) => a.startsWith("CVE-"));

              vulns.push({
                id: v.id || `osv-scanner-${pkgName}-${Date.now()}`,
                summary: v.summary || `Vulnerability in ${pkgName}`,
                severity,
                ecosystem: request.ecosystem,
                packageName: pkgName,
                installedVersion: request.packages.find((p) => p.name === pkgName)?.version || "unknown",
                patchedVersions,
                url: `https://osv.dev/vulnerability/${v.id}`,
                cve,
                aliases: v.aliases,
                source: "osv-scanner",
                scannedAt: new Date().toISOString(),
              });
            }
          }
        }

        return {
          scannerId: "osv-scanner",
          scannerName: "osv-scanner",
          success: true,
          vulnerabilities: vulns,
          scannedPackages: request.packages.length,
          scanDuration: Date.now() - start,
          scannedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          scannerId: "osv-scanner",
          scannerName: "osv-scanner",
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

async function runLocal(request: ScanRequest): Promise<string> {
  const { execSync } = await import("child_process");
  const { writeFileSync, unlinkSync, mkdirSync } = await import("fs");
  const { join } = await import("path");
  const os = await import("os");

  const tmpDir = join(os.tmpdir(), `straxor-osv-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Build a simple lockfile-like format osv-scanner understands
  const lockfileContent = JSON.stringify({
    ...buildLockfile(request),
  });

  const lockfilePath = join(tmpDir, "package-lock.json");
  writeFileSync(lockfilePath, lockfileContent);

  try {
    const output = execSync(
      `npx osv-scanner --lockfile=${lockfilePath} --format json 2>/dev/null || echo '{"results":[]}'`,
      { cwd: tmpDir, timeout: 60000, encoding: "utf-8" }
    );
    return output;
  } finally {
    try {
      unlinkSync(lockfilePath);
      import("fs").then((fs) => fs.rmdirSync(tmpDir));
    } catch {
      // Cleanup best effort
    }
  }
}

async function runOnVps(request: ScanRequest): Promise<string> {
  const { createBoundAdapter } = await import("../runtime/opencode.js");
  const adapter = createBoundAdapter(request.machineId!);

  const lockfile = JSON.stringify(buildLockfile(request));
  const cmds = [
    `mkdir -p /tmp/straxor-osv`,
    `cat > /tmp/straxor-osv/package-lock.json << 'LOCKEOF'\n${lockfile}\nLOCKEOF`,
    `npx osv-scanner --lockfile=/tmp/straxor-osv/package-lock.json --format json 2>/dev/null || echo '{"results":[]}'`,
    `rm -rf /tmp/straxor-osv`,
  ];

  return adapter.executeCommand(request.machineId!, cmds.join(" && "));
}

function buildLockfile(request: ScanRequest): Record<string, unknown> {
  // Minimal lockfile format osv-scanner understands
  const lockfile: Record<string, unknown> = {
    lockfileVersion: 3,
    packages: {},
  };

  const pkgs = lockfile.packages as Record<string, Record<string, string>>;
  for (const p of request.packages) {
    pkgs[`node_modules/${p.name}`] = {
      version: p.version,
      resolved: `https://registry.npmjs.org/${p.name}/-/${p.name}-${p.version}.tgz`,
    };
  }

  return lockfile;
}

function mapSeverity(sev: string): "critical" | "high" | "medium" | "low" | "info" {
  const s = sev.toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "medium" || s === "moderate") return "medium";
  if (s === "low") return "low";
  return "info";
}
