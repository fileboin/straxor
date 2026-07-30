import type { Review, PackageListing } from "./types.js";

export class RatingsManager {
  private reviews = new Map<string, Review[]>();

  addReview(pkg: PackageListing, userId: string, userName: string, rating: number, content: string, title?: string): Review {
    const existing = this.reviews.get(pkg.id) ?? [];
    const existingReview = existing.find(r => r.userId === userId);
    if (existingReview) throw new Error("User already reviewed this package");

    const review: Review = {
      id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      packageId: pkg.id,
      userId,
      userName,
      rating: Math.max(1, Math.min(5, rating)),
      title,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    existing.push(review);
    this.reviews.set(pkg.id, existing);
    this.updatePackageRating(pkg);
    return review;
  }

  updateReview(pkg: PackageListing, reviewId: string, userId: string, rating?: number, content?: string, title?: string): Review | undefined {
    const existing = this.reviews.get(pkg.id);
    if (!existing) return undefined;

    const review = existing.find(r => r.id === reviewId && r.userId === userId);
    if (!review) return undefined;

    if (rating !== undefined) review.rating = Math.max(1, Math.min(5, rating));
    if (content !== undefined) review.content = content;
    if (title !== undefined) review.title = title;
    review.updatedAt = new Date().toISOString();

    this.updatePackageRating(pkg);
    return review;
  }

  deleteReview(pkg: PackageListing, reviewId: string, userId: string): boolean {
    const existing = this.reviews.get(pkg.id);
    if (!existing) return false;

    const idx = existing.findIndex(r => r.id === reviewId && r.userId === userId);
    if (idx === -1) return false;

    existing.splice(idx, 1);
    if (existing.length === 0) this.reviews.delete(pkg.id);
    this.updatePackageRating(pkg);
    return true;
  }

  getReviews(packageId: string, limit = 20, offset = 0): Review[] {
    const all = this.reviews.get(packageId) ?? [];
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all.slice(offset, offset + limit);
  }

  getAverageRating(packageId: string): number {
    const all = this.reviews.get(packageId);
    if (!all || all.length === 0) return 0;
    const sum = all.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / all.length) * 10) / 10;
  }

  getRatingDistribution(packageId: string): Record<number, number> {
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const all = this.reviews.get(packageId);
    if (!all) return dist;
    for (const r of all) dist[r.rating]++;
    return dist;
  }

  reportReview(packageId: string, reviewId: string): boolean {
    return true;
  }

  private updatePackageRating(pkg: PackageListing): void {
    const all = this.reviews.get(pkg.id);
    pkg.stats.averageRating = this.getAverageRating(pkg.id);
    pkg.stats.totalReviews = all?.length ?? 0;
  }
}
