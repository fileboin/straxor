import type {
  ImageRecord, ImageStyle, PromptTemplate, PromptHistoryEntry,
  BrandIdentity, CostRecord, OptimizationResult, ImageEvent,
} from "../core/types.js";
import type { ImageProviderAdapter } from "../providers/interfaces.js";

export interface ImageStore {
  // images
  saveImage(record: ImageRecord): Promise<void>;
  getImage(id: string): Promise<ImageRecord | null>;
  listImages(projectId?: string, tags?: string[], assetType?: string, limit?: number, offset?: number): Promise<ImageRecord[]>;
  deleteImage(id: string): Promise<void>;
  updateImage(id: string, updates: Partial<ImageRecord>): Promise<void>;

  // styles
  saveStyle(style: ImageStyle): Promise<void>;
  getStyle(id: string): Promise<ImageStyle | null>;
  listStyles(category?: string): Promise<ImageStyle[]>;
  deleteStyle(id: string): Promise<void>;

  // prompt templates
  savePromptTemplate(template: PromptTemplate): Promise<void>;
  getPromptTemplate(id: string): Promise<PromptTemplate | null>;
  listPromptTemplates(category?: string): Promise<PromptTemplate[]>;
  deletePromptTemplate(id: string): Promise<void>;

  // prompt history
  savePromptHistory(entry: PromptHistoryEntry): Promise<void>;
  listPromptHistory(limit?: number): Promise<PromptHistoryEntry[]>;

  // brands
  saveBrand(brand: BrandIdentity): Promise<void>;
  getBrand(projectId: string): Promise<BrandIdentity | null>;
  deleteBrand(projectId: string): Promise<void>;

  // costs
  saveCostRecord(record: CostRecord): Promise<void>;
  listCostRecords(projectId?: string, provider?: string, limit?: number): Promise<CostRecord[]>;

  // optimization results
  saveOptimizationResult(result: OptimizationResult): Promise<void>;
  listOptimizationResults(imageId: string): Promise<OptimizationResult[]>;

  // providers
  saveProviderConfig(config: ProviderConfigRecord): Promise<void>;
  getProviderConfig(name: string): Promise<ProviderConfigRecord | null>;
  listProviderConfigs(): Promise<ProviderConfigRecord[]>;
  deleteProviderConfig(name: string): Promise<void>;

  // events
  saveEvent(event: ImageEvent): Promise<void>;
  listEvents(projectId?: string, type?: string, limit?: number): Promise<ImageEvent[]>;

  // search
  searchImages(query: string, projectId?: string): Promise<ImageRecord[]>;
}

export interface ProviderConfigRecord {
  name: string;
  displayName: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  isEnabled: boolean;
  priority: number;
  costPerImage: number;
  maxWidth: number;
  maxHeight: number;
  supportedFormats: string;
  options?: string;
  updatedAt: string;
}
