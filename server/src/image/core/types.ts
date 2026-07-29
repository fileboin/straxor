export type ImageFormat = "png" | "jpeg" | "webp" | "svg" | "avif";

export type ImageQuality = "draft" | "standard" | "hd";

export type AssetType =
  | "logo" | "icon" | "favicon" | "banner"
  | "og-image" | "github-cover" | "readme-image" | "blog-cover"
  | "doc-graphic" | "ui-mockup" | "app-screenshot"
  | "marketing-graphic" | "social-media-graphic" | "presentation-slide";

export type CostOptimizationStrategy = "lowest-cost" | "highest-quality" | "fastest-speed" | "user-preference";

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numImages?: number;
  styleId?: string;
  quality?: ImageQuality;
  format?: ImageFormat;
  seed?: number;
  provider?: string;
  projectId?: string;
  tags?: string[];
  assetType?: AssetType;
  options?: Record<string, unknown>;
}

export interface ImageGenerationResult {
  id: string;
  url: string;
  b64?: string;
  width: number;
  height: number;
  format: ImageFormat;
  provider: string;
  model?: string;
  duration: number;
  cost: number;
  seed?: number;
  createdAt: string;
}

export interface ProviderConfig {
  name: string;
  displayName: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  isEnabled: boolean;
  priority: number;
  costPerImage: number;
  maxDimensions: { width: number; height: number };
  supportedFormats: ImageFormat[];
  options?: Record<string, unknown>;
}

export interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  template: string;
  variables: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptHistoryEntry {
  id: string;
  originalPrompt: string;
  improvedPrompt: string;
  provider: string;
  imageUrl: string;
  duration: number;
  createdAt: string;
}

export interface ImageStyle {
  id: string;
  name: string;
  category: string;
  description: string;
  visualTraits: string[];
  colorPalette?: string[];
  promptPrefix?: string;
  promptSuffix?: string;
  negativePrompt?: string;
  parameters?: Record<string, unknown>;
  isBuiltin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssetSpec {
  type: AssetType;
  width: number;
  height: number;
  format: ImageFormat;
  description: string;
}

export const ASSET_SPECS: Record<AssetType, AssetSpec> = {
  "logo": { type: "logo", width: 512, height: 512, format: "png", description: "Application logo" },
  "icon": { type: "icon", width: 256, height: 256, format: "png", description: "Application icon" },
  "favicon": { type: "favicon", width: 64, height: 64, format: "png", description: "Browser favicon" },
  "banner": { type: "banner", width: 1200, height: 400, format: "webp", description: "Hero banner" },
  "og-image": { type: "og-image", width: 1200, height: 630, format: "webp", description: "Open Graph share image" },
  "github-cover": { type: "github-cover", width: 1280, height: 640, format: "png", description: "GitHub repository cover" },
  "readme-image": { type: "readme-image", width: 800, height: 400, format: "png", description: "README illustration" },
  "blog-cover": { type: "blog-cover", width: 1200, height: 675, format: "webp", description: "Blog post cover" },
  "doc-graphic": { type: "doc-graphic", width: 800, height: 600, format: "png", description: "Documentation graphic" },
  "ui-mockup": { type: "ui-mockup", width: 1440, height: 900, format: "webp", description: "UI mockup screenshot" },
  "app-screenshot": { type: "app-screenshot", width: 390, height: 844, format: "png", description: "Mobile app screenshot" },
  "marketing-graphic": { type: "marketing-graphic", width: 1200, height: 800, format: "webp", description: "Marketing graphic" },
  "social-media-graphic": { type: "social-media-graphic", width: 1080, height: 1080, format: "png", description: "Social media post" },
  "presentation-slide": { type: "presentation-slide", width: 1920, height: 1080, format: "png", description: "Presentation slide" },
};

export interface BrandColor {
  name: string;
  hex: string;
  role: "primary" | "secondary" | "accent" | "background" | "text" | "custom";
}

export interface BrandTypography {
  headingFont?: string;
  bodyFont?: string;
  weights?: number[];
}

export interface BrandAsset {
  type: AssetType;
  url: string;
  createdAt: string;
}

export interface BrandIdentity {
  id: string;
  projectId: string;
  name: string;
  colorPalette: BrandColor[];
  typography: BrandTypography;
  iconStyle: string;
  visualIdentity: string;
  assets: BrandAsset[];
  createdAt: string;
  updatedAt: string;
}

export interface ImageRecord {
  id: string;
  projectId?: string;
  url: string;
  width: number;
  height: number;
  format: ImageFormat;
  size: number;
  provider: string;
  model?: string;
  prompt: string;
  negativePrompt?: string;
  styleId?: string;
  tags: string[];
  assetType?: AssetType;
  version: number;
  parentId?: string;
  cost: number;
  duration: number;
  quality: ImageQuality;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OptimizationRequest {
  imageId: string;
  targetWidth?: number;
  targetHeight?: number;
  targetFormat?: ImageFormat;
  quality?: number;
  compress?: boolean;
  upscale?: boolean;
  crop?: { x: number; y: number; width: number; height: number };
}

export interface OptimizationResult {
  id: string;
  imageId: string;
  url: string;
  width: number;
  height: number;
  format: ImageFormat;
  size: number;
  compressionRatio?: number;
  createdAt: string;
}

export interface CostRecord {
  id: string;
  projectId?: string;
  provider: string;
  model?: string;
  imageCount: number;
  totalCost: number;
  totalDuration: number;
  width: number;
  height: number;
  quality: ImageQuality;
  createdAt: string;
}

export interface QualityCheckResult {
  imageId: string;
  resolution: { width: number; height: number };
  resolutionPass: boolean;
  minResolution: { width: number; height: number };
  readabilityPass?: boolean;
  aspectRatioPass: boolean;
  expectedAspectRatio?: number;
  expectedAspectRatioPass?: boolean;
  duplicateOf?: string;
  score: number;
  passed: boolean;
  issues: string[];
}

export type ImageEventType =
  | "generation:started" | "generation:completed" | "generation:failed"
  | "optimization:started" | "optimization:completed" | "optimization:failed"
  | "brand:created" | "brand:updated"
  | "asset:created"
  | "provider:switched"
  | "image:deleted";

export interface ImageEvent {
  type: ImageEventType;
  projectId?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ImagePlugin {
  name: string;
  version: string;
  onImageEvent?(event: ImageEvent): Promise<void>;
  onBeforeGeneration?(request: ImageGenerationRequest): Promise<ImageGenerationRequest>;
  onAfterGeneration?(result: ImageGenerationResult[]): Promise<ImageGenerationResult[]>;
  onBeforeOptimization?(request: OptimizationRequest): Promise<OptimizationRequest>;
  onAfterOptimization?(result: OptimizationResult): Promise<OptimizationResult>;
  init?(): Promise<void>;
  destroy?(): Promise<void>;
}
