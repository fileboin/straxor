import type { ImageStore, ProviderConfigRecord } from "./interfaces.js";
import type {
  ImageRecord, ImageStyle, PromptTemplate, PromptHistoryEntry,
  BrandIdentity, CostRecord, OptimizationResult, ImageEvent,
} from "../core/types.js";

export class MemoryImageStore implements ImageStore {
  private images = new Map<string, ImageRecord>();
  private styles = new Map<string, ImageStyle>();
  private templates = new Map<string, PromptTemplate>();
  private promptHistory: PromptHistoryEntry[] = [];
  private brands = new Map<string, BrandIdentity>();
  private costRecords: CostRecord[] = [];
  private optimizationResults = new Map<string, OptimizationResult[]>();
  private providerConfigs = new Map<string, ProviderConfigRecord>();
  private events: ImageEvent[] = [];

  async saveImage(record: ImageRecord): Promise<void> { this.images.set(record.id, record); }
  async getImage(id: string): Promise<ImageRecord | null> { return this.images.get(id) ?? null; }

  async listImages(projectId?: string, tags?: string[], assetType?: string, limit = 50, offset = 0): Promise<ImageRecord[]> {
    let result = Array.from(this.images.values());
    if (projectId) result = result.filter(r => r.projectId === projectId);
    if (tags && tags.length > 0) result = result.filter(r => tags.some(t => r.tags.includes(t)));
    if (assetType) result = result.filter(r => r.assetType === assetType);
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result.slice(offset, offset + limit);
  }

  async deleteImage(id: string): Promise<void> { this.images.delete(id); }
  async updateImage(id: string, updates: Partial<ImageRecord>): Promise<void> {
    const existing = this.images.get(id);
    if (existing) this.images.set(id, { ...existing, ...updates, updatedAt: new Date().toISOString() });
  }

  async saveStyle(style: ImageStyle): Promise<void> { this.styles.set(style.id, style); }
  async getStyle(id: string): Promise<ImageStyle | null> { return this.styles.get(id) ?? null; }
  async listStyles(category?: string): Promise<ImageStyle[]> {
    let result = Array.from(this.styles.values());
    if (category) result = result.filter(s => s.category === category);
    return result;
  }
  async deleteStyle(id: string): Promise<void> { this.styles.delete(id); }

  async savePromptTemplate(template: PromptTemplate): Promise<void> { this.templates.set(template.id, template); }
  async getPromptTemplate(id: string): Promise<PromptTemplate | null> { return this.templates.get(id) ?? null; }
  async listPromptTemplates(category?: string): Promise<PromptTemplate[]> {
    let result = Array.from(this.templates.values());
    if (category) result = result.filter(t => t.category === category);
    return result;
  }
  async deletePromptTemplate(id: string): Promise<void> { this.templates.delete(id); }

  async savePromptHistory(entry: PromptHistoryEntry): Promise<void> { this.promptHistory.unshift(entry); }
  async listPromptHistory(limit = 50): Promise<PromptHistoryEntry[]> { return this.promptHistory.slice(0, limit); }

  async saveBrand(brand: BrandIdentity): Promise<void> { this.brands.set(brand.projectId, brand); }
  async getBrand(projectId: string): Promise<BrandIdentity | null> { return this.brands.get(projectId) ?? null; }
  async deleteBrand(projectId: string): Promise<void> { this.brands.delete(projectId); }

  async saveCostRecord(record: CostRecord): Promise<void> { this.costRecords.push(record); }
  async listCostRecords(projectId?: string, provider?: string, limit = 100): Promise<CostRecord[]> {
    let result = this.costRecords;
    if (projectId) result = result.filter(r => r.projectId === projectId);
    if (provider) result = result.filter(r => r.provider === provider);
    return result.slice(0, limit);
  }

  async saveOptimizationResult(result: OptimizationResult): Promise<void> {
    const existing = this.optimizationResults.get(result.imageId) ?? [];
    existing.push(result);
    this.optimizationResults.set(result.imageId, existing);
  }
  async listOptimizationResults(imageId: string): Promise<OptimizationResult[]> {
    return this.optimizationResults.get(imageId) ?? [];
  }

  async saveProviderConfig(config: ProviderConfigRecord): Promise<void> { this.providerConfigs.set(config.name, config); }
  async getProviderConfig(name: string): Promise<ProviderConfigRecord | null> { return this.providerConfigs.get(name) ?? null; }
  async listProviderConfigs(): Promise<ProviderConfigRecord[]> { return Array.from(this.providerConfigs.values()); }
  async deleteProviderConfig(name: string): Promise<void> { this.providerConfigs.delete(name); }

  async saveEvent(event: ImageEvent): Promise<void> { this.events.push(event); }
  async listEvents(projectId?: string, type?: string, limit = 100): Promise<ImageEvent[]> {
    let result = this.events;
    if (projectId) result = result.filter(e => e.projectId === projectId);
    if (type) result = result.filter(e => e.type === type);
    return result.slice(0, limit);
  }

  async searchImages(query: string, projectId?: string): Promise<ImageRecord[]> {
    const q = query.toLowerCase();
    let result = Array.from(this.images.values());
    if (projectId) result = result.filter(r => r.projectId === projectId);
    return result.filter(r =>
      r.prompt.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q)) ||
      r.provider.toLowerCase().includes(q)
    );
  }
}
