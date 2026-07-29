import type { KnowledgeStore } from "../storage/interfaces.js";
import type { DecisionRecord } from "./types.js";
import { randomUUID } from "node:crypto";

export class DecisionMemory {
  constructor(private store: KnowledgeStore) {}

  async list(projectId: string): Promise<DecisionRecord[]> {
    return this.store.listDecisions(projectId);
  }

  async get(projectId: string, id: string): Promise<DecisionRecord | null> {
    return this.store.getDecision(projectId, id);
  }

  async record(projectId: string, data: {
    title: string; context: string; decision: string; reason: string;
    alternatives?: string[]; consequences?: string[]; tags?: string[]; owner?: string;
  }): Promise<DecisionRecord> {
    const now = Date.now();
    const record: DecisionRecord = {
      id: randomUUID(), projectId, status: "accepted",
      alternatives: data.alternatives ?? [],
      consequences: data.consequences ?? [],
      tags: data.tags ?? [],
      owner: data.owner ?? "system",
      ...data, createdAt: now, updatedAt: now,
    };
    await this.store.saveDecision(record);
    return record;
  }

  async update(projectId: string, id: string, updates: Partial<DecisionRecord>): Promise<DecisionRecord | null> {
    const existing = await this.store.getDecision(projectId, id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    await this.store.saveDecision(updated);
    return updated;
  }

  async delete(projectId: string, id: string): Promise<void> {
    await this.store.deleteDecision(projectId, id);
  }

  async getByTag(projectId: string, tag: string): Promise<DecisionRecord[]> {
    const all = await this.store.listDecisions(projectId);
    return all.filter((d) => d.tags.includes(tag));
  }
}
