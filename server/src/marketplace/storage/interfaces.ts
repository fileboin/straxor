import type { PackageListing, Review, CreatorProfile, MarketplaceEvent } from "../core/types.js";
import type { PaymentRecord } from "../payments/interfaces.js";

export interface MarketplaceStore {
  savePackage(listing: PackageListing): Promise<void>;
  getPackage(name: string): Promise<PackageListing | undefined>;
  deletePackage(name: string): Promise<boolean>;
  listPackages(): Promise<PackageListing[]>;

  saveReview(review: Review): Promise<void>;
  getReviews(packageId: string): Promise<Review[]>;
  deleteReview(packageId: string, reviewId: string): Promise<boolean>;

  saveCreator(profile: CreatorProfile): Promise<void>;
  getCreator(userId: string): Promise<CreatorProfile | undefined>;
  listCreators(): Promise<CreatorProfile[]>;

  savePayment(record: PaymentRecord): Promise<void>;
  getPayments(userId?: string): Promise<PaymentRecord[]>;

  saveEvent(event: MarketplaceEvent): Promise<void>;
  getEvents(limit?: number): Promise<MarketplaceEvent[]>;

  saveAll(data: MarketplaceSnapshot): Promise<void>;
  loadAll(): Promise<MarketplaceSnapshot>;
  clear(): Promise<void>;
}

export interface MarketplaceSnapshot {
  packages: PackageListing[];
  reviews: Review[];
  creators: CreatorProfile[];
  payments: PaymentRecord[];
  events: MarketplaceEvent[];
  timestamp: string;
}
