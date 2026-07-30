import { PackageRegistry } from "./PackageRegistry.js";
import { VerificationEngine } from "./VerificationEngine.js";
import { SearchEngine } from "./SearchEngine.js";
import { RecommendationEngine } from "./RecommendationEngine.js";
import { VersionManager } from "./VersionManager.js";
import { DependencyManager } from "./DependencyManager.js";
import { RatingsManager } from "./RatingsManager.js";
import { CreatorPortal } from "./CreatorPortal.js";
import { LicensingEngine } from "./LicensingEngine.js";
import type {
  PackageListing, PackageManifest, PackageVersion, PackageCategory,
  SearchQuery, SearchResult, Review, RecommendationContext,
  CreatorProfile, MarketplaceEvent, MarketplacePlugin, LicenseType,
  VerificationResult, PackageStats,
} from "./types.js";

export interface MarketplaceConfig {
  name?: string;
  version?: string;
  allowCommercial?: boolean;
  maxPackageSize?: number;
  requireVerification?: boolean;
}

export class MarketplaceEngine {
  readonly packages: PackageRegistry;
  readonly verification: VerificationEngine;
  readonly search: SearchEngine;
  readonly recommendations: RecommendationEngine;
  readonly versions: VersionManager;
  readonly dependencies: DependencyManager;
  readonly ratings: RatingsManager;
  readonly creators: CreatorPortal;
  readonly licensing: LicensingEngine;

  private plugins: MarketplacePlugin[] = [];
  private events: MarketplaceEvent[] = [];
  private config: Required<MarketplaceConfig>;

  constructor(config?: MarketplaceConfig) {
    this.packages = new PackageRegistry();
    this.verification = new VerificationEngine();
    this.search = new SearchEngine(this.packages);
    this.recommendations = new RecommendationEngine(this.packages);
    this.versions = new VersionManager();
    this.dependencies = new DependencyManager(this.packages);
    this.ratings = new RatingsManager();
    this.creators = new CreatorPortal();
    this.licensing = new LicensingEngine();

    this.config = {
      name: config?.name ?? "STRAXOR Marketplace",
      version: config?.version ?? "1.0.0",
      allowCommercial: config?.allowCommercial ?? true,
      maxPackageSize: config?.maxPackageSize ?? 100 * 1024 * 1024,
      requireVerification: config?.requireVerification ?? true,
    };
  }

  // --- Publish ---
  async publish(manifest: PackageManifest, version: PackageVersion): Promise<{ listing: PackageListing; error?: string }> {
    const licenseCheck = this.licensing.validateLicense(manifest);
    if (!licenseCheck.valid) return { listing: null as any, error: licenseCheck.reason };

    const processedManifest = await this.runBeforePublishHooks(manifest);

    const listing = this.packages.register(processedManifest, version);

    const verification = await this.verification.verify(listing);
    listing.verification = verification;

    if (this.config.requireVerification && verification.status === "failed") {
      return { listing, error: "Package failed verification checks" };
    }

    this.emitEvent({ type: "package:published", packageId: listing.id, data: { name: manifest.name, version: version.version } });
    return { listing };
  }

  update(name: string, manifest: PackageManifest, version: PackageVersion): PackageListing | undefined {
    const listing = this.packages.updateVersion(name, version);
    if (listing) {
      listing.manifest = manifest;
      this.emitEvent({ type: "package:updated", packageId: listing.id, data: { name, version: version.version } });
    }
    return listing;
  }

  deprecatePackage(name: string, reason?: string): boolean {
    const listing = this.packages.get(name);
    if (!listing) return false;
    this.emitEvent({ type: "package:deprecated", packageId: listing.id, data: { name, reason } });
    return true;
  }

  archivePackage(name: string): boolean {
    const listing = this.packages.get(name);
    if (!listing) return false;
    listing.manifest.visibility = "unlisted";
    this.emitEvent({ type: "package:archived", packageId: listing.id, data: { name } });
    return true;
  }

  deletePackage(name: string): boolean {
    const listing = this.packages.get(name);
    if (!listing) return false;
    this.packages.delete(name);
    this.emitEvent({ type: "package:deleted", packageId: listing.id, data: { name } });
    return true;
  }

  // --- Get ---
  get(name: string): PackageListing | undefined { return this.packages.get(name); }
  getById(id: string): PackageListing | undefined { return this.packages.getById(id); }
  list(category?: PackageCategory, limit = 50, offset = 0): PackageListing[] { return this.packages.list(category, limit, offset); }

  // --- Search ---
  searchPackages(query: SearchQuery): SearchResult { return this.search.search(query); }
  semanticSearch(query: string, category?: PackageCategory, limit = 10): PackageListing[] { return this.search.semanticSearch(query, category, limit); }

  // --- Recommendations ---
  getRecommendations(ctx: RecommendationContext, limit = 10): PackageListing[] { return this.recommendations.recommendForUser(ctx, limit); }
  getTrending(limit = 10): PackageListing[] { return this.recommendations.getTrending(limit); }
  getPopular(limit = 10): PackageListing[] { return this.recommendations.getPopular(limit); }
  getNewReleases(limit = 10): PackageListing[] { return this.recommendations.getNewReleases(limit); }
  getForCategory(category: PackageCategory, limit = 10): PackageListing[] { return this.recommendations.getForCategory(category, limit); }
  getRelated(packageId: string, limit = 5): PackageListing[] { return this.recommendations.getRelated(packageId, limit); }

  // --- Verification ---
  verifyPackage(name: string): Promise<VerificationResult | undefined> {
    const listing = this.packages.get(name);
    if (!listing) return Promise.resolve(undefined);
    return this.verification.verify(listing);
  }

  // --- Versions ---
  getVersion(name: string, version: string): PackageVersion | undefined {
    const listing = this.packages.get(name);
    if (!listing) return undefined;
    return this.versions.getVersion(listing, version);
  }

  getLatestVersion(name: string): PackageVersion | undefined {
    const listing = this.packages.get(name);
    if (!listing) return undefined;
    return this.versions.getLatest(listing);
  }

  getVersionHistory(name: string): PackageVersion[] {
    const listing = this.packages.get(name);
    if (!listing) return [];
    return this.versions.listVersions(listing);
  }

  // --- Dependencies ---
  resolveDependencies(name: string, version: string) {
    const listing = this.packages.get(name);
    if (!listing) return null;
    const ver = listing.versions.find(v => v.version === version);
    if (!ver) return null;
    return this.dependencies.resolveDependencies(ver);
  }

  checkDependencyCompatibility(name: string, version: string) {
    const listing = this.packages.get(name);
    if (!listing) return null;
    const ver = listing.versions.find(v => v.version === version);
    if (!ver) return null;
    return this.dependencies.checkCompatibility(ver);
  }

  // --- Ratings ---
  addReview(name: string, userId: string, userName: string, rating: number, content: string, title?: string): Review | undefined {
    const listing = this.packages.get(name);
    if (!listing) return undefined;
    return this.ratings.addReview(listing, userId, userName, rating, content, title);
  }

  updateReview(name: string, reviewId: string, userId: string, rating?: number, content?: string, title?: string): Review | undefined {
    const listing = this.packages.get(name);
    if (!listing) return undefined;
    return this.ratings.updateReview(listing, reviewId, userId, rating, content, title);
  }

  deleteReview(name: string, reviewId: string, userId: string): boolean {
    const listing = this.packages.get(name);
    if (!listing) return false;
    return this.ratings.deleteReview(listing, reviewId, userId);
  }

  getReviews(name: string, limit = 20, offset = 0): Review[] {
    const listing = this.packages.get(name);
    if (!listing) return [];
    return this.ratings.getReviews(listing.id, limit, offset);
  }

  getRatingDistribution(name: string): Record<number, number> {
    const listing = this.packages.get(name);
    if (!listing) return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    return this.ratings.getRatingDistribution(listing.id);
  }

  // --- Creator Portal ---
  registerCreator(profile: CreatorProfile): CreatorProfile { return this.creators.registerCreator(profile); }
  getCreator(userId: string): CreatorProfile | undefined { return this.creators.getCreator(userId); }
  getCreatorAnalytics(userId: string): any {
    const pkgs = this.packages.list();
    return this.creators.getAnalytics(userId, pkgs);
  }

  // --- Stats ---
  getStats(): MarketplaceStats {
    const allPkgs = this.packages.list();
    return {
      totalPackages: this.packages.count(),
      totalDownloads: allPkgs.reduce((s, p) => s + p.stats.downloads, 0),
      totalInstalls: allPkgs.reduce((s, p) => s + p.stats.installs, 0),
      totalCreators: this.creators.count(),
      totalReviews: allPkgs.reduce((s, p) => s + p.stats.totalReviews, 0),
      categoryCounts: this.packages.countByCategory(),
      averageRating: allPkgs.length > 0
        ? Math.round((allPkgs.reduce((s, p) => s + p.stats.averageRating, 0) / allPkgs.length) * 10) / 10
        : 0,
    };
  }

  // --- Events ---
  getEvents(limit = 50): MarketplaceEvent[] {
    return this.events.slice(-limit);
  }

  private emitEvent(event: Omit<MarketplaceEvent, "timestamp">): void {
    const full: MarketplaceEvent = { ...event, timestamp: new Date().toISOString() };
    this.events.push(full);
    if (this.events.length > 1000) this.events.shift();
    for (const plugin of this.plugins) {
      plugin.onEvent?.(full).catch(() => {});
    }
  }

  // --- Plugins ---
  registerPlugin(plugin: MarketplacePlugin): void {
    this.plugins.push(plugin);
    plugin.init?.().catch(() => {});
  }

  unregisterPlugin(name: string): void {
    const idx = this.plugins.findIndex(p => p.name === name);
    if (idx >= 0) {
      this.plugins[idx].destroy?.().catch(() => {});
      this.plugins.splice(idx, 1);
    }
  }

  getPlugins(): MarketplacePlugin[] { return [...this.plugins]; }

  private async runBeforePublishHooks(manifest: PackageManifest): Promise<PackageManifest> {
    let result = { ...manifest };
    for (const plugin of this.plugins) {
      if (plugin.onBeforePublish) {
        result = await plugin.onBeforePublish(result);
      }
    }
    return result;
  }

  // --- Reset (for testing) ---
  reset(): void {
    this.plugins = [];
    this.events = [];
  }
}

export interface MarketplaceStats {
  totalPackages: number;
  totalDownloads: number;
  totalInstalls: number;
  totalCreators: number;
  totalReviews: number;
  categoryCounts: Record<string, number>;
  averageRating: number;
}
