import type {
  SecurityScannerAdapter,
  ScanRequest,
  ScanResult,
  Vulnerability,
  Severity,
} from "./adapter.js";

// Socket.dev API — deep supply chain analysis
export function createSocketAdapter(): SecurityScannerAdapter {
  return {
    id: "socket",
    name: "Socket.dev",
    async isAvailable() {
      return !!process.env.SOCKET_API_KEY;
    },
    async scan(request: ScanRequest): Promise<ScanResult> {
      const start = Date.now();
      try {
        if (!process.env.SOCKET_API_KEY) {
          return {
            scannerId: "socket",
            scannerName: "Socket.dev",
            success: false,
            vulnerabilities: [],
            scannedPackages: 0,
            scanDuration: 0,
            error: "SOCKET_API_KEY not configured",
            scannedAt: new Date().toISOString(),
          };
        }

        const vulns: Vulnerability[] = [];

        // Socket.dev API — batch check packages
        const packages = request.packages.map(
          (p) => `${request.ecosystem}:${p.name}@${p.version}`
        );

        const res = await fetch("https://api.socket.dev/v1/packages/batch", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.SOCKET_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            packages,
            report_summary: true,
          }),
        });

        if (!res.ok) {
          throw new Error(`Socket API returned ${res.status}`);
        }

        const data = await res.json() as Record<string, unknown>;

        // Parse response — each package may have risk signals
        for (const pkg of request.packages) {
          const pkgKey = `${request.ecosystem}:${pkg.name}@${pkg.version}`;
          const pkgData = (data as Record<string, Record<string, unknown>>)[pkgKey];
          if (!pkgData) continue;

          const riskScore = (pkgData.risk_score as number) || 0;
          const malware = pkgData.malware as boolean;
          const typosquatting = pkgData.typosquatting as boolean;
          const installScripts = pkgData.install_scripts as boolean;
          const netOps = pkgData.network_access as boolean;

          // Map risk signals to vulnerabilities
          if (malware) {
            vulns.push(makeVuln(pkg.name, pkg.version, "critical", "Package flagged as malware", "socket"));
          }
          if (typosquatting) {
            vulns.push(makeVuln(pkg.name, pkg.version, "high", "Possible typosquatting detected", "socket"));
          }
          if (installScripts && riskScore > 70) {
            vulns.push(makeVuln(pkg.name, pkg.version, "medium", "Suspicious install scripts detected", "socket"));
          }
          if (netOps && riskScore > 80) {
            vulns.push(makeVuln(pkg.name, pkg.version, "medium", "Unexpected network operations", "socket"));
          }
          if (riskScore > 90) {
            vulns.push(makeVuln(pkg.name, pkg.version, "high", `High risk score: ${riskScore}/100`, "socket"));
          }
        }

        return {
          scannerId: "socket",
          scannerName: "Socket.dev",
          success: true,
          vulnerabilities: vulns,
          scannedPackages: request.packages.length,
          scanDuration: Date.now() - start,
          scannedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          scannerId: "socket",
          scannerName: "Socket.dev",
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

function makeVuln(
  name: string,
  version: string,
  severity: Severity,
  summary: string,
  source: "socket"
): Vulnerability {
  return {
    id: `socket-${name}-${version}-${Date.now()}`,
    summary,
    severity,
    ecosystem: "npm",
    packageName: name,
    installedVersion: version,
    source,
    scannedAt: new Date().toISOString(),
  };
}
