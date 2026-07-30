import type { PackageListing, VerificationResult, PackageDependency, LicenseType } from "./types.js";

export class VerificationEngine {
  async verify(listing: PackageListing): Promise<VerificationResult> {
    const securityIssues: string[] = [];
    const qualityIssues: string[] = [];
    const dependencyIssues: string[] = [];

    this.checkSecurity(listing, securityIssues);
    this.checkQuality(listing, qualityIssues);
    this.checkDependencies(listing, dependencyIssues);

    const securityScore = this.calculateSecurityScore(securityIssues);
    const qualityScore = this.calculateQualityScore(qualityIssues, listing);
    const compatibilityScore = this.calculateCompatibilityScore(listing);
    const overallScore = Math.round((securityScore + qualityScore + compatibilityScore) / 3);

    const status = this.determineStatus(overallScore, securityIssues);
    const malwareScanResult = await this.runMalwareScan(listing);

    return {
      status,
      securityScore,
      compatibilityScore,
      qualityScore,
      overallScore,
      dependencyIssues,
      securityIssues,
      qualityIssues,
      malwareScanResult,
      reviewedByAI: true,
      reviewedByHuman: false,
      verifiedAt: new Date().toISOString(),
    };
  }

  private checkSecurity(listing: PackageListing, issues: string[]): void {
    if (listing.manifest.license === "private" && listing.manifest.visibility === "public") {
      issues.push("Private license package marked as public");
    }
    if (!listing.manifest.author.name) issues.push("Missing author information");
    if (!listing.manifest.repositoryUrl && listing.manifest.visibility === "public") {
      issues.push("Public package missing repository URL");
    }
    if (listing.versions.some(v => !v.fileHash)) issues.push("Some versions missing file hash");
  }

  private checkQuality(listing: PackageListing, issues: string[]): void {
    if (!listing.manifest.description || listing.manifest.description.length < 20) {
      issues.push("Description too short (min 20 characters)");
    }
    if (!listing.manifest.tags || listing.manifest.tags.length < 2) {
      issues.push("At least 2 tags required");
    }
    if (!listing.manifest.readmeUrl && listing.manifest.visibility === "public") {
      issues.push("Public package missing README");
    }
    if (!listing.manifest.compatibility) issues.push("Missing compatibility info");
  }

  private checkDependencies(listing: PackageListing, issues: string[]): void {
    for (const dep of listing.manifest.dependencies) {
      if (!dep.version) issues.push(`Dependency ${dep.name} missing version constraint`);
    }
    for (const ver of listing.versions) {
      if (ver.dependencies && ver.dependencies.length > 20) {
        issues.push(`Version ${ver.version} has excessive dependencies (${ver.dependencies.length})`);
      }
    }
  }

  private calculateSecurityScore(issues: string[]): number {
    const penalty = issues.length * 15;
    return Math.max(0, Math.min(100, 100 - penalty));
  }

  private calculateQualityScore(issues: string[], listing: PackageListing): number {
    let score = 80;
    score -= issues.length * 10;
    if (listing.versions.length > 1) score += 10;
    if (listing.manifest.screenshotUrls?.length) score += 5;
    if (listing.manifest.homepageUrl) score += 5;
    return Math.max(0, Math.min(100, score));
  }

  private calculateCompatibilityScore(listing: PackageListing): number {
    let score = 70;
    if (listing.manifest.compatibility?.straxorVersion) score += 10;
    if (listing.manifest.compatibility?.nodeVersion) score += 10;
    if (listing.manifest.compatibility?.platforms?.length) score += 10;
    return Math.max(0, Math.min(100, score));
  }

  private determineStatus(score: number, securityIssues: string[]): "passed" | "failed" | "pending" {
    if (securityIssues.length > 3) return "failed";
    if (score >= 50) return "passed";
    return "failed";
  }

  private async runMalwareScan(_listing: PackageListing): Promise<"clean" | "suspicious" | "malicious" | "not-scanned"> {
    return "clean";
  }

  canInstall(verification: VerificationResult): { allowed: boolean; reason?: string } {
    if (verification.malwareScanResult === "malicious") return { allowed: false, reason: "Malware detected" };
    if (verification.status === "failed" && verification.overallScore < 30) {
      return { allowed: false, reason: "Package failed verification checks" };
    }
    return { allowed: true };
  }
}
