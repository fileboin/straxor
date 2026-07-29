import type { ImageRecord, AssetType } from "./types.js";

export class ImageLibrary {
  private images = new Map<string, ImageRecord>();
  private tagsIndex = new Map<string, Set<string>>();
  private projectIndex = new Map<string, Set<string>>();

  add(record: ImageRecord): void {
    this.images.set(record.id, record);

    if (record.projectId) {
      if (!this.projectIndex.has(record.projectId)) {
        this.projectIndex.set(record.projectId, new Set());
      }
      this.projectIndex.get(record.projectId)!.add(record.id);
    }

    for (const tag of record.tags) {
      if (!this.tagsIndex.has(tag)) {
        this.tagsIndex.set(tag, new Set());
      }
      this.tagsIndex.get(tag)!.add(record.id);
    }
  }

  get(id: string): ImageRecord | undefined {
    return this.images.get(id);
  }

  delete(id: string): void {
    const record = this.images.get(id);
    if (!record) return;

    this.images.delete(id);

    if (record.projectId) {
      this.projectIndex.get(record.projectId)?.delete(id);
    }

    for (const tag of record.tags) {
      this.tagsIndex.get(tag)?.delete(id);
    }
  }

  update(id: string, updates: Partial<ImageRecord>): ImageRecord | undefined {
    const existing = this.images.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.images.set(id, updated);
    return updated;
  }

  list(projectId?: string, tags?: string[], assetType?: AssetType, limit = 50, offset = 0): ImageRecord[] {
    let ids: Set<string> | undefined;

    if (projectId) {
      ids = this.projectIndex.get(projectId);
      if (!ids) return [];
    }

    let result = Array.from(this.images.values());

    if (ids) {
      result = result.filter(r => ids!.has(r.id));
    }

    if (tags && tags.length > 0) {
      result = result.filter(r => tags.some(t => r.tags.includes(t)));
    }

    if (assetType) {
      result = result.filter(r => r.assetType === assetType);
    }

    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return result.slice(offset, offset + limit);
  }

  search(query: string, projectId?: string): ImageRecord[] {
    const q = query.toLowerCase();
    let results = Array.from(this.images.values());

    if (projectId) {
      results = results.filter(r => r.projectId === projectId);
    }

    return results.filter(r =>
      r.prompt.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q)) ||
      r.provider.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  }

  count(): number {
    return this.images.size;
  }
}
