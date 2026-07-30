import type { PackageListing, SearchQuery, SearchResult, PackageCategory } from "./types.js";
import { ALL_CATEGORIES } from "./types.js";
import { PackageRegistry } from "./PackageRegistry.js";

interface TfIdfEntry {
  term: string;
  idf: number;
}

export class SearchEngine {
  private tfidfCache: Map<string, Map<string, number>> = new Map();
  private registry: PackageRegistry;

  constructor(registry: PackageRegistry) {
    this.registry = registry;
  }

  search(query: SearchQuery): SearchResult {
    let results = this.registry.list();

    if (query.category) results = results.filter(p => p.manifest.category === query.category);
    if (query.tags?.length) results = results.filter(p => query.tags!.some(t => p.manifest.tags.includes(t)));
    if (query.license) results = results.filter(p => p.manifest.license === query.license);
    if (query.minScore !== undefined) results = results.filter(p => p.verification.overallScore >= query.minScore!);

    if (query.query) {
      const q = query.query.toLowerCase();
      this.buildTfidfCache(results);
      results = this.rankByRelevance(results, q);
    }

    if (query.sortBy === "popularity") results.sort((a, b) => b.stats.downloads - a.stats.downloads);
    else if (query.sortBy === "downloads") results.sort((a, b) => b.stats.downloads - a.stats.downloads);
    else if (query.sortBy === "rating") results.sort((a, b) => b.stats.averageRating - a.stats.averageRating);
    else if (query.sortBy === "newest") results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    else if (query.sortBy === "name") results.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));

    if (query.sortOrder === "asc") results.reverse();

    const total = results.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    const listings = results.slice(offset, offset + limit);

    const facets = {
      categories: this.buildCategoryFacet(results),
      licenses: this.buildLicenseFacet(results),
      tags: this.buildTagFacet(results),
    };

    return { listings, total, query: query.query, facets };
  }

  semanticSearch(query: string, category?: PackageCategory, limit = 10): PackageListing[] {
    let candidates = this.registry.list(category);
    this.buildTfidfCache(candidates);
    const ranked = this.rankByRelevance(candidates, query.toLowerCase());
    return ranked.slice(0, limit);
  }

  private buildTfidfCache(listings: PackageListing[]): void {
    const docCount = listings.length;
    if (docCount === 0) return;

    const df = new Map<string, number>();

    for (const listing of listings) {
      const terms = this.tokenize(listing);
      const uniqueTerms = new Set(terms);
      for (const term of uniqueTerms) {
        df.set(term, (df.get(term) ?? 0) + 1);
      }
    }

    for (const listing of listings) {
      const terms = this.tokenize(listing);
      const tfidf = new Map<string, number>();
      const termCount = terms.length;

      for (const term of terms) {
        const tf = terms.filter(t => t === term).length / termCount;
        const idf = Math.log((docCount + 1) / (df.get(term)! + 1)) + 1;
        tfidf.set(term, tf * idf);
      }

      this.tfidfCache.set(listing.id, tfidf);
    }
  }

  private rankByRelevance(listings: PackageListing[], query: string): PackageListing[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (queryTerms.length === 0) return listings;

    const scored = listings.map(listing => {
      let score = 0;
      const tfidf = this.tfidfCache.get(listing.id);
      if (!tfidf) return { listing, score: 0 };

      for (const qt of queryTerms) {
        score += tfidf.get(qt) ?? 0;

        if (listing.manifest.name.toLowerCase().includes(qt)) score += 2;
        if (listing.manifest.tags.some(t => t.toLowerCase().includes(qt))) score += 1.5;
        if (listing.manifest.keywords.some(k => k.toLowerCase().includes(qt))) score += 1;
        if (listing.manifest.displayName.toLowerCase().includes(qt)) score += 1;
      }

      return { listing, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.listing);
  }

  private tokenize(listing: PackageListing): string[] {
    const text = [
      listing.manifest.name,
      listing.manifest.displayName,
      listing.manifest.description,
      ...listing.manifest.tags,
      ...listing.manifest.keywords,
    ].join(" ").toLowerCase();

    return text.split(/\s+/).filter(t => t.length > 1);
  }

  private buildCategoryFacet(listings: PackageListing[]): Record<string, number> {
    const facets: Record<string, number> = {};
    for (const cat of ALL_CATEGORIES) facets[cat] = 0;
    for (const listing of listings) facets[listing.manifest.category]++;
    return facets;
  }

  private buildLicenseFacet(listings: PackageListing[]): Record<string, number> {
    const facets: Record<string, number> = {};
    for (const listing of listings) {
      facets[listing.manifest.license] = (facets[listing.manifest.license] ?? 0) + 1;
    }
    return facets;
  }

  private buildTagFacet(listings: PackageListing[]): Record<string, number> {
    const facets: Record<string, number> = {};
    for (const listing of listings) {
      for (const tag of listing.manifest.tags) {
        facets[tag] = (facets[tag] ?? 0) + 1;
      }
    }
    return facets;
  }
}
