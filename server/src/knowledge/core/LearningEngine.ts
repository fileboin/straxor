import type { KnowledgeStore } from "../storage/interfaces.js";
import type { KnowledgeItem, KnowledgeEvent, Confidence } from "./types.js";

export class LearningEngine {
  private scanInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private store: KnowledgeStore) {
    this.store.subscribe((event) => this.handleEvent(event));
  }

  private async handleEvent(event: KnowledgeEvent): Promise<void> {
    if (event.type === "created" || event.type === "updated") {
      // Could trigger re-analysis of related knowledge
    }
  }

  startAutoScan(intervalMs: number = 60000): void {
    this.stopAutoScan();
    this.scanInterval = setInterval(() => this.autoLearnAll(), intervalMs);
  }

  stopAutoScan(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  private async autoLearnAll(): Promise<void> {
    // In a full implementation, this would scan file changes,
    // detect new modules, update architecture knowledge
  }

  async learnFromEvent(event: KnowledgeEvent, projectId: string): Promise<KnowledgeItem | null> {
    if (event.type !== "created" && event.type !== "updated") return null;
    if (!event.data) return null;

    const now = Date.now();
    const item: KnowledgeItem = {
      id: `auto_${now}`,
      projectId,
      type: "business_logic",
      key: `event_${event.itemType}_${event.itemId}`,
      value: event.data,
      summary: `Auto-learned from ${event.itemType} change`,
      tags: ["auto_learned", event.itemType],
      source: "ai_analysis",
      confidence: 2 as Confidence,
      owner: "system",
      verificationStatus: "unverified",
      createdAt: now,
      updatedAt: now,
    };

    await this.store.saveKnowledge(item);
    this.store.publishEvent({
      type: "created", itemType: "knowledge", itemId: item.id,
      projectId, timestamp: now, data: { key: item.key },
    });

    return item;
  }
}
