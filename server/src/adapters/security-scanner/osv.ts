import type {
  SecurityScannerAdapter,
  ScanRequest,
  ScanResult,
  Vulnerability,
} from "./adapter.js";

// OSV.dev — Google's open vulnerability database
export function createOsvAdapter(): SecurityScannerAdapter {
  return {
    id: "osv",
    name: "OSV.dev",
    async isAvailable() {
      return true; // Public API, no key needed
    },
    async scan(request: ScanRequest): Promise<ScanResult> {
      const start = Date.now();
      try {
        const vulns: Vulnerability[] = [];

        // OSV batch query endpoint
        const queries = request.packages.map((p) => ({
          package: {
            name: p.name,
            ecosystem: mapEcosystem(request.ecosystem),
          },
          version: p.version,
        }));

        const res = await fetch("https://api.osv.dev/v1/querybatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queries }),
        });

        if (!res.ok) {
          throw new Error(`OSV API returned ${res.status}`);
        }

        const data = (await res.json()) as { results: Array<{ vulns?: Array<Record<string, unknown>> }> };

        for (let i = 0; i < request.packages.length; i++) {
          const pkg = request.packages[i];
          const result = data.results[i];
          if (!result?.vulns) continue;

          for (const v of result.vulns) {
            const severity = extractSeverity(v);
            vulns.push({
              id: (v.id as string) || `osv-${pkg.name}-${Date.now()}`,
              summary: (v.summary as string) || (v.details as string)?.substring(0, 200) || "No description",
              severity,
              ecosystem: request.ecosystem,
              packageName: pkg.name,
              installedVersion: pkg.version,
              patchedVersions: extractPatchedVersions(v, pkg.name),
              url: `https://osv.dev/vulnerability/${v.id}`,
              cve: extractCve(v),
              aliases: v.aliases as string[] | undefined,
              source: "osv",
              publishedAt: v.published as string | undefined,
            });
          }
        }

        return {
          scannerId: "osv",
          scannerName: "OSV.dev",
          success: true,
          vulnerabilities: vulns,
          scannedPackages: request.packages.length,
          scanDuration: Date.now() - start,
          scannedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          scannerId: "osv",
          scannerName: "OSV.dev",
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

function mapEcosystem(
  eco: string
): "npm" | "PyPI" | "Go" | "crates.io" | "Maven" | "Pub" {
  const map: Record<string, "npm" | "PyPI" | "Go" | "crates.io" | "Maven" | "Pub"> = {
    npm: "npm",
    pip: "PyPI",
    go: "Go",
    cargo: "crates.io",
    maven: "Maven",
    pub: "Pub",
  };
  return map[eco] || "npm";
}

function extractSeverity(v: Record<string, unknown>): "critical" | "high" | "medium" | "low" | "info" {
  const severity = v.severity as string | undefined;
  if (severity) {
    const s = severity.toLowerCase();
    if (s === "critical") return "critical";
    if (s === "high") return "high";
    if (s === "medium" || s === "moderate") return "medium";
    if (s === "low") return "low";
  }
  // Fallback: check CVSS score
  const database_specific = v.database_specific as Record<string, unknown> | undefined;
  const severity_rank = database_specific?.severity_rank as number | undefined;
  if (severity_rank !== undefined) {
    if (severity_rank >= 4) return "critical";
    if (severity_rank >= 3) return "high";
    if (severity_rank >= 2) return "medium";
    return "low";
  }
  return "medium";
}

function extractPatchedVersions(v: Record<string, unknown>, pkgName: string): string | undefined {
  const affected = v.affected as Array<Record<string, unknown>> | undefined;
  if (!affected) return undefined;

  for (const a of affected) {
    const ranges = a.ranges as Array<Record<string, unknown>> | undefined;
    if (!ranges) continue;
    for (const r of ranges) {
      const events = r.events as Array<Record<string, string>> | undefined;
      if (!events) continue;
      for (const e of events) {
        if (e.fixed) return `>=${e.fixed}`;
      }
    }
  }
  return undefined;
}

function extractCve(v: Record<string, unknown>): string | undefined {
  const aliases = v.aliases as string[] | undefined;
  if (!aliases) return undefined;
  return aliases.find((a) => a.startsWith("CVE-"));
}
