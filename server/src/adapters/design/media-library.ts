import type { MediaItem } from "./types.js";

interface MediaLibraryConfig {
  uploadDir?: string;
  baseUrl?: string;
}

export class MediaLibrary {
  private items: Map<string, MediaItem> = new Map();
  private config: MediaLibraryConfig;

  constructor(config?: MediaLibraryConfig) {
    this.config = {
      uploadDir: config?.uploadDir || process.env.MEDIA_UPLOAD_DIR || "./uploads",
      baseUrl: config?.baseUrl || process.env.MEDIA_BASE_URL || "/uploads",
    };
  }

  async add(item: Omit<MediaItem, "id" | "createdAt">): Promise<MediaItem> {
    const newItem: MediaItem = {
      ...item,
      id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    this.items.set(newItem.id, newItem);
    return newItem;
  }

  async get(id: string): Promise<MediaItem | null> {
    return this.items.get(id) || null;
  }

  async list(folder?: string, tags?: string[], type?: string): Promise<MediaItem[]> {
    let result = Array.from(this.items.values());
    if (folder) result = result.filter((i) => i.folder === folder);
    if (tags && tags.length > 0) result = result.filter((i) => tags.some((t) => i.tags.includes(t)));
    if (type) result = result.filter((i) => i.type === type);
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async update(id: string, updates: Partial<MediaItem>): Promise<MediaItem | null> {
    const item = this.items.get(id);
    if (!item) return null;
    const updated = { ...item, ...updates, id: item.id, createdAt: item.createdAt };
    this.items.set(id, updated);
    return updated;
  }

  async search(query: string): Promise<MediaItem[]> {
    const q = query.toLowerCase();
    return Array.from(this.items.values()).filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q)) ||
        i.alt?.toLowerCase().includes(q)
    );
  }

  async getStats() {
    const all = Array.from(this.items.values());
    return {
      total: all.length,
      byType: all.reduce(
        (acc, i) => {
          acc[i.type] = (acc[i.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      totalSize: all.reduce((s, i) => s + i.size, 0),
    };
  }
}
