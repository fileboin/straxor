import type { ImageRecord, QualityCheckResult } from "./types.js";

export class QualityController {
  private checkedUrls = new Set<string>();

  check(record: ImageRecord, expectedAspectRatio?: number): QualityCheckResult {
    const issues: string[] = [];
    const minResolution = this.getMinResolution(record.assetType);

    const resolutionPass = record.width >= minResolution.width && record.height >= minResolution.height;
    if (!resolutionPass) {
      issues.push(`Resolution ${record.width}x${record.height} below minimum ${minResolution.width}x${minResolution.height}`);
    }

    const aspectRatioPass = record.width > 0 && record.height > 0;
    let expectedAspectRatioPass = true;

    if (expectedAspectRatio && aspectRatioPass) {
      const ratio = record.width / record.height;
      expectedAspectRatioPass = Math.abs(ratio - expectedAspectRatio) < 0.05;
      if (!expectedAspectRatioPass) {
        issues.push(`Aspect ratio ${ratio.toFixed(2)} differs from expected ${expectedAspectRatio}`);
      }
    }

    const readabilityPass = record.width >= 200 && record.height >= 200;

    const duplicateOf = this.checkDuplicate(record.url);
    if (duplicateOf) {
      issues.push(`Duplicate of image ${duplicateOf}`);
    }

    const passed = issues.length === 0;
    const score = this.calculateScore(record, passed, issues.length);

    this.checkedUrls.add(record.url);

    return {
      imageId: record.id,
      resolution: { width: record.width, height: record.height },
      resolutionPass,
      minResolution,
      readabilityPass,
      aspectRatioPass,
      expectedAspectRatio,
      expectedAspectRatioPass,
      duplicateOf,
      score,
      passed,
      issues,
    };
  }

  private getMinResolution(assetType?: string): { width: number; height: number } {
    const mins: Record<string, { width: number; height: number }> = {
      "logo": { width: 128, height: 128 },
      "icon": { width: 64, height: 64 },
      "favicon": { width: 16, height: 16 },
      "banner": { width: 600, height: 200 },
      "og-image": { width: 600, height: 315 },
      "github-cover": { width: 640, height: 320 },
      "readme-image": { width: 400, height: 200 },
      "blog-cover": { width: 600, height: 338 },
      "ui-mockup": { width: 720, height: 450 },
      "app-screenshot": { width: 195, height: 422 },
      "marketing-graphic": { width: 600, height: 400 },
      "social-media-graphic": { width: 540, height: 540 },
      "presentation-slide": { width: 960, height: 540 },
    };

    return mins[assetType ?? ""] ?? { width: 100, height: 100 };
  }

  private checkDuplicate(url: string): string | undefined {
    if (this.checkedUrls.has(url)) return "previous generation";
    return undefined;
  }

  private calculateScore(record: ImageRecord, passed: boolean, issueCount: number): number {
    let score = 100;

    if (!passed) score -= issueCount * 15;

    if (record.width < 100 || record.height < 100) score -= 20;
    if (record.format === "jpeg" && record.assetType === "logo") score -= 10;
    if (record.format === "webp" && record.assetType === "favicon") score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  resetChecks(): void {
    this.checkedUrls.clear();
  }
}
