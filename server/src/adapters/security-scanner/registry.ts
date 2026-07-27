import type {
  SecurityScannerAdapter,
  ScannerId,
  ScanRequest,
  ScanResult,
  AggregatedScanResult,
} from "./adapter.js";
import { createSocketAdapter } from "./socket.js";
import { createOsvAdapter } from "./osv.js";
import { createGithubAdvisoryAdapter } from "./github-advisory.js";
import { createNpmAuditAdapter } from "./npm-audit.js";
import { createPipAuditAdapter } from "./pip-audit.js";
import { createOsvScannerAdapter } from "./osv-scanner.js";

export interface ScannerRegistry {
  getAll(): SecurityScannerAdapter[];
  getById(id: ScannerId): SecurityScannerAdapter | undefined;
  getAvailable(): Promise<SecurityScannerAdapter[]>;
  scanAll(request: ScanRequest): Promise<AggregatedScanResult>;
  scanWith(ids: ScannerId[], request: ScanRequest): Promise<AggregatedScanResult>;
}

const ALL_SCANNERS: SecurityScannerAdapter[] = [
  createSocketAdapter(),
  createOsvAdapter(),
  createGithubAdvisoryAdapter(),
  createNpmAuditAdapter(),
  createPipAuditAdapter(),
  createOsvScannerAdapter(),
];

export function createScannerRegistry(): ScannerRegistry {
  return {
    getAll() {
      return ALL_SCANNERS;
    },

    getById(id: ScannerId) {
      return ALL_SCANNERS.find((s) => s.id === id);
    },

    async getAvailable() {
      const checks = await Promise.all(
        ALL_SCANNERS.map(async (s) => ({
          scanner: s,
          available: await s.isAvailable().catch(() => false),
        }))
      );
      return checks.filter((c) => c.available).map((c) => c.scanner);
    },

    async scanAll(request: ScanRequest): Promise<AggregatedScanResult> {
      const available = await this.getAvailable();
      return runScanners(available, request);
    },

    async scanWith(ids: ScannerId[], request: ScanRequest): Promise<AggregatedScanResult> {
      const scanners = ids
        .map((id) => ALL_SCANNERS.find((s) => s.id === id))
        .filter(Boolean) as SecurityScannerAdapter[];
      return runScanners(scanners, request);
    },
  };
}

async function runScanners(
  scanners: SecurityScannerAdapter[],
  request: ScanRequest
): Promise<AggregatedScanResult> {
  const start = Date.now();

  // Run all scanners in parallel
  const results = await Promise.all(
    scanners.map((s) => s.scan(request))
  );

  const allVulnerabilities = results.flatMap((r) => r.vulnerabilities);

  // Deduplicate by package name + summary
  const seen = new Set<string>();
  const uniqueVulns = allVulnerabilities.filter((v) => {
    const key = `${v.packageName}:${v.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    results,
    totalVulnerabilities: uniqueVulns.length,
    criticalCount: uniqueVulns.filter((v) => v.severity === "critical").length,
    highCount: uniqueVulns.filter((v) => v.severity === "high").length,
    mediumCount: uniqueVulns.filter((v) => v.severity === "medium").length,
    lowCount: uniqueVulns.filter((v) => v.severity === "low").length,
    allVulnerabilities: uniqueVulns,
    scannedAt: new Date().toISOString(),
    totalDuration: Date.now() - start,
  };
}
