import type {
  SecurityScannerAdapter,
  ScanRequest,
  ScanResult,
  Vulnerability,
} from "./adapter.js";

// GitHub Advisory Database — REST API (public, no auth needed for read)
export function createGithubAdvisoryAdapter(): SecurityScannerAdapter {
  return {
    id: "github-advisory",
    name: "GitHub Advisory",
    async isAvailable() {
      return true; // Public API
    },
    async scan(request: ScanRequest): Promise<ScanResult> {
      const start = Date.now();
      try {
        const vulns: Vulnerability[] = [];
        const ecosystem = mapEcosystem(request.ecosystem);

        // Search advisories for each package
        for (const pkg of request.packages) {
          try {
            const query = `package:${pkg.name} ecosystem:${ecosystem}`;
            const url = `https://api.github.com/advisories?per_page=10&package=${encodeURIComponent(pkg.name)}&ecosystem=${ecosystem}`;

            const headers: Record<string, string> = {
              Accept: "application/vnd.github+json",
            };
            if (process.env.GITHUB_TOKEN) {
              headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
            }

            const res = await fetch(url, { headers });
            if (!res.ok) continue;

            const advisories = (await res.json()) as Array<Record<string, unknown>>;

            for (const adv of advisories) {
              // Check if this version is affected
              const severity = mapSeverity(adv.severity as string);
              const cveId = adv.cve_id as string | null;
              const summary = adv.summary as string || "No description";
              const published = adv.published_at as string;

              // Extract patched version from vulnerabilities array
              const vulns_arr = adv.vulnerabilities as Array<Record<string, unknown>> | undefined;
              let patchedVersions: string | undefined;
              if (vulns_arr) {
                for (const v of vulns_arr) {
                  const pkg_info = v.package as Record<string, string> | undefined;
                  if (pkg_info?.name === pkg.name) {
                    const patched = v.patched_versions as string;
                    if (patched && patched !== "<0.0.0") {
                      patchedVersions = patched;
                    }
                  }
                }
              }

              // Simple version check — is installed version in range?
              if (patchedVersions && versionGte(pkg.version, patchedVersions.replace(">=", "").replace(">", ""))) {
                continue; // Version is patched
              }

              vulns.push({
                id: (adv.ghsa_id as string) || `gh-${pkg.name}-${Date.now()}`,
                summary,
                severity,
                ecosystem: request.ecosystem,
                packageName: pkg.name,
                installedVersion: pkg.version,
                patchedVersions,
                url: adv.html_url as string || `https://github.com/advisories/${adv.ghsa_id}`,
                cve: cveId || undefined,
                aliases: adv.identifiers as string[] | undefined,
                source: "github-advisory",
                publishedAt: published,
              });
            }
          } catch {
            // Skip individual package errors
          }
        }

        return {
          scannerId: "github-advisory",
          scannerName: "GitHub Advisory",
          success: true,
          vulnerabilities: vulns,
          scannedPackages: request.packages.length,
          scanDuration: Date.now() - start,
          scannedAt: new Date().toISOString(),
        };
      } catch (err) {
        return {
          scannerId: "github-advisory",
          scannerName: "GitHub Advisory",
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

function mapEcosystem(eco: string): string {
  const map: Record<string, string> = {
    npm: "npm",
    pip: "pip",
    go: "go",
    cargo: "rust",
    maven: "maven",
    pub: "pub",
  };
  return map[eco] || "npm";
}

function mapSeverity(sev: string | undefined): "critical" | "high" | "medium" | "low" | "info" {
  if (!sev) return "medium";
  const s = sev.toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  if (s === "low") return "low";
  return "info";
}

function versionGte(installed: string, target: string): boolean {
  // Simple semver compare (major.minor.patch)
  const parse = (v: string) => {
    const parts = v.split(".").map(Number);
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  };
  const [a1, a2, a3] = parse(installed);
  const [b1, b2, b3] = parse(target);
  if (a1 > b1) return true;
  if (a1 < b1) return false;
  if (a2 > b2) return true;
  if (a2 < b2) return false;
  return a3 >= b3;
}
