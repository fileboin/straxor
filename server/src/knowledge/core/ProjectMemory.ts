import type { KnowledgeStore } from "../storage/interfaces.js";
import type { ProjectInfo, KnowledgeItem, Confidence } from "./types.js";
import { randomUUID } from "node:crypto";

export class ProjectMemory {
  constructor(private store: KnowledgeStore) {}

  async getProject(projectId: string): Promise<ProjectInfo | null> {
    return this.store.getProject(projectId);
  }

  async saveProject(info: ProjectInfo): Promise<void> {
    info.updatedAt = Date.now();
    await this.store.saveProject(info);
  }

  async createProject(id: string, name: string): Promise<ProjectInfo> {
    const now = Date.now();
    const info: ProjectInfo = {
      id, name, description: "",
      architecture: "", frameworks: [], languages: [],
      rootDir: "/", importantFolders: [],
      modules: [], services: [], apis: [],
      databaseSchema: [], deploymentTargets: [],
      codingStandards: [], projectGoals: [],
      createdAt: now, updatedAt: now,
    };
    await this.store.saveProject(info);
    return info;
  }

  async getKnowledge(projectId: string, key: string): Promise<KnowledgeItem | null> {
    return this.store.getKnowledge(projectId, key);
  }

  async listKnowledge(projectId: string, type?: string): Promise<KnowledgeItem[]> {
    return this.store.listKnowledge(projectId, type);
  }

  async addKnowledge(item: Omit<KnowledgeItem, "id" | "createdAt" | "updatedAt">): Promise<KnowledgeItem> {
    const now = Date.now();
    const record: KnowledgeItem = {
      ...item,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await this.store.saveKnowledge(record);
    this.store.publishEvent({
      type: "created", itemType: "knowledge", itemId: record.id,
      projectId: item.projectId, timestamp: now, data: { key: item.key },
    });
    return record;
  }

  async updateKnowledge(projectId: string, key: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem | null> {
    const existing = await this.store.getKnowledge(projectId, key);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    await this.store.saveKnowledge(updated);
    return updated;
  }

  async deleteKnowledge(projectId: string, key: string): Promise<void> {
    await this.store.deleteKnowledge(projectId, key);
    this.store.publishEvent({
      type: "deleted", itemType: "knowledge", itemId: key,
      projectId, timestamp: Date.now(),
    });
  }

  async autoLearn(projectId: string, key: string, value: unknown, summary: string, type: KnowledgeItem["type"], source: KnowledgeItem["source"] = "file_scan"): Promise<KnowledgeItem> {
    const existing = await this.store.getKnowledge(projectId, key);
    if (existing) {
      existing.value = value;
      existing.summary = summary;
      existing.updatedAt = Date.now();
      existing.source = source;
      existing.confidence = Math.min(5, existing.confidence + 1) as Confidence;
      await this.store.saveKnowledge(existing);
      return existing;
    }
    return this.addKnowledge({ projectId, type, key, value, summary, tags: [], source, confidence: 3, owner: "system", verificationStatus: "unverified" });
  }
}
