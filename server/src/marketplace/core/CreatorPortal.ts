import type { CreatorProfile, PackageListing, PackageManifest, PackageVersion, PackageStats } from "./types.js";

interface CreatorAnalytics {
  totalPackages: number;
  totalDownloads: number;
  totalStars: number;
  totalInstalls: number;
  averageRating: number;
  topPackage: string | null;
  downloadsByDay: Record<string, number>;
  installsByDay: Record<string, number>;
  categoryBreakdown: Record<string, number>;
  growth: number;
}

export class CreatorPortal {
  private creators = new Map<string, CreatorProfile>();
  private dailyStats = new Map<string, Map<string, { downloads: number; installs: number }>>();

  registerCreator(profile: CreatorProfile): CreatorProfile {
    const existing = this.creators.get(profile.userId);
    if (existing) return existing;

    this.creators.set(profile.userId, {
      ...profile,
      joinedAt: new Date().toISOString(),
      followers: 0,
      following: 0,
    });

    return this.creators.get(profile.userId)!;
  }

  updateProfile(userId: string, updates: Partial<CreatorProfile>): CreatorProfile | undefined {
    const profile = this.creators.get(userId);
    if (!profile) return undefined;

    Object.assign(profile, updates);
    return profile;
  }

  getCreator(userId: string): CreatorProfile | undefined {
    return this.creators.get(userId);
  }

  getCreatorByName(name: string): CreatorProfile | undefined {
    return Array.from(this.creators.values()).find(c => c.name === name);
  }

  listCreators(limit = 50, offset = 0): CreatorProfile[] {
    return Array.from(this.creators.values())
      .sort((a, b) => b.totalDownloads - a.totalDownloads)
      .slice(offset, offset + limit);
  }

  addPackageToCreator(userId: string, packageName: string): void {
    const profile = this.creators.get(userId);
    if (profile && !profile.packages.includes(packageName)) {
      profile.packages.push(packageName);
    }
  }

  removePackageFromCreator(userId: string, packageName: string): void {
    const profile = this.creators.get(userId);
    if (profile) {
      profile.packages = profile.packages.filter(p => p !== packageName);
    }
  }

  getAnalytics(creatorId: string, packages: PackageListing[]): CreatorAnalytics {
    const profile = this.creators.get(creatorId);
    if (!profile) throw new Error("Creator not found");

    const creatorPackages = packages.filter(p => profile.packages.includes(p.manifest.name));
    const downloadsByDay: Record<string, number> = {};
    const installsByDay: Record<string, number> = {};
    const categoryBreakdown: Record<string, number> = {};
    let totalDownloads = 0;
    let totalInstalls = 0;
    let totalStars = 0;
    let ratingSum = 0;
    let topPackage: string | null = null;
    let maxDownloads = 0;

    for (const pkg of creatorPackages) {
      totalDownloads += pkg.stats.downloads;
      totalInstalls += pkg.stats.installs;
      totalStars += pkg.stats.stars;
      ratingSum += pkg.stats.averageRating;

      categoryBreakdown[pkg.manifest.category] = (categoryBreakdown[pkg.manifest.category] ?? 0) + 1;

      if (pkg.stats.downloads > maxDownloads) {
        maxDownloads = pkg.stats.downloads;
        topPackage = pkg.manifest.name;
      }

      const daily = this.dailyStats.get(pkg.id);
      if (daily) {
        for (const [day, stats] of daily) {
          downloadsByDay[day] = (downloadsByDay[day] ?? 0) + stats.downloads;
          installsByDay[day] = (installsByDay[day] ?? 0) + stats.installs;
        }
      }
    }

    const avgRating = creatorPackages.length > 0 ? Math.round((ratingSum / creatorPackages.length) * 10) / 10 : 0;

    const days = Object.keys(downloadsByDay).sort();
    const growth = days.length >= 2
      ? ((downloadsByDay[days[days.length - 1]] ?? 0) - (downloadsByDay[days[0]] ?? 0))
      : 0;

    return {
      totalPackages: creatorPackages.length,
      totalDownloads,
      totalStars,
      totalInstalls,
      averageRating: avgRating,
      topPackage,
      downloadsByDay,
      installsByDay,
      categoryBreakdown,
      growth,
    };
  }

  recordDailyStat(packageId: string, day: string, type: "downloads" | "installs"): void {
    if (!this.dailyStats.has(packageId)) {
      this.dailyStats.set(packageId, new Map());
    }
    const dayMap = this.dailyStats.get(packageId)!;
    if (!dayMap.has(day)) {
      dayMap.set(day, { downloads: 0, installs: 0 });
    }
    const stat = dayMap.get(day)!;
    if (type === "downloads") stat.downloads++;
    else stat.installs++;
  }

  followCreator(userId: string, creatorId: string): void {
    const creator = this.creators.get(creatorId);
    if (creator) creator.followers++;
  }

  unfollowCreator(userId: string, creatorId: string): void {
    const creator = this.creators.get(creatorId);
    if (creator && creator.followers > 0) creator.followers--;
  }

  count(): number { return this.creators.size; }
}
