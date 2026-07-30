import type { PackageListing, PackageVersion, PackageManifest, PackageCategory, PackageStats } from "./types.js";

export class PackageRegistry {
  private packages = new Map<string, PackageListing>();

  register(manifest: PackageManifest, version: PackageVersion): PackageListing {
    const existing = this.packages.get(manifest.name);
    if (existing) {
      existing.versions.push(version);
      existing.manifest = manifest;
      existing.latestVersion = version.version;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }

    const listing: PackageListing = {
      id: `pkg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      manifest,
      versions: [version],
      latestVersion: version.version,
      stats: { downloads: 0, installs: 0, currentInstalls: 0, averageRating: 0, totalReviews: 0, stars: 0, forks: 0 },
      verification: {
        status: "not-submitted",
        securityScore: 0, compatibilityScore: 0, qualityScore: 0, overallScore: 0,
        dependencyIssues: [], securityIssues: [], qualityIssues: [],
        malwareScanResult: "not-scanned", reviewedByAI: false, reviewedByHuman: false,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.packages.set(manifest.name, listing);
    return listing;
  }

  updateVersion(name: string, version: PackageVersion): PackageListing | undefined {
    const listing = this.packages.get(name);
    if (!listing) return undefined;

    const idx = listing.versions.findIndex(v => v.version === version.version);
    if (idx >= 0) listing.versions[idx] = version;
    else listing.versions.push(version);

    listing.latestVersion = version.version;
    listing.updatedAt = new Date().toISOString();
    return listing;
  }

  get(name: string): PackageListing | undefined {
    return this.packages.get(name);
  }

  getById(id: string): PackageListing | undefined {
    return Array.from(this.packages.values()).find(p => p.id === id);
  }

  delete(name: string): boolean {
    return this.packages.delete(name);
  }

  list(category?: PackageCategory, limit = 50, offset = 0): PackageListing[] {
    let result = Array.from(this.packages.values());
    if (category) result = result.filter(p => p.manifest.category === category);
    result.sort((a, b) => b.stats.downloads - a.stats.downloads);
    return result.slice(offset, offset + limit);
  }

  search(query: string, category?: PackageCategory): PackageListing[] {
    const q = query.toLowerCase();
    let result = Array.from(this.packages.values());
    if (category) result = result.filter(p => p.manifest.category === category);
    return result.filter(p =>
      p.manifest.name.toLowerCase().includes(q) ||
      p.manifest.displayName.toLowerCase().includes(q) ||
      p.manifest.description.toLowerCase().includes(q) ||
      p.manifest.tags.some(t => t.toLowerCase().includes(q)) ||
      p.manifest.keywords.some(k => k.toLowerCase().includes(q))
    );
  }

  incrementDownloads(name: string): void {
    const pkg = this.packages.get(name);
    if (pkg) pkg.stats.downloads++;
  }

  incrementInstalls(name: string): void {
    const pkg = this.packages.get(name);
    if (pkg) { pkg.stats.installs++; pkg.stats.currentInstalls++; }
  }

  decrementInstalls(name: string): void {
    const pkg = this.packages.get(name);
    if (pkg && pkg.stats.currentInstalls > 0) pkg.stats.currentInstalls--;
  }

  count(): number { return this.packages.size; }

  countByCategory(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const pkg of this.packages.values()) {
      counts[pkg.manifest.category] = (counts[pkg.manifest.category] ?? 0) + 1;
    }
    return counts;
  }

  getLatestVersions(): PackageVersion[] {
    return Array.from(this.packages.values()).map(p => {
      const v = p.versions.find(vv => vv.version === p.latestVersion);
      return v ?? p.versions[0];
    }).filter(Boolean);
  }
}
