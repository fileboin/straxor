import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import type { MarketplaceStore, MarketplaceSnapshot } from "./interfaces.js";
import type { PackageListing, Review, CreatorProfile, MarketplaceEvent } from "../core/types.js";
import type { PaymentRecord } from "../payments/interfaces.js";
import { MarketplaceMemoryStore } from "./MemoryStore.js";

export class MarketplaceFileStore implements MarketplaceStore {
  private store: MarketplaceMemoryStore;
  private filePath: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;

  constructor(filePath: string) {
    this.store = new MarketplaceMemoryStore();
    this.filePath = filePath;
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(dirname(this.filePath), { recursive: true });
      const data = await fs.readFile(this.filePath, "utf-8");
      const snapshot: MarketplaceSnapshot = JSON.parse(data);
      await this.store.saveAll(snapshot);
    } catch {
      // file doesn't exist yet, start fresh
    }

    this.flushTimer = setInterval(() => this.flush(), 30000);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }

  private async flush(): Promise<void> {
    if (!this.dirty) return;
    try {
      const snapshot = await this.store.loadAll();
      await fs.writeFile(this.filePath, JSON.stringify(snapshot, null, 2), "utf-8");
      this.dirty = false;
    } catch (err) {
      console.error("[MarketplaceFileStore] flush error:", err);
    }
  }

  private markDirty(): void { this.dirty = true; }

  async savePackage(listing: PackageListing): Promise<void> {
    await this.store.savePackage(listing);
    this.markDirty();
  }
  async getPackage(name: string): Promise<PackageListing | undefined> { return this.store.getPackage(name); }
  async deletePackage(name: string): Promise<boolean> {
    const result = await this.store.deletePackage(name);
    if (result) this.markDirty();
    return result;
  }
  async listPackages(): Promise<PackageListing[]> { return this.store.listPackages(); }

  async saveReview(review: Review): Promise<void> {
    await this.store.saveReview(review);
    this.markDirty();
  }
  async getReviews(packageId: string): Promise<Review[]> { return this.store.getReviews(packageId); }
  async deleteReview(packageId: string, reviewId: string): Promise<boolean> {
    const result = await this.store.deleteReview(packageId, reviewId);
    if (result) this.markDirty();
    return result;
  }

  async saveCreator(profile: CreatorProfile): Promise<void> {
    await this.store.saveCreator(profile);
    this.markDirty();
  }
  async getCreator(userId: string): Promise<CreatorProfile | undefined> { return this.store.getCreator(userId); }
  async listCreators(): Promise<CreatorProfile[]> { return this.store.listCreators(); }

  async savePayment(record: PaymentRecord): Promise<void> {
    await this.store.savePayment(record);
    this.markDirty();
  }
  async getPayments(userId?: string): Promise<PaymentRecord[]> { return this.store.getPayments(userId); }

  async saveEvent(event: MarketplaceEvent): Promise<void> {
    await this.store.saveEvent(event);
    this.markDirty();
  }
  async getEvents(limit = 50): Promise<MarketplaceEvent[]> { return this.store.getEvents(limit); }

  async saveAll(data: MarketplaceSnapshot): Promise<void> {
    await this.store.saveAll(data);
    this.markDirty();
  }
  async loadAll(): Promise<MarketplaceSnapshot> { return this.store.loadAll(); }
  async clear(): Promise<void> {
    await this.store.clear();
    this.markDirty();
  }
}
