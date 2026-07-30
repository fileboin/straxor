import { Router } from "express";
import type { Request, Response } from "express";
import { MarketplaceEngine } from "../core/MarketplaceEngine.js";
import type { MarketplaceConfig } from "../core/MarketplaceEngine.js";
import { MarketplaceFileStore } from "../storage/FileStore.js";
import { PostgresStore } from "../storage/PostgresStore.js";
import { PluginManager } from "../plugins/PluginManager.js";
import { ALL_CATEGORIES, CATEGORY_DISPLAY, LICENSE_INFO } from "../core/types.js";
import type { PackageManifest, PackageVersion, SearchQuery, CreatorProfile, PackageCategory, LicenseType } from "../core/types.js";

export function createMarketplaceRouter(config?: MarketplaceConfig): Router {
  const store = process.env.DATABASE_URL ? new PostgresStore() : undefined;
  const engine = new MarketplaceEngine({ ...config, store });
  const router = Router();

  // ── Stats ──
  router.get("/stats", (_req: Request, res: Response) => {
    res.json(engine.getStats());
  });

  // ── List ──
  router.get("/packages", (req: Request, res: Response) => {
    const category = req.query.category as PackageCategory | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    res.json({ listings: engine.list(category, limit, offset), total: engine.packages.count(), limit, offset });
  });

  // ── Search ──
  router.get("/search", (req: Request, res: Response) => {
    const query: SearchQuery = {
      query: (req.query.q as string) || "",
      category: req.query.category as PackageCategory,
      tags: req.query.tags ? (req.query.tags as string).split(",") : undefined,
      license: req.query.license as LicenseType,
      minScore: req.query.minScore ? parseInt(req.query.minScore as string) : undefined,
      sortBy: (req.query.sortBy as any) || "popularity",
      sortOrder: (req.query.sortOrder as any) || "desc",
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    };
    res.json(engine.searchPackages(query));
  });

  // ── Semantic Search ──
  router.get("/semantic-search", (req: Request, res: Response) => {
    const q = req.query.q as string;
    const category = req.query.category as PackageCategory;
    const limit = parseInt(req.query.limit as string) || 10;
    if (!q) { res.status(400).json({ error: "Query required" }); return; }
    res.json({ listings: engine.semanticSearch(q, category, limit) });
  });

  // ── Recommendations ──
  router.get("/recommendations", (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const categories = req.query.categories ? (req.query.categories as string).split(",") as PackageCategory[] : undefined;
    const tags = req.query.tags ? (req.query.tags as string).split(",") : undefined;
    const type = req.query.type as string;

    if (type === "trending") { res.json({ listings: engine.getTrending(limit) }); return; }
    if (type === "popular") { res.json({ listings: engine.getPopular(limit) }); return; }
    if (type === "new") { res.json({ listings: engine.getNewReleases(limit) }); return; }

    res.json({
      trending: engine.getTrending(limit),
      popular: engine.getPopular(limit),
      newReleases: engine.getNewReleases(limit),
      topRated: categories ? engine.recommendations.getForCategory(categories[0], limit) : [],
    });
  });

  // ── Package CRUD ──
  router.get("/packages/:name", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const listing = engine.get(name);
    if (!listing) { res.status(404).json({ error: "Package not found" }); return; }
    res.json(listing);
  });

  router.post("/packages", async (req: Request, res: Response) => {
    const { manifest, version } = req.body;
    if (!manifest || !version) { res.status(400).json({ error: "manifest and version required" }); return; }
    const result = await engine.publish(manifest, version);
    if (result.error) { res.status(400).json({ error: result.error, listing: result.listing }); return; }
    res.status(201).json(result.listing);
  });

  router.put("/packages/:name", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const { manifest, version } = req.body;
    if (!manifest || !version) { res.status(400).json({ error: "manifest and version required" }); return; }
    const listing = engine.update(name, manifest, version);
    if (!listing) { res.status(404).json({ error: "Package not found" }); return; }
    res.json(listing);
  });

  router.delete("/packages/:name", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const deleted = engine.deletePackage(name);
    if (!deleted) { res.status(404).json({ error: "Package not found" }); return; }
    res.json({ success: true });
  });

  // ── Deprecate / Archive ──
  router.post("/packages/:name/deprecate", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const { reason } = req.body;
    const success = engine.deprecatePackage(name, reason);
    if (!success) { res.status(404).json({ error: "Package not found" }); return; }
    res.json({ success: true });
  });

  router.post("/packages/:name/archive", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const success = engine.archivePackage(name);
    if (!success) { res.status(404).json({ error: "Package not found" }); return; }
    res.json({ success: true });
  });

  // ── Verify ──
  router.post("/packages/:name/verify", async (req: Request, res: Response) => {
    const name = req.params.name as string;
    const result = await engine.verifyPackage(name);
    if (!result) { res.status(404).json({ error: "Package not found" }); return; }
    res.json(result);
  });

  // ── Versions ──
  router.get("/packages/:name/versions", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const versions = engine.getVersionHistory(name);
    res.json({ versions });
  });

  router.get("/packages/:name/versions/:version", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const ver = req.params.version as string;
    const version = engine.getVersion(name, ver);
    if (!version) { res.status(404).json({ error: "Version not found" }); return; }
    res.json(version);
  });

  // ── Dependencies ──
  router.get("/packages/:name/versions/:version/dependencies", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const ver = req.params.version as string;
    const result = engine.resolveDependencies(name, ver);
    if (!result) { res.status(404).json({ error: "Package or version not found" }); return; }
    res.json(result);
  });

  router.get("/packages/:name/versions/:version/compatibility", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const ver = req.params.version as string;
    const result = engine.checkDependencyCompatibility(name, ver);
    if (!result) { res.status(404).json({ error: "Package or version not found" }); return; }
    res.json(result);
  });

  // ── Reviews ──
  router.get("/packages/:name/reviews", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const reviews = engine.getReviews(name, limit, offset);
    const listing = engine.get(name);
    res.json({
      reviews,
      total: listing?.stats.totalReviews ?? 0,
      distribution: engine.ratings.getRatingDistribution(listing?.id ?? ""),
      averageRating: listing?.stats.averageRating ?? 0,
    });
  });

  router.post("/packages/:name/reviews", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const { userId, userName, rating, content, title } = req.body;
    if (!userId || !userName || !rating || !content) { res.status(400).json({ error: "userId, userName, rating, content required" }); return; }
    try {
      const review = engine.addReview(name, userId, userName, rating, content, title);
      if (!review) { res.status(404).json({ error: "Package not found" }); return; }
      res.status(201).json(review);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  router.put("/packages/:name/reviews/:reviewId", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const reviewId = req.params.reviewId as string;
    const { userId, rating, content, title } = req.body;
    const review = engine.updateReview(name, reviewId, userId, rating, content, title);
    if (!review) { res.status(404).json({ error: "Review not found" }); return; }
    res.json(review);
  });

  router.delete("/packages/:name/reviews/:reviewId", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const reviewId = req.params.reviewId as string;
    const { userId } = req.body;
    const deleted = engine.deleteReview(name, reviewId, userId);
    if (!deleted) { res.status(404).json({ error: "Review not found" }); return; }
    res.json({ success: true });
  });

  // ── Creators ──
  router.post("/creators", (req: Request, res: Response) => {
    const { userId, name, displayName, bio } = req.body;
    if (!userId || !name) { res.status(400).json({ error: "userId and name required" }); return; }
    const profile: CreatorProfile = {
      id: `creator-${Date.now()}`, userId, name, displayName: displayName || name, bio: bio || "",
      packages: [], totalDownloads: 0, totalStars: 0, followers: 0, following: 0,
      joinedAt: new Date().toISOString(), isVerified: false,
    };
    const created = engine.registerCreator(profile);
    res.status(201).json(created);
  });

  router.get("/creators/:userId", (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const creator = engine.getCreator(userId);
    if (!creator) { res.status(404).json({ error: "Creator not found" }); return; }
    res.json(creator);
  });

  router.get("/creators/:userId/analytics", (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    try {
      const analytics = engine.getCreatorAnalytics(userId);
      res.json(analytics);
    } catch {
      res.status(404).json({ error: "Creator not found" });
    }
  });

  // ── Related ──
  router.get("/packages/:name/related", (req: Request, res: Response) => {
    const name = req.params.name as string;
    const listing = engine.get(name);
    if (!listing) { res.status(404).json({ error: "Package not found" }); return; }
    const related = engine.getRelated(listing.id);
    res.json({ listings: related });
  });

  // ── Categories ──
  router.get("/categories", (_req: Request, res: Response) => {
    res.json({
      categories: ALL_CATEGORIES.map(c => ({
        id: c,
        name: CATEGORY_DISPLAY[c],
        count: engine.packages.countByCategory()[c] ?? 0,
      })),
    });
  });

  // ── Licenses ──
  router.get("/licenses", (_req: Request, res: Response) => {
    res.json({ licenses: Object.values(LICENSE_INFO) });
  });

  // ── Events ──
  router.get("/events", (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json({ events: engine.getEvents(limit) });
  });

  // ── Plugins ──
  router.get("/plugins", (_req: Request, res: Response) => {
    res.json({ plugins: engine.getPlugins().map(p => ({ name: p.name, version: p.version })) });
  });

  // ── Export/Import ──
  router.get("/export", (_req: Request, res: Response) => {
    res.json(engine.getStats());
  });

  return router;
}
