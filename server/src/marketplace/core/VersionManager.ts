import type { PackageListing, PackageVersion, PackageDependency } from "./types.js";

export class VersionManager {
  getVersion(listing: PackageListing, version: string): PackageVersion | undefined {
    return listing.versions.find(v => v.version === version);
  }

  getLatest(listing: PackageListing): PackageVersion | undefined {
    const sorted = this.sortVersions(listing.versions);
    return sorted[0];
  }

  listVersions(listing: PackageListing): PackageVersion[] {
    return this.sortVersions(listing.versions);
  }

  satisfies(listing: PackageListing, versionConstraint: string): boolean {
    const constraint = versionConstraint.replace(/[^\d.*x]/g, "");
    const available = listing.versions.map(v => v.version);

    if (constraint === "*" || constraint === "x") return available.length > 0;

    return available.some(v => this.matchVersion(v, constraint));
  }

  compatibleVersion(listing: PackageListing, version: string): PackageVersion | undefined {
    const sorted = this.sortVersions(listing.versions);
    return sorted.find(v => this.matchVersion(v.version, version));
  }

  getUpdateInfo(listing: PackageListing, currentVersion: string): { hasUpdate: boolean; latestVersion: string; latest?: PackageVersion } {
    const sorted = this.sortVersions(listing.versions);
    const latest = sorted[0];
    if (!latest) return { hasUpdate: false, latestVersion: currentVersion };

    return {
      hasUpdate: latest.version !== currentVersion,
      latestVersion: latest.version,
      latest,
    };
  }

  checkUpdateNotifications(listings: PackageListing[], installedVersions: Map<string, string>): Array<{ name: string; currentVersion: string; latestVersion: string }> {
    const updates: Array<{ name: string; currentVersion: string; latestVersion: string }> = [];

    for (const [name, current] of installedVersions) {
      const listing = listings.find(l => l.manifest.name === name);
      if (!listing) continue;

      const info = this.getUpdateInfo(listing, current);
      if (info.hasUpdate) {
        updates.push({ name, currentVersion: current, latestVersion: info.latestVersion });
      }
    }

    return updates;
  }

  rollback(listing: PackageListing, targetVersion: string): PackageVersion | undefined {
    const version = listing.versions.find(v => v.version === targetVersion);
    if (!version || version.isDeprecated) return undefined;
    return version;
  }

  deprecateVersion(listing: PackageListing, version: string, message?: string): boolean {
    const v = listing.versions.find(vv => vv.version === version);
    if (!v) return false;
    v.isDeprecated = true;
    v.deprecationMessage = message;
    return true;
  }

  private sortVersions(versions: PackageVersion[]): PackageVersion[] {
    return [...versions].sort((a, b) => {
      const aParts = a.version.split(".").map(Number);
      const bParts = b.version.split(".").map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aNum = aParts[i] ?? 0;
        const bNum = bParts[i] ?? 0;
        if (aNum !== bNum) return bNum - aNum;
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }

  private matchVersion(version: string, constraint: string): boolean {
    if (constraint === "*" || constraint === "x") return true;

    const vParts = version.split(".").map(Number);
    const cParts = constraint.split(".").map(p => {
      const trimmed = p.replace(/[^0-9]/g, "");
      if (trimmed === "") return -1;
      return parseInt(trimmed);
    });

    for (let i = 0; i < Math.max(vParts.length, cParts.length); i++) {
      if (cParts[i] === -1) return true;
      const vNum = vParts[i] ?? 0;
      const cNum = cParts[i] ?? 0;
      if (vNum !== cNum) return false;
    }

    return true;
  }
}
