import type { PackageListing, RecommendationContext, PackageCategory } from "./types.js";
import { PackageRegistry } from "./PackageRegistry.js";

interface PackageVector {
  categories: Set<string>;
  tags: Set<string>;
}

export class RecommendationEngine {
  private registry: PackageRegistry;

  constructor(registry: PackageRegistry) {
    this.registry = registry;
  }

  recommendForUser(context: RecommendationContext, limit = 10): PackageListing[] {
    const allPkgs = this.registry.list();
    if (allPkgs.length === 0) return [];

    const userVec = this.buildUserVector(context);
    const scored = allPkgs.map(pkg => ({
      listing: pkg,
      score: this.calculateSimilarity(userVec, this.buildPackageVector(pkg), context, pkg),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.listing);
  }

  getTrending(limit = 10): PackageListing[] {
    const allPkgs = this.registry.list();
    allPkgs.sort((a, b) => {
      const scoreA = (b.stats.downloads * 0.4) + (b.stats.installs * 0.3) + (b.stats.averageRating * 0.3);
      const scoreB = (a.stats.downloads * 0.4) + (a.stats.installs * 0.3) + (a.stats.averageRating * 0.3);
      return scoreA - scoreB;
    });
    return allPkgs.slice(0, limit);
  }

  getPopular(limit = 10): PackageListing[] {
    const allPkgs = this.registry.list();
    allPkgs.sort((a, b) => b.stats.downloads - a.stats.downloads);
    return allPkgs.slice(0, limit);
  }

  getNewReleases(limit = 10): PackageListing[] {
    const allPkgs = this.registry.list();
    allPkgs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return allPkgs.slice(0, limit);
  }

  getForCategory(category: PackageCategory, limit = 10): PackageListing[] {
    const pkgs = this.registry.list(category);
    pkgs.sort((a, b) => b.stats.averageRating - a.stats.averageRating);
    return pkgs.slice(0, limit);
  }

  getRelated(packageId: string, limit = 5): PackageListing[] {
    const pkg = this.registry.getById(packageId);
    if (!pkg) return [];

    const pkgVec = this.buildPackageVector(pkg);
    const others = this.registry.list().filter(p => p.id !== packageId);

    const scored = others.map(other => ({
      listing: other,
      score: this.calculateSimpleSimilarity(pkgVec, this.buildPackageVector(other)),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.listing);
  }

  private buildUserVector(ctx: RecommendationContext): PackageVector {
    const categories = new Set(ctx.categories ?? []);
    const tags = new Set(ctx.tags ?? []);

    if (ctx.recentInstalls) {
      for (const name of ctx.recentInstalls) {
        const pkg = this.registry.get(name);
        if (pkg) {
          categories.add(pkg.manifest.category);
          pkg.manifest.tags.forEach(t => tags.add(t));
        }
      }
    }

    if (ctx.favorites) {
      for (const name of ctx.favorites) {
        const pkg = this.registry.get(name);
        if (pkg) {
          categories.add(pkg.manifest.category);
          pkg.manifest.tags.forEach(t => tags.add(t));
        }
      }
    }

    return { categories, tags };
  }

  private buildPackageVector(pkg: PackageListing): PackageVector {
    return {
      categories: new Set([pkg.manifest.category]),
      tags: new Set(pkg.manifest.tags),
    };
  }

  private calculateSimilarity(userVec: PackageVector, pkgVec: PackageVector, context: RecommendationContext, pkg: PackageListing): number {
    let score = this.calculateSimpleSimilarity(userVec, pkgVec);

    score += pkg.stats.averageRating * 5;
    score += Math.min(pkg.stats.downloads / 1000, 10);
    score += pkg.verification.overallScore / 20;

    const recent = pkg.versions.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    if (recent.length > 0) {
      const daysSinceUpdate = (Date.now() - new Date(recent[0].publishedAt).getTime()) / 86400000;
      if (daysSinceUpdate < 30) score += 3;
    }

    return score;
  }

  private calculateSimpleSimilarity(a: PackageVector, b: PackageVector): number {
    const catIntersect = new Set([...a.categories].filter(x => b.categories.has(x)));
    const tagIntersect = new Set([...a.tags].filter(x => b.tags.has(x)));

    const catUnion = new Set([...a.categories, ...b.categories]);
    const tagUnion = new Set([...a.tags, ...b.tags]);

    const catSim = catUnion.size === 0 ? 0 : catIntersect.size / catUnion.size;
    const tagSim = tagUnion.size === 0 ? 0 : tagIntersect.size / tagUnion.size;

    return (catSim * 0.6) + (tagSim * 0.4);
  }
}
