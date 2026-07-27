export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type ScannerId = "socket" | "osv" | "github-advisory" | "npm-audit" | "pip-audit" | "osv-scanner";
export type PackageEcosystem = "npm" | "pip" | "go" | "cargo" | "maven" | "pub";

export interface Vulnerability {
  id: string;
  summary: string;
  severity: Severity;
  ecosystem: PackageEcosystem;
  packageName: string;
  installedVersion: string;
  patchedVersions?: string;
  url?: string;
  cve?: string;
  aliases?: string[];
  source: ScannerId;
  publishedAt?: string;
  scannedAt?: string;
}

export interface ScanResult {
  scannerId: ScannerId;
  scannerName: string;
  success: boolean;
  vulnerabilities: Vulnerability[];
  scannedPackages: number;
  scanDuration: number;
  error?: string;
  scannedAt: string;
}

export interface AggregatedScanResult {
  results: ScanResult[];
  totalVulnerabilities: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  allVulnerabilities: Vulnerability[];
  scannedAt: string;
  totalDuration: number;
}

export interface ScanRequest {
  ecosystem: PackageEcosystem;
  packages: Array<{ name: string; version: string }>;
  lockfile?: string;
  scanners?: ScannerId[];
  machineId?: string;
}

export interface SecurityScannerAdapter {
  id: ScannerId;
  name: string;
  isAvailable(): Promise<boolean>;
  scan(request: ScanRequest): Promise<ScanResult>;
}
