import type { LicenseType, LicenseInfo, PackageManifest } from "./types.js";
import { LICENSE_INFO } from "./types.js";

export class LicensingEngine {
  validateLicense(manifest: PackageManifest): { valid: boolean; reason?: string } {
    const info = this.getLicenseInfo(manifest.license);
    if (!info) return { valid: false, reason: `Unknown license type: ${manifest.license}` };

    if (manifest.visibility === "public" && manifest.license === "private") {
      return { valid: false, reason: "Public packages cannot use private license" };
    }

    return { valid: true };
  }

  getLicenseInfo(type: LicenseType): LicenseInfo | undefined {
    return LICENSE_INFO[type];
  }

  listLicenses(): LicenseInfo[] {
    return Object.values(LICENSE_INFO);
  }

  canUseCommercial(license: LicenseType): boolean {
    return LICENSE_INFO[license]?.allowsCommercial ?? false;
  }

  canModify(license: LicenseType): boolean {
    return LICENSE_INFO[license]?.allowsModification ?? false;
  }

  canDistribute(license: LicenseType): boolean {
    return LICENSE_INFO[license]?.allowsDistribution ?? false;
  }

  isCompatible(a: LicenseType, b: LicenseType): boolean {
    const infoA = LICENSE_INFO[a];
    const infoB = LICENSE_INFO[b];
    if (!infoA || !infoB) return false;

    if (infoA.requiresShareAlike && !infoB.requiresShareAlike) return false;
    if (!infoA.allowsCommercial && infoB.allowsCommercial) return false;

    return true;
  }

  getLicenseRequirements(type: LicenseType): string[] {
    const info = LICENSE_INFO[type];
    if (!info) return [];

    const reqs: string[] = [];
    if (info.requiresAttribution) reqs.push("Attribution required");
    if (info.requiresShareAlike) reqs.push("Share-alike required");
    if (!info.allowsCommercial) reqs.push("Commercial use not allowed");
    if (!info.allowsModification) reqs.push("Modification not allowed");
    if (!info.allowsDistribution) reqs.push("Distribution not allowed");

    return reqs;
  }
}
