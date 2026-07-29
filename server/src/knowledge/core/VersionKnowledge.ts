import type { KnowledgeStore } from "../storage/interfaces.js";
import type { VersionSnapshot } from "./types.js";
import { randomUUID } from "node:crypto";

export class VersionKnowledge {
  constructor(private store: KnowledgeStore) {}

  async listVersions(projectId: string): Promise<VersionSnapshot[]> {
    return this.store.listVersions(projectId);
  }

  async getVersion(projectId: string, id: string): Promise<VersionSnapshot | null> {
    return this.store.getVersion(projectId, id);
  }

  async createSnapshot(projectId: string, data: {
    version: string; label: string;
    changes: { type: string; description: string }[];
    knowledgeDelta: { added: string[]; removed: string[]; modified: string[] };
  }): Promise<VersionSnapshot> {
    const snapshot: VersionSnapshot = {
      id: randomUUID(), projectId,
      ...data, createdAt: Date.now(),
    };
    await this.store.saveVersion(snapshot);
    return snapshot;
  }

  async getTimeline(projectId: string): Promise<{ snapshot: VersionSnapshot; index: number }[]> {
    const versions = await this.store.listVersions(projectId);
    return versions.sort((a, b) => a.createdAt - b.createdAt).map((snapshot, index) => ({ snapshot, index }));
  }

  async getLatestVersion(projectId: string): Promise<VersionSnapshot | null> {
    const versions = await this.store.listVersions(projectId);
    if (versions.length === 0) return null;
    return versions.sort((a, b) => b.createdAt - a.createdAt)[0];
  }

  async compare(projectId: string, id1: string, id2: string): Promise<{
    from: VersionSnapshot; to: VersionSnapshot;
    added: string[]; removed: string[]; common: string[];
  } | null> {
    const v1 = await this.store.getVersion(projectId, id1);
    const v2 = await this.store.getVersion(projectId, id2);
    if (!v1 || !v2) return null;
    const s1 = new Set(v1.knowledgeDelta.added);
    const s2 = new Set(v2.knowledgeDelta.added);
    return {
      from: v1, to: v2,
      added: [...s2].filter((x) => !s1.has(x)),
      removed: [...s1].filter((x) => !s2.has(x)),
      common: [...s1].filter((x) => s2.has(x)),
    };
  }
}
