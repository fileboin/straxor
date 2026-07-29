import * as fs from "node:fs";
import * as path from "node:path";
import type { ImageStore, ProviderConfigRecord } from "./interfaces.js";
import type {
  ImageRecord, ImageStyle, PromptTemplate, PromptHistoryEntry,
  BrandIdentity, CostRecord, OptimizationResult, ImageEvent,
} from "../core/types.js";

interface FileStoreData {
  images: ImageRecord[];
  styles: ImageStyle[];
  templates: PromptTemplate[];
  promptHistory: PromptHistoryEntry[];
  brands: BrandIdentity[];
  costRecords: CostRecord[];
  optimizationResults: [string, OptimizationResult[]][];
  providerConfigs: ProviderConfigRecord[];
  events: ImageEvent[];
}

export class FileImageStore implements ImageStore {
  private data: FileStoreData = {
    images: [], styles: [], templates: [], promptHistory: [],
    brands: [], costRecords: [], optimizationResults: [],
    providerConfigs: [], events: [],
  };

  private filePath: string;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  constructor(basePath?: string) {
    const dir = basePath || process.env.IMAGE_STORE_PATH || path.join(process.cwd(), "image-data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, "store.json");
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        this.data = JSON.parse(raw) as FileStoreData;
      }
    } catch {
      this.data = {
        images: [], styles: [], templates: [], promptHistory: [],
        brands: [], costRecords: [], optimizationResults: [],
        providerConfigs: [], events: [],
      };
    }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flush();
      this.flushTimer = null;
    }, 30_000);
  }

  flush(): void {
    if (!this.dirty) return;
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
      this.dirty = false;
    } catch {}
  }

  private mapImages(): Map<string, ImageRecord> {
    return new Map(this.data.images.map(i => [i.id, i]));
  }

  private mapStyles(): Map<string, ImageStyle> {
    return new Map(this.data.styles.map(s => [s.id, s]));
  }

  private mapTemplates(): Map<string, PromptTemplate> {
    return new Map(this.data.templates.map(t => [t.id, t]));
  }

  private mapBrands(): Map<string, BrandIdentity> {
    return new Map(this.data.brands.map(b => [b.projectId, b]));
  }

  // images
  async saveImage(record: ImageRecord): Promise<void> {
    const map = this.mapImages();
    map.set(record.id, record);
    this.data.images = Array.from(map.values());
    this.scheduleFlush();
  }

  async getImage(id: string): Promise<ImageRecord | null> {
    return this.mapImages().get(id) ?? null;
  }

  async listImages(projectId?: string, tags?: string[], assetType?: string, limit = 50, offset = 0): Promise<ImageRecord[]> {
    let result = this.data.images;
    if (projectId) result = result.filter(r => r.projectId === projectId);
    if (tags?.length) result = result.filter(r => tags.some(t => r.tags.includes(t)));
    if (assetType) result = result.filter(r => r.assetType === assetType);
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result.slice(offset, offset + limit);
  }

  async deleteImage(id: string): Promise<void> {
    const map = this.mapImages();
    map.delete(id);
    this.data.images = Array.from(map.values());
    this.scheduleFlush();
  }

  async updateImage(id: string, updates: Partial<ImageRecord>): Promise<void> {
    const map = this.mapImages();
    const existing = map.get(id);
    if (existing) {
      map.set(id, { ...existing, ...updates, updatedAt: new Date().toISOString() });
      this.data.images = Array.from(map.values());
      this.scheduleFlush();
    }
  }

  // styles
  async saveStyle(style: ImageStyle): Promise<void> {
    const map = this.mapStyles();
    map.set(style.id, style);
    this.data.styles = Array.from(map.values());
    this.scheduleFlush();
  }

  async getStyle(id: string): Promise<ImageStyle | null> {
    return this.mapStyles().get(id) ?? null;
  }

  async listStyles(category?: string): Promise<ImageStyle[]> {
    if (category) return this.data.styles.filter(s => s.category === category);
    return this.data.styles;
  }

  async deleteStyle(id: string): Promise<void> {
    const map = this.mapStyles();
    map.delete(id);
    this.data.styles = Array.from(map.values());
    this.scheduleFlush();
  }

  // templates
  async savePromptTemplate(template: PromptTemplate): Promise<void> {
    const map = this.mapTemplates();
    map.set(template.id, template);
    this.data.templates = Array.from(map.values());
    this.scheduleFlush();
  }

  async getPromptTemplate(id: string): Promise<PromptTemplate | null> {
    return this.mapTemplates().get(id) ?? null;
  }

  async listPromptTemplates(category?: string): Promise<PromptTemplate[]> {
    if (category) return this.data.templates.filter(t => t.category === category);
    return this.data.templates;
  }

  async deletePromptTemplate(id: string): Promise<void> {
    const map = this.mapTemplates();
    map.delete(id);
    this.data.templates = Array.from(map.values());
    this.scheduleFlush();
  }

  // prompt history
  async savePromptHistory(entry: PromptHistoryEntry): Promise<void> {
    this.data.promptHistory.unshift(entry);
    if (this.data.promptHistory.length > 500) this.data.promptHistory.pop();
    this.scheduleFlush();
  }

  async listPromptHistory(limit = 50): Promise<PromptHistoryEntry[]> {
    return this.data.promptHistory.slice(0, limit);
  }

  // brands
  async saveBrand(brand: BrandIdentity): Promise<void> {
    const map = this.mapBrands();
    map.set(brand.projectId, brand);
    this.data.brands = Array.from(map.values());
    this.scheduleFlush();
  }

  async getBrand(projectId: string): Promise<BrandIdentity | null> {
    return this.mapBrands().get(projectId) ?? null;
  }

  async deleteBrand(projectId: string): Promise<void> {
    const map = this.mapBrands();
    map.delete(projectId);
    this.data.brands = Array.from(map.values());
    this.scheduleFlush();
  }

  // costs
  async saveCostRecord(record: CostRecord): Promise<void> {
    this.data.costRecords.push(record);
    this.scheduleFlush();
  }

  async listCostRecords(projectId?: string, provider?: string, limit = 100): Promise<CostRecord[]> {
    let result = this.data.costRecords;
    if (projectId) result = result.filter(r => r.projectId === projectId);
    if (provider) result = result.filter(r => r.provider === provider);
    return result.slice(0, limit);
  }

  // optimization results
  async saveOptimizationResult(result: OptimizationResult): Promise<void> {
    const map = new Map(this.data.optimizationResults);
    const existing = map.get(result.imageId) ?? [];
    existing.push(result);
    map.set(result.imageId, existing);
    this.data.optimizationResults = Array.from(map.entries());
    this.scheduleFlush();
  }

  async listOptimizationResults(imageId: string): Promise<OptimizationResult[]> {
    const map = new Map(this.data.optimizationResults);
    return map.get(imageId) ?? [];
  }

  // provider configs
  async saveProviderConfig(config: ProviderConfigRecord): Promise<void> {
    const map = new Map(this.data.providerConfigs.map(c => [c.name, c]));
    map.set(config.name, config);
    this.data.providerConfigs = Array.from(map.values());
    this.scheduleFlush();
  }

  async getProviderConfig(name: string): Promise<ProviderConfigRecord | null> {
    return this.data.providerConfigs.find(c => c.name === name) ?? null;
  }

  async listProviderConfigs(): Promise<ProviderConfigRecord[]> {
    return this.data.providerConfigs;
  }

  async deleteProviderConfig(name: string): Promise<void> {
    this.data.providerConfigs = this.data.providerConfigs.filter(c => c.name !== name);
    this.scheduleFlush();
  }

  // events
  async saveEvent(event: ImageEvent): Promise<void> {
    this.data.events.push(event);
    if (this.data.events.length > 1000) this.data.events = this.data.events.slice(-1000);
    this.scheduleFlush();
  }

  async listEvents(projectId?: string, type?: string, limit = 100): Promise<ImageEvent[]> {
    let result = this.data.events;
    if (projectId) result = result.filter(e => e.projectId === projectId);
    if (type) result = result.filter(e => e.type === type);
    return result.slice(0, limit);
  }

  // search
  async searchImages(query: string, projectId?: string): Promise<ImageRecord[]> {
    const q = query.toLowerCase();
    let result = this.data.images;
    if (projectId) result = result.filter(r => r.projectId === projectId);
    return result.filter(r =>
      r.prompt.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q)) ||
      r.provider.toLowerCase().includes(q)
    );
  }
}
