import { db } from "../../db/index.js";
import {
  marketplaceCorePackages,
  marketplaceCoreReviews,
  marketplaceCoreCreators,
  marketplaceCorePayments,
  marketplaceCoreEvents,
} from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type { MarketplaceStore, MarketplaceSnapshot } from "./interfaces.js";
import type { PackageListing, Review, CreatorProfile, MarketplaceEvent } from "../core/types.js";
import type { PaymentRecord } from "../payments/interfaces.js";

export class PostgresStore implements MarketplaceStore {
  async savePackage(listing: PackageListing): Promise<void> {
    await db.insert(marketplaceCorePackages).values({
      name: listing.manifest.name,
      listing: listing as any,
    }).onConflictDoUpdate({
      target: marketplaceCorePackages.name,
      set: { listing: listing as any, updatedAt: new Date() },
    });
  }

  async getPackage(name: string): Promise<PackageListing | undefined> {
    const row = await db.select().from(marketplaceCorePackages).where(eq(marketplaceCorePackages.name, name)).limit(1);
    return row.length > 0 ? (row[0].listing as unknown as PackageListing) : undefined;
  }

  async deletePackage(name: string): Promise<boolean> {
    const result = await db.delete(marketplaceCorePackages).where(eq(marketplaceCorePackages.name, name));
    return result.count > 0;
  }

  async listPackages(): Promise<PackageListing[]> {
    const rows = await db.select().from(marketplaceCorePackages);
    return rows.map(r => r.listing as unknown as PackageListing);
  }

  async saveReview(review: Review): Promise<void> {
    await db.insert(marketplaceCoreReviews).values({
      packageId: review.packageId,
      review: review as any,
    }).onConflictDoUpdate({
      target: marketplaceCoreReviews.id,
      set: { review: review as any },
    });
  }

  async getReviews(packageId: string): Promise<Review[]> {
    const rows = await db.select().from(marketplaceCoreReviews).where(eq(marketplaceCoreReviews.packageId, packageId));
    return rows.map(r => r.review as unknown as Review);
  }

  async deleteReview(packageId: string, reviewId: string): Promise<boolean> {
    const result = await db.delete(marketplaceCoreReviews)
      .where(eq(marketplaceCoreReviews.id, reviewId));
    return result.count > 0;
  }

  async saveCreator(profile: CreatorProfile): Promise<void> {
    await db.insert(marketplaceCoreCreators).values({
      userId: profile.userId,
      profile: profile as any,
    }).onConflictDoUpdate({
      target: marketplaceCoreCreators.userId,
      set: { profile: profile as any },
    });
  }

  async getCreator(userId: string): Promise<CreatorProfile | undefined> {
    const rows = await db.select().from(marketplaceCoreCreators)
      .where(eq(marketplaceCoreCreators.userId, userId)).limit(1);
    return rows.length > 0 ? (rows[0].profile as unknown as CreatorProfile) : undefined;
  }

  async listCreators(): Promise<CreatorProfile[]> {
    const rows = await db.select().from(marketplaceCoreCreators);
    return rows.map(r => r.profile as unknown as CreatorProfile);
  }

  async savePayment(record: PaymentRecord): Promise<void> {
    await db.insert(marketplaceCorePayments).values({
      payment: record as any,
    });
  }

  async getPayments(userId?: string): Promise<PaymentRecord[]> {
    const rows = await db.select().from(marketplaceCorePayments);
    const payments = rows.map(r => r.payment as unknown as PaymentRecord);
    return userId ? payments.filter(p => p.userId === userId) : payments;
  }

  async saveEvent(event: MarketplaceEvent): Promise<void> {
    await db.insert(marketplaceCoreEvents).values({
      event: event as any,
    });
  }

  async getEvents(limit = 50): Promise<MarketplaceEvent[]> {
    const rows = await db.select().from(marketplaceCoreEvents).limit(limit);
    return rows.map(r => r.event as unknown as MarketplaceEvent);
  }

  async saveAll(data: MarketplaceSnapshot): Promise<void> {
    for (const pkg of data.packages) await this.savePackage(pkg);
    for (const review of data.reviews) await this.saveReview(review);
    for (const creator of data.creators) await this.saveCreator(creator);
    for (const payment of data.payments) await this.savePayment(payment);
    for (const event of data.events) await this.saveEvent(event);
  }

  async loadAll(): Promise<MarketplaceSnapshot> {
    const [packages, reviews, creators, payments, events] = await Promise.all([
      this.listPackages(),
      Promise.all((await db.select({ id: marketplaceCorePackages.id }).from(marketplaceCorePackages))
        .map(p => this.getReviews(p.id))).then(r => r.flat()),
      this.listCreators(),
      this.getPayments(),
      this.getEvents(1000),
    ]);
    return { packages, reviews, creators, payments, events, timestamp: new Date().toISOString() };
  }

  async clear(): Promise<void> {
    await db.delete(marketplaceCoreEvents);
    await db.delete(marketplaceCorePayments);
    await db.delete(marketplaceCoreCreators);
    await db.delete(marketplaceCoreReviews);
    await db.delete(marketplaceCorePackages);
  }
}
