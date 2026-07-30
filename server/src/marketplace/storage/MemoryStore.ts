import type { MarketplaceStore, MarketplaceSnapshot } from "./interfaces.js";
import type { PackageListing, Review, CreatorProfile, MarketplaceEvent } from "../core/types.js";
import type { PaymentRecord } from "../payments/interfaces.js";

export class MarketplaceMemoryStore implements MarketplaceStore {
  private packages = new Map<string, PackageListing>();
  private reviews = new Map<string, Review[]>();
  private creators = new Map<string, CreatorProfile>();
  private payments: PaymentRecord[] = [];
  private events: MarketplaceEvent[] = [];

  async savePackage(listing: PackageListing): Promise<void> {
    this.packages.set(listing.manifest.name, listing);
  }

  async getPackage(name: string): Promise<PackageListing | undefined> {
    return this.packages.get(name);
  }

  async deletePackage(name: string): Promise<boolean> {
    return this.packages.delete(name);
  }

  async listPackages(): Promise<PackageListing[]> {
    return Array.from(this.packages.values());
  }

  async saveReview(review: Review): Promise<void> {
    const existing = this.reviews.get(review.packageId) ?? [];
    const idx = existing.findIndex(r => r.id === review.id);
    if (idx >= 0) existing[idx] = review;
    else existing.push(review);
    this.reviews.set(review.packageId, existing);
  }

  async getReviews(packageId: string): Promise<Review[]> {
    return this.reviews.get(packageId) ?? [];
  }

  async deleteReview(packageId: string, reviewId: string): Promise<boolean> {
    const existing = this.reviews.get(packageId);
    if (!existing) return false;
    const idx = existing.findIndex(r => r.id === reviewId);
    if (idx === -1) return false;
    existing.splice(idx, 1);
    if (existing.length === 0) this.reviews.delete(packageId);
    return true;
  }

  async saveCreator(profile: CreatorProfile): Promise<void> {
    this.creators.set(profile.userId, profile);
  }

  async getCreator(userId: string): Promise<CreatorProfile | undefined> {
    return this.creators.get(userId);
  }

  async listCreators(): Promise<CreatorProfile[]> {
    return Array.from(this.creators.values());
  }

  async savePayment(record: PaymentRecord): Promise<void> {
    const idx = this.payments.findIndex(p => p.id === record.id);
    if (idx >= 0) this.payments[idx] = record;
    else this.payments.push(record);
  }

  async getPayments(userId?: string): Promise<PaymentRecord[]> {
    if (!userId) return [...this.payments];
    return this.payments.filter(p => p.userId === userId);
  }

  async saveEvent(event: MarketplaceEvent): Promise<void> {
    this.events.push(event);
    if (this.events.length > 1000) this.events.shift();
  }

  async getEvents(limit = 50): Promise<MarketplaceEvent[]> {
    return this.events.slice(-limit);
  }

  async saveAll(data: MarketplaceSnapshot): Promise<void> {
    this.packages.clear();
    for (const pkg of data.packages) this.packages.set(pkg.manifest.name, pkg);

    this.reviews.clear();
    for (const review of data.reviews) {
      const existing = this.reviews.get(review.packageId) ?? [];
      existing.push(review);
      this.reviews.set(review.packageId, existing);
    }

    this.creators.clear();
    for (const creator of data.creators) this.creators.set(creator.userId, creator);

    this.payments = [...data.payments];
    this.events = [...data.events];
  }

  async loadAll(): Promise<MarketplaceSnapshot> {
    const allReviews: Review[] = [];
    for (const reviews of this.reviews.values()) allReviews.push(...reviews);

    return {
      packages: Array.from(this.packages.values()),
      reviews: allReviews,
      creators: Array.from(this.creators.values()),
      payments: [...this.payments],
      events: [...this.events],
      timestamp: new Date().toISOString(),
    };
  }

  async clear(): Promise<void> {
    this.packages.clear();
    this.reviews.clear();
    this.creators.clear();
    this.payments = [];
    this.events = [];
  }
}
